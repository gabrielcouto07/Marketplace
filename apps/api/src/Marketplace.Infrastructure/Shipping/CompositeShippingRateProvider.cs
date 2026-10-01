using Marketplace.Application.Abstractions;
using Marketplace.Infrastructure.Providers;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Shipping;

public sealed class ShippingOptions
{
    /// <summary>Provedor principal de cotação: "Table" (padrão) ou o nome de uma integração registrada.</summary>
    public string Provider { get; set; } = TableShippingRateProvider.ProviderName;

    /// <summary>Quando a integração falha ou não atende o destino, usa a tabela própria em vez de bloquear o checkout.</summary>
    public bool FallbackToTable { get; set; } = true;

    /// <summary>Tempo máximo de uma cotação externa antes de cair no fallback.</summary>
    public int TimeoutSeconds { get; set; } = 8;
}

/// <summary>
/// Ponto único de cotação usado pelo ShippingService: chama o provedor configurado e, em falha/timeout/lista
/// vazia, cai na tabela própria (quando permitido). Trocar de transportadora não toca no checkout.
/// </summary>
public sealed class CompositeShippingRateProvider(
    ProviderCatalog<IShippingRateProvider> catalog,
    IOptions<ShippingOptions> options,
    ILogger<CompositeShippingRateProvider> logger) : IShippingRateProvider
{
    public string Name => "composite";

    public async Task<IReadOnlyList<ShippingRateOption>> QuoteAsync(ShippingQuoteContext context, CancellationToken ct)
    {
        var primaryName = options.Value.Provider;
        var table = catalog.Resolve(TableShippingRateProvider.ProviderName);
        if (primaryName.Equals(TableShippingRateProvider.ProviderName, StringComparison.OrdinalIgnoreCase))
            return await table.QuoteAsync(context, ct);

        var primary = catalog.Resolve(primaryName);
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, options.Value.TimeoutSeconds)));
            var quotes = await primary.QuoteAsync(context, timeout.Token);
            if (quotes.Count > 0) return quotes;
            logger.LogWarning("Frete {Provider} sem opções para CEP {Cep} (loja {SellerId})", primary.Name, context.Destination.PostalCode, context.Origin.SellerId);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Frete {Provider} excedeu {Seconds}s para CEP {Cep}", primary.Name, options.Value.TimeoutSeconds, context.Destination.PostalCode);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidOperationException)
        {
            logger.LogError(ex, "Frete {Provider} falhou para CEP {Cep}", primary.Name, context.Destination.PostalCode);
        }

        if (!options.Value.FallbackToTable) return [];
        return await table.QuoteAsync(context, ct);
    }
}
