using Marketplace.Application.Abstractions;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.Persistence.Seed;
using Marketplace.Infrastructure.Shipping;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Persistence;

public sealed class DatabaseInitializer(
    AppDbContext db,
    IPasswordService passwords,
    IOptions<DatabaseOptions> options,
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
            await db.Database.EnsureCreatedAsync(ct);
            logger.LogInformation("SQLite em {Connection}", path);
        }
        await SeedAsync(ct);
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

        if (options.Value.SeedDemoData) await SeedDemoAsync(ct);
    }

    private async Task SeedDemoAsync(CancellationToken ct)
    {
        if (await db.Users.AnyAsync(u => u.Id == SeedDemo.DemoUserId, ct)) return;

        var user = SeedDemo.User(passwords);
        var addresses = SeedDemo.Addresses();
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

        var demo = SeedDemo.BuildOrders(products, sellers, rate, addresses[0],
            (seller, cep, units, free) =>
            {
                var prefix = cep[..1];
                return TableShippingRateProvider.Compute(seller.Id, prefix, zones[prefix], units, free)
                    .Select(o => new ShippingOptionSnapshot(o.Id, o.Carrier, o.Service, o.Price.Amount, o.EstimatedDays.Min, o.EstimatedDays.Max, o.Description))
                    .ToList();
            },
            settings.ImportTaxBasisPoints,
            clock.GetUtcNow().UtcDateTime);

        db.Payments.AddRange(demo.Payments);
        db.Purchases.AddRange(demo.Purchases);
        db.Orders.AddRange(demo.Orders);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seed demo: usuário {Email} com {Orders} pedidos", SeedDemo.DemoEmail, demo.Orders.Count);
    }
}
