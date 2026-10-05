using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;

namespace Marketplace.Domain;

public readonly record struct ImportTaxEstimate(Money Tax, int EffectiveBasisPoints);

/// <summary>Valores de uma remessa (um pedido = um pacote = uma declaração).</summary>
/// <param name="Products">Soma dos itens, em BRL.</param>
/// <param name="Freight">Frete cobrado do comprador, em BRL.</param>
/// <param name="Discount">Desconto rateado para esta remessa, em BRL.</param>
/// <param name="DestinationState">UF de destino (define o ICMS quando há exceção por estado).</param>
public sealed record ImportTaxInput(Money Products, Money Freight, Money Discount, string? DestinationState = null);

/// <summary>Cotação USD→BRL usada na conversão da faixa de US$ 50 (gravada no pedido).</summary>
public sealed record UsdRateSnapshot(long Numerator, long Denominator, string Display, DateTime QuotedAt, string Source);

/// <summary>
/// Tributos discriminados de uma remessa, no formato que o site mostra ao comprador (Portaria Coana 130/2023,
/// art. 8º, II) e que a declaração antecipada leva no bloco "Remessa Conforme" da DIR (valores provisionados de
/// II, ICMS, IBS estadual, IBS municipal e CBS).
/// </summary>
public sealed record ImportTaxBreakdown(
    ImportTaxRegime Regime,
    Money Products,
    Money Freight,
    Money Insurance,
    Money OtherExpenses,
    Money Discount,
    /// <summary>Produtos + frete + seguro + despesas − desconto (base do II).</summary>
    Money CustomsValue,
    long? CustomsValueUsdCents,
    Money ImportDuty,
    /// <summary>2000 (até US$ 50) ou 6000 (acima); na estimativa, a alíquota única. 0 = varia entre remessas.</summary>
    int ImportDutyBasisPoints,
    Money ImportDutyDeduction,
    Money Icms,
    int IcmsBasisPoints,
    string? IcmsState,
    Money IbsState,
    int IbsStateBasisPoints,
    Money IbsMunicipal,
    int IbsMunicipalBasisPoints,
    Money Cbs,
    int CbsBasisPoints,
    Money TotalTaxes,
    /// <summary>Valor aduaneiro + tributos: o que o comprador paga pela remessa.</summary>
    Money Total,
    UsdRateSnapshot? UsdRate,
    /// <summary>Acima de US$ 3.000 a remessa não cabe na tributação simplificada.</summary>
    bool ExceedsSimplifiedLimit)
{
    public Money Ibs => IbsState.Add(IbsMunicipal);

    public int IbsBasisPoints => IbsStateBasisPoints + IbsMunicipalBasisPoints;

    public int EffectiveBasisPoints =>
        CustomsValue.Amount <= 0 ? 0 : (int)Money.RoundDiv(TotalTaxes.Amount * 10_000, CustomsValue.Amount);

    public bool IsFinal => Regime == ImportTaxRegime.RemessaConforme;

    /// <summary>Soma das remessas de uma compra (resumo do checkout). Alíquotas que variam viram 0.</summary>
    public static ImportTaxBreakdown Sum(IReadOnlyList<ImportTaxBreakdown> parts)
    {
        if (parts.Count == 0) throw new ArgumentException("Nenhuma remessa.", nameof(parts));
        if (parts.Count == 1) return parts[0];
        static Money S(IEnumerable<Money> values) => Money.Sum(values);
        static int Same(IEnumerable<int> values) { var set = values.Distinct().ToList(); return set.Count == 1 ? set[0] : 0; }
        var first = parts[0];
        long? usd = parts.All(p => p.CustomsValueUsdCents is not null) ? parts.Sum(p => p.CustomsValueUsdCents!.Value) : null;
        return new ImportTaxBreakdown(
            parts.Any(p => p.Regime == ImportTaxRegime.Estimativa) ? ImportTaxRegime.Estimativa : ImportTaxRegime.RemessaConforme,
            S(parts.Select(p => p.Products)), S(parts.Select(p => p.Freight)), S(parts.Select(p => p.Insurance)),
            S(parts.Select(p => p.OtherExpenses)), S(parts.Select(p => p.Discount)), S(parts.Select(p => p.CustomsValue)), usd,
            S(parts.Select(p => p.ImportDuty)), Same(parts.Select(p => p.ImportDutyBasisPoints)), S(parts.Select(p => p.ImportDutyDeduction)),
            S(parts.Select(p => p.Icms)), Same(parts.Select(p => p.IcmsBasisPoints)), first.IcmsState,
            S(parts.Select(p => p.IbsState)), first.IbsStateBasisPoints,
            S(parts.Select(p => p.IbsMunicipal)), first.IbsMunicipalBasisPoints,
            S(parts.Select(p => p.Cbs)), first.CbsBasisPoints,
            S(parts.Select(p => p.TotalTaxes)), S(parts.Select(p => p.Total)),
            first.UsdRate, parts.Any(p => p.ExceedsSimplifiedLimit));
    }
}

/// <summary>
/// Tributos de importação de remessas Paraguai → Brasil.
/// <para>
/// Modo <see cref="ImportTaxMode.RemessaConforme"/> (Lei 14.902/2024 e Portaria MF 1.086/2024): II de 20% até US$ 50
/// e de 60% com dedução de US$ 20 acima disso (até US$ 3.000); ICMS "por dentro" sobre valor aduaneiro + II, com a
/// alíquota da UF de destino; IBS (estadual + municipal) e CBS sobre valor aduaneiro + II, com as alíquotas
/// configuradas pelo admin (LC 214/2025). O valor é definitivo: a plataforma cobra na compra e repassa.
/// </para>
/// <para>Modo <see cref="ImportTaxMode.Flat"/> ou sem cotação do dólar: alíquota única, apresentada como estimativa.</para>
/// </summary>
public static class ImportTaxCalculator
{
    public const long LowTierLimitUsdCents = 50_00;
    public const long SimplifiedRegimeLimitUsdCents = 3_000_00;
    private const long HighTierDeductionUsdCents = 20_00;
    public const int LowTierBasisPoints = 2000;
    public const int HighTierBasisPoints = 6000;

    /// <summary>Compatível com a estimativa antiga: só produtos + frete − desconto, sem seguro nem despesas.</summary>
    /// <param name="taxable">Produtos + frete − desconto, em BRL.</param>
    /// <param name="usdToBrl">Taxa USD→BRL (necessária no modo RemessaConforme).</param>
    public static ImportTaxEstimate Estimate(Money taxable, PlatformSettings settings, ExchangeRate? usdToBrl)
    {
        if (taxable.Amount <= 0) return new ImportTaxEstimate(Money.Brl(0), settings.ImportTaxBasisPoints);
        var result = Calculate(new ImportTaxInput(taxable, Money.ZeroBrl, Money.ZeroBrl), settings, usdToBrl, includeExtras: false);
        return new ImportTaxEstimate(result.TotalTaxes, result.EffectiveBasisPoints);
    }

    public static ImportTaxBreakdown Calculate(ImportTaxInput input, PlatformSettings settings, ExchangeRate? usdToBrl) =>
        Calculate(input, settings, usdToBrl, includeExtras: true);

    private static ImportTaxBreakdown Calculate(ImportTaxInput input, PlatformSettings settings, ExchangeRate? usdToBrl, bool includeExtras)
    {
        var zero = Money.ZeroBrl;
        var insurance = includeExtras ? input.Products.MultiplyBasisPoints(settings.InsuranceBasisPoints) : zero;
        var expenses = includeExtras && input.Products.Amount > 0 ? Money.Brl(Math.Max(0, settings.OtherExpensesAmount)) : zero;
        var customs = Money.Brl(Math.Max(0, input.Products.Amount + input.Freight.Amount + insurance.Amount + expenses.Amount - input.Discount.Amount));
        var state = string.IsNullOrWhiteSpace(input.DestinationState) ? null : input.DestinationState.Trim().ToUpperInvariant();
        UsdRateSnapshot? rate = usdToBrl is null
            ? null
            : new UsdRateSnapshot(usdToBrl.Numerator, usdToBrl.Denominator, usdToBrl.DisplayRate, usdToBrl.QuotedAt, usdToBrl.Source);

        if (settings.ImportTaxMode == ImportTaxMode.Flat || usdToBrl is null || usdToBrl.Numerator <= 0)
        {
            var flat = customs.MultiplyBasisPoints(settings.ImportTaxBasisPoints);
            return new ImportTaxBreakdown(
                ImportTaxRegime.Estimativa, input.Products, input.Freight, insurance, expenses, input.Discount, customs,
                rate is null ? null : ToUsdCents(customs, rate),
                flat, settings.ImportTaxBasisPoints, zero,
                zero, 0, state, zero, 0, zero, 0, zero, 0,
                flat, customs.Add(flat), rate, ExceedsSimplifiedLimit: false);
        }

        var usdCents = ToUsdCents(customs, rate!);
        Money duty;
        Money deduction = zero;
        int dutyBasisPoints;
        if (usdCents <= LowTierLimitUsdCents)
        {
            dutyBasisPoints = LowTierBasisPoints;
            duty = customs.MultiplyBasisPoints(LowTierBasisPoints);
        }
        else
        {
            dutyBasisPoints = HighTierBasisPoints;
            deduction = Money.Brl(Money.RoundDiv(HighTierDeductionUsdCents * rate!.Numerator, rate.Denominator));
            var gross = customs.MultiplyBasisPoints(HighTierBasisPoints);
            deduction = Money.Brl(Math.Min(deduction.Amount, gross.Amount));
            duty = gross.Subtract(deduction);
        }

        var icmsBasisPoints = settings.IcmsBasisPointsFor(state);
        var icmsBase = customs.Amount + duty.Amount;
        // ICMS por dentro: base / (1 − alíquota) − base.
        var icms = Money.Brl(icmsBasisPoints <= 0 || icmsBase <= 0
            ? 0
            : Math.Max(0, Money.RoundDiv(icmsBase * 10_000, 10_000 - icmsBasisPoints) - icmsBase));
        var ibsCbsBase = Money.Brl(icmsBase);
        var ibsState = ibsCbsBase.MultiplyBasisPoints(settings.IbsStateBasisPoints);
        var ibsMunicipal = ibsCbsBase.MultiplyBasisPoints(settings.IbsMunicipalBasisPoints);
        var cbs = ibsCbsBase.MultiplyBasisPoints(settings.CbsBasisPoints);
        var totalTaxes = Money.Sum([duty, icms, ibsState, ibsMunicipal, cbs]);

        return new ImportTaxBreakdown(
            ImportTaxRegime.RemessaConforme, input.Products, input.Freight, insurance, expenses, input.Discount, customs, usdCents,
            duty, dutyBasisPoints, deduction,
            icms, icmsBasisPoints, state,
            ibsState, settings.IbsStateBasisPoints, ibsMunicipal, settings.IbsMunicipalBasisPoints,
            cbs, settings.CbsBasisPoints,
            totalTaxes, customs.Add(totalTaxes), rate,
            ExceedsSimplifiedLimit: usdCents > SimplifiedRegimeLimitUsdCents);
    }

    private static long ToUsdCents(Money brl, UsdRateSnapshot rate) =>
        rate.Numerator <= 0 ? 0 : Money.RoundDiv(brl.Amount * rate.Denominator, rate.Numerator);
}
