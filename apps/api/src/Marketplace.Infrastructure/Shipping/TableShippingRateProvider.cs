using Marketplace.Application.Abstractions;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Marketplace.Infrastructure.Shipping;

/// <summary>
/// Tabela própria de frete internacional PY→BR: base por serviço + acréscimo por zona (1º dígito do CEP) ×
/// fator de peso por unidade. IDs de opção determinísticos (loja + zona + serviço) para casar cotação e pedido.
/// </summary>
public sealed class TableShippingRateProvider(IAppDbContext db, IMemoryCache cache) : IShippingRateProvider
{
    public const long EconomyBaseAmount = 2490;
    public const long ExpressBaseAmount = 5990;

    public async Task<IReadOnlyList<ShippingRateOption>> QuoteAsync(
        Guid sellerId, string originCity, string destinationPostalCode, ShippingParcel parcel, bool freeShippingEligible, CancellationToken ct)
    {
        var zones = await cache.GetOrCreateAsync("shipping-zones", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
            return await db.ShippingZones.AsNoTracking().ToDictionaryAsync(z => z.Prefix, ct);
        }) ?? [];
        var prefix = destinationPostalCode[..1];
        var zone = zones.GetValueOrDefault(prefix) ?? zones.GetValueOrDefault("0")
                   ?? new ShippingZone { Prefix = "0", State = "SP", City = "São Paulo" };
        return Compute(sellerId, prefix, zone, parcel.Units, freeShippingEligible);
    }

    public static IReadOnlyList<ShippingRateOption> Compute(Guid sellerId, string prefix, ShippingZone zone, int units, bool freeShippingEligible)
    {
        var weightFactor = 1 + (Math.Max(1, units) - 1) * 0.35;
        var economy = (long)Math.Round((EconomyBaseAmount + zone.SurchargeAmount) * weightFactor, MidpointRounding.AwayFromZero);
        var express = (long)Math.Round((ExpressBaseAmount + zone.SurchargeAmount * 1.5) * weightFactor, MidpointRounding.AwayFromZero);
        return
        [
            new ShippingRateOption(
                DeterministicId.Guid($"ship:{sellerId}:{prefix}:economy"),
                "Correo Paraguayo + Correios",
                "Internacional Econômico",
                Money.Brl(freeShippingEligible ? 0 : economy),
                new DayRange(12 + zone.ExtraDays, 25 + zone.ExtraDays),
                freeShippingEligible ? "Frete grátis acima de R$ 300 nesta loja" : "Rastreio ponta a ponta"),
            new ShippingRateOption(
                DeterministicId.Guid($"ship:{sellerId}:{prefix}:express"),
                "Courier Internacional",
                "Expresso",
                Money.Brl(express),
                new DayRange(5 + Math.Max(0, zone.ExtraDays), 10 + Math.Max(0, zone.ExtraDays)),
                "Desembaraço prioritário"),
        ];
    }
}
