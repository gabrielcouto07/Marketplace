using Marketplace.Application.Abstractions;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Marketplace.Infrastructure.Shipping;

/// <summary>
/// Tabela própria de frete internacional PY→BR: base por serviço + acréscimo por zona (1º dígito do CEP) ×
/// fator por unidade. Não depende de rede e serve de fallback para as integrações reais. IDs de opção
/// determinísticos (loja + zona + serviço), iguais aos do mock do front.
/// </summary>
public sealed class TableShippingRateProvider(IAppDbContext db, IMemoryCache cache) : IShippingRateProvider
{
    public const string ProviderName = "table";
    public const string EconomyService = "economy";
    public const string ExpressService = "express";
    public const long EconomyBaseAmount = 2490;
    public const long ExpressBaseAmount = 5990;

    public string Name => ProviderName;

    public async Task<IReadOnlyList<ShippingRateOption>> QuoteAsync(ShippingQuoteContext context, CancellationToken ct)
    {
        var zones = await cache.GetOrCreateAsync("shipping-zones", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
            return await db.ShippingZones.AsNoTracking().ToDictionaryAsync(z => z.Prefix, ct);
        }) ?? [];
        var prefix = context.Destination.Zone;
        var zone = zones.GetValueOrDefault(prefix) ?? zones.GetValueOrDefault("0")
                   ?? new ShippingZone { Prefix = "0", State = "SP", City = "São Paulo" };
        return Compute(context.Origin.SellerId, prefix, zone, context.TotalUnits);
    }

    /// <summary>Preços cheios: o frete grátis é decidido pelo ShippingService (regra da plataforma, não da tabela).</summary>
    public static IReadOnlyList<ShippingRateOption> Compute(Guid sellerId, string prefix, ShippingZone zone, int units)
    {
        var weightFactor = 1 + (Math.Max(1, units) - 1) * 0.35;
        var economy = (long)Math.Round((EconomyBaseAmount + zone.SurchargeAmount) * weightFactor, MidpointRounding.AwayFromZero);
        var express = (long)Math.Round((ExpressBaseAmount + zone.SurchargeAmount * 1.5) * weightFactor, MidpointRounding.AwayFromZero);
        return
        [
            new ShippingRateOption(
                DeterministicId.Guid($"ship:{sellerId}:{prefix}:{EconomyService}"),
                ProviderName,
                EconomyService,
                "Correo Paraguayo + Correios",
                "Internacional Econômico",
                Money.Brl(economy),
                new DayRange(12 + zone.ExtraDays, 25 + zone.ExtraDays),
                "Rastreio ponta a ponta"),
            new ShippingRateOption(
                DeterministicId.Guid($"ship:{sellerId}:{prefix}:{ExpressService}"),
                ProviderName,
                ExpressService,
                "Courier Internacional",
                "Expresso",
                Money.Brl(express),
                new DayRange(5 + Math.Max(0, zone.ExtraDays), 10 + Math.Max(0, zone.ExtraDays)),
                "Desembaraço prioritário"),
        ];
    }
}
