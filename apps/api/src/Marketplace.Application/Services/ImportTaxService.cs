using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;

namespace Marketplace.Application.Services;

/// <summary>
/// Valores da remessa para a página de produto e o carrinho, com as mesmas regras do checkout: produto, frete e seguro,
/// desconto, despesas, II, ICMS, IBS, CBS, total e câmbio (Programa de Conformidade 4.2).
/// </summary>
public sealed class ImportTaxService(PlatformSettingsProvider settingsProvider, ExchangeRateService rates)
{
    /// <param name="amount">Valor dos produtos em centavos de BRL.</param>
    /// <param name="state">UF de destino, quando conhecida (define o ICMS).</param>
    /// <param name="freight">Frete da opção escolhida, em centavos (0 = frete grátis/incluso; nulo = ainda sem CEP).</param>
    public async Task<ImportTaxBreakdownDto> EstimateAsync(long amount, string? state, long? freight, CancellationToken ct)
    {
        new ValidationErrors()
            .AddIf(amount is < 1 or > 100_000_000, "amount", "Valor inválido.")
            .AddIf(state is { Length: not 2 }, "state", "UF inválida.")
            .AddIf(freight is < 0 or > 10_000_000, "freight", "Frete inválido.")
            .ThrowIfAny();
        var settings = await settingsProvider.GetAsync(ct);
        var usd = await rates.TryGetCurrentAsync(CurrencyCode.USD, CurrencyCode.BRL, ct);
        return ImportTaxCalculator.Calculate(new ImportTaxInput(Money.Brl(amount), Money.Brl(freight ?? 0), Money.ZeroBrl, state), settings, usd).ToDto();
    }
}
