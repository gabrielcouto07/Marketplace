using Marketplace.Application.Abstractions;
using Marketplace.Domain.Common;

namespace Marketplace.Infrastructure.ExchangeRates;

public sealed class ExchangeRateOptions
{
    /// <summary>"Manual" (admin cadastra as taxas) ou o nome de um provedor registrado (ex.: uma API de câmbio).</summary>
    public string Provider { get; set; } = ManualExchangeRateProvider.ProviderName;

    public int RefreshIntervalMinutes { get; set; } = 60;

    /// <summary>Validade de cada cotação importada; vencida, o checkout usa a mais recente mesmo assim (ver ExchangeRateService).</summary>
    public int ValidityHours { get; set; } = 24;

    /// <summary>Pares a importar, no formato "BRL:PYG".</summary>
    public string[] Pairs { get; set; } = ["BRL:PYG", "PYG:BRL", "USD:BRL"];

    public IReadOnlyList<(CurrencyCode From, CurrencyCode To)> ParsedPairs()
    {
        var list = new List<(CurrencyCode, CurrencyCode)>();
        foreach (var pair in Pairs)
        {
            var parts = pair.Split(':', 2);
            if (parts.Length == 2 && Enum.TryParse<CurrencyCode>(parts[0], true, out var from) && Enum.TryParse<CurrencyCode>(parts[1], true, out var to))
                list.Add((from, to));
        }
        return list;
    }
}

/// <summary>Sem fonte externa: as taxas vêm do painel admin (`POST /admin/exchange-rates`).</summary>
public sealed class ManualExchangeRateProvider : IExchangeRateProvider
{
    public const string ProviderName = "manual";

    public string Name => ProviderName;

    public Task<IReadOnlyList<ExternalExchangeRate>> FetchAsync(IReadOnlyList<(CurrencyCode From, CurrencyCode To)> pairs, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<ExternalExchangeRate>>([]);
}
