using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;

namespace Marketplace.Domain;

public readonly record struct ImportTaxEstimate(Money Tax, int EffectiveBasisPoints);

/// <summary>
/// Estimativa de tributos de importação para remessas Paraguai → Brasil.
/// O valor é sempre apresentado ao comprador como <b>estimativa</b>; a cobrança final é da Receita Federal.
/// </summary>
public static class ImportTaxCalculator
{
    private const long RemessaConformeThresholdUsdCents = 50_00;
    private const long RemessaConformeDeductionUsdCents = 20_00;
    private const int LowTierBasisPoints = 2000;
    private const int HighTierBasisPoints = 6000;

    /// <param name="taxable">Produtos + frete − desconto, em BRL.</param>
    /// <param name="usdToBrl">Taxa USD→BRL (necessária no modo RemessaConforme).</param>
    public static ImportTaxEstimate Estimate(Money taxable, PlatformSettings settings, ExchangeRate? usdToBrl)
    {
        if (taxable.Amount <= 0) return new ImportTaxEstimate(Money.Brl(0), settings.ImportTaxBasisPoints);

        if (settings.ImportTaxMode == ImportTaxMode.Flat || usdToBrl is null)
        {
            var flat = taxable.MultiplyBasisPoints(settings.ImportTaxBasisPoints);
            return new ImportTaxEstimate(flat, settings.ImportTaxBasisPoints);
        }

        // Remessa Conforme (Lei 14.902/2024): até US$ 50 → 20% II; acima → 60% II com dedução de US$ 20.
        // ICMS (17%) "por dentro" sobre (valor + II).
        var usdCents = Money.RoundDiv(taxable.Amount * usdToBrl.Denominator, usdToBrl.Numerator);
        Money importDuty;
        if (usdCents <= RemessaConformeThresholdUsdCents)
        {
            importDuty = taxable.MultiplyBasisPoints(LowTierBasisPoints);
        }
        else
        {
            var deductionBrl = Money.RoundDiv(RemessaConformeDeductionUsdCents * usdToBrl.Numerator, usdToBrl.Denominator);
            var duty = taxable.MultiplyBasisPoints(HighTierBasisPoints).Amount - deductionBrl;
            importDuty = Money.Brl(Math.Max(0, duty));
        }

        var baseWithDuty = taxable.Amount + importDuty.Amount;
        // ICMS por dentro: base / (1 − alíquota) − base
        var icms = Money.RoundDiv(baseWithDuty * 10_000, 10_000 - settings.IcmsBasisPoints) - baseWithDuty;
        var total = Money.Brl(importDuty.Amount + Math.Max(0, icms));
        var effective = (int)Money.RoundDiv(total.Amount * 10_000, taxable.Amount);
        return new ImportTaxEstimate(total, effective);
    }
}
