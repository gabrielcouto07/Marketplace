using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;

namespace Marketplace.Application.Services;

/// <summary>Estimativa dos tributos de um produto (página de produto e carrinho), com as mesmas regras do checkout.</summary>
public sealed class ImportTaxService(PlatformSettingsProvider settingsProvider, ExchangeRateService rates)
{
    /// <param name="amount">Valor dos produtos em centavos de BRL (sem frete: ele entra no checkout).</param>
    /// <param name="state">UF de destino, quando conhecida (define o ICMS).</param>
    public async Task<ImportTaxBreakdownDto> EstimateAsync(long amount, string? state, CancellationToken ct)
    {
        new ValidationErrors()
            .AddIf(amount is < 1 or > 100_000_000, "amount", "Valor inválido.")
            .AddIf(state is { Length: not 2 }, "state", "UF inválida.")
            .ThrowIfAny();
        var settings = await settingsProvider.GetAsync(ct);
        var usd = await rates.TryGetCurrentAsync(CurrencyCode.USD, CurrencyCode.BRL, ct);
        return ImportTaxCalculator.Calculate(new ImportTaxInput(Money.Brl(amount), Money.ZeroBrl, Money.ZeroBrl, state), settings, usd).ToDto();
    }
}
