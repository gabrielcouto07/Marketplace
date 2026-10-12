using System.Security.Cryptography;
using System.Text;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Services;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Compliance;
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
        await SyncSeedCatalogAsync(ct);
        await BackfillCatalogComplianceAsync(ct);

        await SeedAdminAsync(ct);
        if (options.Value.SeedDemoData) await SeedDemoAsync(ct);
        await BackfillGovernanceAsync(ct);
    }

    /// <summary>
    /// Bancos semeados antes do Remessa Conforme ficaram com o catálogo sem NCM e as lojas sem documentos, e aí nenhuma
    /// etiqueta sai; os semeados antes da Política de Vendedores ficaram sem os dados de admissão (3.1 e 3.2) e sem a
    /// descrição da declaração (Programa 7.4 e 7.6). Completa só o que estiver vazio, a partir do seed (mesmo ID
    /// determinístico ou mesmo nome de template). Produtos e lojas criados por vendedores não são tocados.
    /// </summary>
    public async Task BackfillCatalogComplianceAsync(CancellationToken ct)
    {
        var withoutNcm = await db.Products.Where(p => p.HsCode == null).ToListAsync(ct);
        var withoutDeclaration = await db.Products.Where(p => p.Nature == null).ToListAsync(ct);
        var withoutKyc = await db.Sellers.Where(s => s.LegalAddress == null || s.LegalName == null).ToListAsync(ct);
        if (withoutNcm.Count == 0 && withoutDeclaration.Count == 0 && withoutKyc.Count == 0) return;

        var catalog = SeedCatalog.Build();
        var byName = catalog.Products.GroupBy(p => p.Name, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        var products = 0;
        foreach (var product in withoutNcm.Union(withoutDeclaration))
        {
            if (!byName.TryGetValue(product.Name, out var seed)) continue;
            product.HsCode ??= seed.HsCode;
            if (product.Nature is null)
            {
                product.Nature = seed.Nature;
                product.Unbranded = seed.Unbranded;
                product.Material = seed.Material;
                product.PackageQuantity = seed.PackageQuantity;
                product.OriginCountry = seed.OriginCountry;
            }
            products++;
        }

        var seededSellers = catalog.Sellers.ToDictionary(s => s.Id);
        var sellers = 0;
        foreach (var seller in withoutKyc)
        {
            if (!seededSellers.TryGetValue(seller.Id, out var seed)) continue;
            seller.LegalAddress ??= seed.LegalAddress;
            seller.ResponsibleName ??= seed.ResponsibleName;
            seller.ResponsibleDocumentType ??= seed.ResponsibleDocumentType;
            seller.ResponsibleDocument ??= seed.ResponsibleDocument;
            seller.IdentityDocumentUrl ??= seed.IdentityDocumentUrl;
            seller.RucCertificateUrl ??= seed.RucCertificateUrl;
            seller.VerifiedAt ??= seed.VerifiedAt;
            seller.LegalName ??= seed.LegalName;
            seller.Email ??= seed.Email;
            seller.Phone ??= seed.Phone;
            seller.PayoutMethod ??= seed.PayoutMethod;
            seller.PayoutInstitution ??= seed.PayoutInstitution;
            seller.PayoutAccount ??= seed.PayoutAccount;
            seller.PayoutHolder ??= seed.PayoutHolder;
            seller.TaxComplianceCertificateUrl ??= seed.TaxComplianceCertificateUrl;
            seller.ArticlesOfIncorporationUrl ??= seed.ArticlesOfIncorporationUrl;
            if (seller.VerificationChecklist.Count == 0) seller.VerificationChecklist = seed.VerificationChecklist;
            seller.DataConfirmedAt ??= clock.GetUtcNow().UtcDateTime;
            seller.PolicyVersionAccepted ??= seed.PolicyVersionAccepted;
            seller.PolicyAcceptedAt ??= seed.PolicyAcceptedAt;
            sellers++;
        }

        if (products + sellers == 0) return;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Conformidade: dados da declaração/NCM preenchidos em {Products} produtos e dados de admissão em {Sellers} lojas do catálogo",
            products, sellers);
    }

    /// <summary>
    /// Catálogo de demonstração em bancos já semeados: a categoria e a loja de bebidas alcoólicas (oferta vedada, Anexo I,
    /// f) saem da vitrine e a categoria de games entra no lugar, com a loja e os produtos do seed atual.
    /// </summary>
    public async Task SyncSeedCatalogAsync(CancellationToken ct)
    {
        var catalog = SeedCatalog.Build();
        var categoryIds = await db.Categories.Select(c => c.Id).ToListAsync(ct);
        if (!catalog.Categories.Any(c => categoryIds.Contains(c.Id))) return; // banco sem o catálogo do seed

        var changes = 0;
        var retiredCategoryIds = SeedCatalog.RetiredCategorySlugs.Select(s => DeterministicId.Guid($"category:{s}")).ToList();
        foreach (var category in await db.Categories.Where(c => retiredCategoryIds.Contains(c.Id) && c.IsActive).ToListAsync(ct))
        {
            category.IsActive = false;
            changes++;
        }
        var retiredProducts = await db.Products.Where(p => retiredCategoryIds.Contains(p.CategoryId) &&
                                                          (p.Status == ProductStatus.Ativo || p.Status == ProductStatus.EmAnalise || p.Status == ProductStatus.Rascunho))
            .ToListAsync(ct);
        foreach (var product in retiredProducts.Where(p => Ncm.ProhibitionReason(p.HsCode ?? string.Empty) is null))
        {
            product.Status = ProductStatus.Arquivado;
            product.ModerationNote = "Produto de demonstração retirado com a categoria de bebidas.";
            product.UpdatedAt = clock.GetUtcNow().UtcDateTime;
            changes++;
        }
        var retiredSellerIds = SeedCatalog.RetiredSellerSlugs.Select(s => DeterministicId.Guid($"seller:{s}")).ToList();
        foreach (var seller in await db.Sellers.Where(s => retiredSellerIds.Contains(s.Id) && s.OwnerUserId == null && s.Status == SellerStatus.Aprovado).ToListAsync(ct))
        {
            seller.Status = SellerStatus.Suspenso;
            seller.SuspendedAt = clock.GetUtcNow().UtcDateTime;
            seller.SuspensionReason = "Loja de demonstração retirada: bebidas alcoólicas são oferta vedada (Anexo I, f, da Política de Vendedores).";
            changes++;
        }

        var newCategories = catalog.Categories.Where(c => !categoryIds.Contains(c.Id)).ToList();
        db.Categories.AddRange(newCategories);
        var sellerIds = await db.Sellers.Select(s => s.Id).ToListAsync(ct);
        var rucs = await db.Sellers.Select(s => s.Ruc).ToListAsync(ct);
        var newSellers = catalog.Sellers.Where(s => !sellerIds.Contains(s.Id) && !rucs.Contains(s.Ruc)).ToList();
        db.Sellers.AddRange(newSellers);
        var addedSellerIds = newSellers.Select(s => s.Id).Concat(sellerIds).ToHashSet();
        var productIds = await db.Products.Select(p => p.Id).ToListAsync(ct);
        var slugs = await db.Products.Select(p => p.Slug).ToListAsync(ct);
        var newProducts = catalog.Products.Where(p => !productIds.Contains(p.Id) && !slugs.Contains(p.Slug) && addedSellerIds.Contains(p.SellerId)).ToList();
        db.Products.AddRange(newProducts);
        var newProductIds = newProducts.Select(p => p.Id).ToHashSet();
        db.Reviews.AddRange(catalog.Reviews.Where(r => newProductIds.Contains(r.ProductId)));
        db.Questions.AddRange(catalog.Questions.Where(q => newProductIds.Contains(q.ProductId)));
        changes += newCategories.Count + newSellers.Count + newProducts.Count;

        if (changes == 0) return;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Catálogo do seed sincronizado: {Categories} categoria(s), {Sellers} loja(s) e {Products} produto(s) novos; {Retired} item(ns) retirados",
            newCategories.Count, newSellers.Count, newProducts.Count, retiredProducts.Count);
    }

    /// <summary>
    /// Programa de Conformidade e Política de Vendedores em bancos existentes: anúncios com NCM vedado pelo Anexo I saem da
    /// vitrine (medida comunicada à loja e registrada), aceites gravados antes do registro detalhado ganham o registro
    /// (Política 2.2) e denúncias antigas ganham protocolo e prazo de decisão (6.5).
    /// </summary>
    public async Task BackfillGovernanceAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var changes = 0;

        var candidates = await db.Products.Where(p => p.HsCode != null && p.Status != ProductStatus.Bloqueado).ToListAsync(ct);
        foreach (var product in candidates)
        {
            if (Ncm.ProhibitionReason(product.HsCode!) is not { } reason) continue;
            var measure = new SellerMeasure
            {
                Id = Guid.NewGuid(), SellerId = product.SellerId, Type = SellerMeasureType.RemocaoAnuncio, ProductId = product.Id,
                Reason = $"Oferta vedada: {reason}", AppliedAt = now, Automatic = true,
            };
            var notice = new SellerNotice
            {
                Id = Guid.NewGuid(), SellerId = product.SellerId, Type = SellerNoticeType.Medida, ProductId = product.Id, MeasureId = measure.Id,
                Title = $"Remoção do anúncio \"{product.Name}\"",
                Message = $"Remoção do anúncio \"{product.Name}\".\n\nMotivo: oferta vedada — {reason}\n\nVocê pode responder em até {ProgramDeadlines.SellerResponseDays} dias, com os documentos que tiver (Política de Vendedores, item 8.6).",
                CreatedAt = now, DueAt = now.AddDays(ProgramDeadlines.SellerResponseDays),
            };
            measure.NoticeId = notice.Id;
            product.Status = ProductStatus.Bloqueado;
            product.ModerationReason = "PRODUTO_PROIBIDO";
            product.ModerationNote = reason.Length > 500 ? reason[..500] : reason;
            product.ModeratedAt = now;
            product.UpdatedAt = now;
            db.SellerMeasures.Add(measure);
            db.SellerNotices.Add(notice);
            db.EnforcementActions.Add(new EnforcementAction
            {
                Kind = EnforcementActionKind.MedidaAplicada, OccurredAt = now, Automatic = true, SellerId = product.SellerId, ProductId = product.Id,
                MeasureId = measure.Id, NoticeId = notice.Id, Reason = $"Remoção do anúncio \"{product.Name}\": {reason}",
                Result = "Anúncio retirado da vitrine; o vendedor não pode reativá-lo.",
            });
            changes++;
        }

        var accepted = await db.SellerPolicyAcceptances.Select(a => a.SellerId).Distinct().ToListAsync(ct);
        foreach (var seller in await db.Sellers.Where(s => s.PolicyVersionAccepted != null && !accepted.Contains(s.Id)).ToListAsync(ct))
        {
            db.SellerPolicyAcceptances.Add(new SellerPolicyAcceptance
            {
                Id = Guid.NewGuid(), SellerId = seller.Id, UserId = seller.OwnerUserId ?? Guid.Empty, PolicyVersion = seller.PolicyVersionAccepted!,
                AcceptedAt = seller.PolicyAcceptedAt ?? now, RepresentativeName = seller.ResponsibleName ?? seller.Name,
                RepresentativeDocumentType = seller.ResponsibleDocumentType, RepresentativeDocument = seller.ResponsibleDocument, IpAddress = "seed",
            });
            changes++;
        }

        var reports = await db.ProductReports.Where(r => r.Protocol == null || r.DueAt < new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc)).OrderBy(r => r.CreatedAt).ToListAsync(ct);
        if (reports.Count > 0)
        {
            var year = now.Year;
            var sequence = await db.ProductReports.CountAsync(r => r.Protocol != null && r.Protocol.StartsWith($"DEN-{year}-"), ct);
            foreach (var report in reports)
            {
                report.Protocol ??= $"DEN-{year}-{++sequence:000000}";
                if (report.DueAt < new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc))
                    report.DueAt = ProgramDeadlines.AddBusinessDays(report.CreatedAt, ProgramDeadlines.ReportDecisionBusinessDays);
                changes++;
            }
        }

        if (changes == 0) return;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Conformidade: {Changes} ajuste(s) em bancos existentes (anúncios vedados, aceites e denúncias)", changes);
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
