using System.Security.Cryptography;
using System.Text;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Services;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.Persistence.Seed;
using Marketplace.Infrastructure.Shipping;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Persistence;

public sealed class AdminOptions
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = "Administrador";
}

public sealed class DatabaseInitializer(
    AppDbContext db,
    IPasswordService passwords,
    IOptions<DatabaseOptions> options,
    IOptions<AdminOptions> adminOptions,
    TimeProvider clock,
    ILogger<DatabaseInitializer> logger)
{
    public async Task InitializeAsync(CancellationToken ct)
    {
        if (options.Value.Provider == "Postgres")
        {
            await db.Database.MigrateAsync(ct);
        }
        else
        {
            var path = db.Database.GetConnectionString();
            await EnsureSqliteSchemaAsync(path, ct);
            logger.LogInformation("SQLite em {Connection}", path);
        }
        await SeedAsync(ct);
    }

    private const string SchemaHashTable = "__schema_hash";

    /// <summary>
    /// SQLite é só para desenvolvimento e usa EnsureCreated (sem migrations). Para o banco não ficar "velho" depois de
    /// uma mudança nas entidades, guardamos um hash do modelo (tabelas, colunas, índices) na tabela __schema_hash e,
    /// quando ele diverge, recriamos o arquivo (ou falhamos com uma mensagem clara, conforme RecreateSqliteOnSchemaChange).
    /// </summary>
    private async Task EnsureSqliteSchemaAsync(string? path, CancellationToken ct)
    {
        var created = await db.Database.EnsureCreatedAsync(ct);
        var expected = ComputeSchemaHash(db.Model);
        await db.Database.ExecuteSqlRawAsync($"CREATE TABLE IF NOT EXISTS {SchemaHashTable} (hash TEXT NOT NULL)", ct);

        if (!created)
        {
            var stored = (await db.Database.SqlQueryRaw<string>($"SELECT hash AS \"Value\" FROM {SchemaHashTable}").ToListAsync(ct)).FirstOrDefault();
            if (stored == expected) return;
            if (!options.Value.RecreateSqliteOnSchemaChange)
                throw new InvalidOperationException(
                    $"O schema do SQLite em {path} está desatualizado em relação às entidades. Apague o arquivo (o seed recria tudo) " +
                    "ou ligue Database:RecreateSqliteOnSchemaChange.");
            logger.LogWarning("Schema mudou desde que {Connection} foi criado: recriando o banco SQLite (dados de desenvolvimento descartados; o seed roda de novo)", path);
            await db.Database.EnsureDeletedAsync(ct);
            await db.Database.EnsureCreatedAsync(ct);
            await db.Database.ExecuteSqlRawAsync($"CREATE TABLE IF NOT EXISTS {SchemaHashTable} (hash TEXT NOT NULL)", ct);
        }

        await db.Database.ExecuteSqlRawAsync($"DELETE FROM {SchemaHashTable}", ct);
        await db.Database.ExecuteSqlAsync($"INSERT INTO __schema_hash (hash) VALUES ({expected})", ct);
    }

    /// <summary>Hash estável de tabelas, colunas (nome, tipo, nulidade) e índices do modelo relacional.</summary>
    private static string ComputeSchemaHash(IModel model)
    {
        var sb = new StringBuilder();
        foreach (var entity in model.GetEntityTypes().OrderBy(e => e.GetTableName(), StringComparer.Ordinal))
        {
            var table = entity.GetTableName();
            if (table is null) continue;
            var store = StoreObjectIdentifier.Table(table, entity.GetSchema());
            sb.Append(table).Append('\n');
            foreach (var property in entity.GetProperties().OrderBy(p => p.GetColumnName(store), StringComparer.Ordinal))
                sb.Append("  ").Append(property.GetColumnName(store)).Append(':').Append(property.GetColumnType(store))
                    .Append(property.IsColumnNullable(store) ? "?" : "").Append('\n');
            foreach (var index in entity.GetIndexes().OrderBy(i => i.GetDatabaseName(store), StringComparer.Ordinal))
                sb.Append("  ix ").Append(index.GetDatabaseName(store)).Append(index.IsUnique ? " unique" : "").Append('\n');
        }
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString())));
    }

    public async Task SeedAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;

        if (!await db.PlatformSettings.AnyAsync(ct))
            db.PlatformSettings.Add(new PlatformSettings { Id = 1, UpdatedAt = now });

        if (!await db.ShippingZones.AnyAsync(ct)) db.ShippingZones.AddRange(SeedCatalog.ShippingZones());
        if (!await db.ExchangeRates.AnyAsync(ct)) db.ExchangeRates.AddRange(SeedCatalog.ExchangeRates(now));
        if (!await db.Banners.AnyAsync(ct)) db.Banners.AddRange(SeedCatalog.Banners());
        if (!await db.Coupons.AnyAsync(ct))
            db.Coupons.Add(new Coupon { Id = DeterministicId.Guid("coupon:PARAGUAI10"), Code = "PARAGUAI10", DiscountBasisPoints = 1000, Active = true });

        if (!await db.Categories.AnyAsync(ct))
        {
            var catalog = SeedCatalog.Build();
            db.Categories.AddRange(catalog.Categories);
            db.Sellers.AddRange(catalog.Sellers);
            db.Products.AddRange(catalog.Products);
            db.Reviews.AddRange(catalog.Reviews);
            db.Questions.AddRange(catalog.Questions);
            logger.LogInformation("Seed do catálogo: {Categories} categorias, {Sellers} lojas, {Products} produtos",
                catalog.Categories.Count, catalog.Sellers.Count, catalog.Products.Count);
        }
        await db.SaveChangesAsync(ct);
        await BackfillCatalogComplianceAsync(ct);

        await SeedAdminAsync(ct);
        if (options.Value.SeedDemoData) await SeedDemoAsync(ct);
    }

    /// <summary>
    /// Bancos semeados antes do Remessa Conforme ficaram com o catálogo sem NCM e as lojas sem documentos, e aí nenhuma
    /// etiqueta sai. Completa só o que estiver vazio: NCM dos produtos com o nome de um template do seed e documentos das
    /// lojas do seed (mesmo ID determinístico). Produtos e lojas criados por vendedores não são tocados.
    /// </summary>
    public async Task BackfillCatalogComplianceAsync(CancellationToken ct)
    {
        var withoutNcm = await db.Products.Where(p => p.HsCode == null).ToListAsync(ct);
        var withoutKyc = await db.Sellers.Where(s => s.LegalAddress == null).ToListAsync(ct);
        if (withoutNcm.Count == 0 && withoutKyc.Count == 0) return;

        var catalog = SeedCatalog.Build();
        var ncmByName = catalog.Products.Where(p => p.HsCode != null)
            .GroupBy(p => p.Name, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First().HsCode!, StringComparer.Ordinal);
        var products = 0;
        foreach (var product in withoutNcm)
        {
            if (!ncmByName.TryGetValue(product.Name, out var ncm)) continue;
            product.HsCode = ncm;
            products++;
        }

        var seededSellers = catalog.Sellers.ToDictionary(s => s.Id);
        var sellers = 0;
        foreach (var seller in withoutKyc)
        {
            if (!seededSellers.TryGetValue(seller.Id, out var seed)) continue;
            seller.LegalAddress = seed.LegalAddress;
            seller.ResponsibleName = seed.ResponsibleName;
            seller.ResponsibleDocumentType = seed.ResponsibleDocumentType;
            seller.ResponsibleDocument = seed.ResponsibleDocument;
            seller.IdentityDocumentUrl = seed.IdentityDocumentUrl;
            seller.RucCertificateUrl = seed.RucCertificateUrl;
            seller.VerifiedAt ??= seed.VerifiedAt;
            sellers++;
        }

        if (products + sellers == 0) return;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Remessa Conforme: NCM preenchido em {Products} produtos e documentos em {Sellers} lojas do catálogo",
            products, sellers);
    }

    /// <summary>Cria o administrador único a partir de Admin:Email/Admin:Password (se ainda não existir).</summary>
    private async Task SeedAdminAsync(CancellationToken ct)
    {
        var admin = adminOptions.Value;
        if (string.IsNullOrWhiteSpace(admin.Email) || string.IsNullOrWhiteSpace(admin.Password)) return;
        var email = admin.Email.Trim().ToLowerInvariant();
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        if (existing is null)
        {
            db.Users.Add(new User
            {
                Id = Guid.NewGuid(), FullName = admin.FullName, Email = email, PasswordHash = passwords.Hash(admin.Password),
                Roles = [Domain.UserRole.Comprador, Domain.UserRole.Admin], EmailVerified = true, CreatedAt = now, UpdatedAt = now,
            });
            logger.LogInformation("Administrador criado: {Email}", email);
        }
        else if (!existing.Roles.Contains(Domain.UserRole.Admin))
        {
            existing.Roles = [.. existing.Roles, Domain.UserRole.Admin];
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedDemoAsync(CancellationToken ct)
    {
        if (await db.Users.AnyAsync(u => u.Id == SeedDemo.DemoUserId, ct)) return;

        var user = SeedDemo.User(passwords);
        var addresses = SeedDemo.Addresses();
        // Demo: o usuário é dono da MegaStore Paraguay para o painel do vendedor já nascer com dados.
        var demoStore = await db.Sellers.FirstOrDefaultAsync(s => s.Slug == "megastore-paraguay", ct);
        if (demoStore is not null)
        {
            demoStore.OwnerUserId = user.Id;
            user.Roles = [Domain.UserRole.Comprador, Domain.UserRole.Vendedor];
        }
        db.Users.Add(user);
        db.Addresses.AddRange(addresses);
        var settings = await db.PlatformSettings.FirstAsync(ct);
        db.Consents.Add(new Consent { Id = Guid.NewGuid(), UserId = user.Id, Type = Domain.ConsentType.TermosDeUso, Version = settings.TermsVersion, AcceptedAt = user.CreatedAt });
        db.Consents.Add(new Consent { Id = Guid.NewGuid(), UserId = user.Id, Type = Domain.ConsentType.PoliticaDePrivacidade, Version = settings.PrivacyPolicyVersion, AcceptedAt = user.CreatedAt });

        var products = await db.Products.Include(p => p.Images).Include(p => p.Category).ToListAsync(ct);
        // Ordem do mock: categorias na ordem do seed e produtos na ordem dos templates (índice no slug).
        products = products
            .OrderBy(p => Array.FindIndex(SeedCatalog.Categories, c => c.Slug == p.Category.Slug))
            .ThenBy(p => int.Parse(p.Slug[(p.Slug.LastIndexOf('-') + 4)..]))
            .ToList();
        var sellers = await db.Sellers.ToListAsync(ct);
        var rate = await db.ExchangeRates.FirstAsync(r => r.From == CurrencyCode.BRL && r.To == CurrencyCode.PYG, ct);
        var zones = await db.ShippingZones.ToDictionaryAsync(z => z.Prefix, ct);
        var usd = await db.ExchangeRates.Where(r => r.From == CurrencyCode.USD && r.To == CurrencyCode.BRL).OrderByDescending(r => r.QuotedAt).FirstOrDefaultAsync(ct);

        var demo = SeedDemo.BuildOrders(products, sellers, rate, addresses[0],
            (seller, cep, units, free) =>
            {
                var prefix = cep[..1];
                return ShippingService.ApplyFreeShipping(TableShippingRateProvider.Compute(seller.Id, prefix, zones[prefix], units), free, settings.FreeShippingThresholdAmount)
                    .Select(o => o.ToSnapshot())
                    .ToList();
            },
            (subtotal, freight, state) => ImportTaxCalculator.Calculate(
                new ImportTaxInput(Money.Brl(subtotal), Money.Brl(freight), Money.ZeroBrl, state), settings, usd),
            clock.GetUtcNow().UtcDateTime);

        db.Payments.AddRange(demo.Payments);
        db.Purchases.AddRange(demo.Purchases);
        db.Orders.AddRange(demo.Orders);
        db.TaxRemittances.AddRange(demo.Remittances);
        var compliance = SeedDemo.Compliance(products, sellers, demo.Orders, products.First(p => p.Category.Slug == "eletronicos").Category);
        db.ComplianceOccurrences.AddRange(compliance.Occurrences);
        db.ProductReports.AddRange(compliance.Reports);
        db.Sellers.Add(compliance.PendingSeller);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seed demo: usuário {Email} com {Orders} pedidos", SeedDemo.DemoEmail, demo.Orders.Count);
    }
}
