namespace Marketplace.Domain.Common;

public enum CurrencyCode
{
    BRL,
    PYG,
    USD,
}

/// <summary>Valor monetário em unidades mínimas (BRL/USD: centavos; PYG: guaranis). Nunca float.</summary>
public readonly record struct Money(long Amount, CurrencyCode Currency)
{
    public static Money Brl(long amount) => new(amount, CurrencyCode.BRL);
    public static Money Pyg(long amount) => new(amount, CurrencyCode.PYG);
    public static readonly Money ZeroBrl = new(0, CurrencyCode.BRL);

    public static int MinorDigits(CurrencyCode currency) => currency == CurrencyCode.PYG ? 0 : 2;

    public Money Add(Money other)
    {
        AssertSameCurrency(other);
        return this with { Amount = Amount + other.Amount };
    }

    public Money Subtract(Money other)
    {
        AssertSameCurrency(other);
        return this with { Amount = Amount - other.Amount };
    }

    public Money Multiply(long factor) => this with { Amount = Amount * factor };

    /// <summary>Aplica basis points (10000 = 100%) com arredondamento half-up.</summary>
    public Money MultiplyBasisPoints(long basisPoints) =>
        this with { Amount = RoundDiv(Amount * basisPoints, 10_000) };

    public static Money Sum(IEnumerable<Money> values, CurrencyCode currency = CurrencyCode.BRL)
    {
        var total = new Money(0, currency);
        foreach (var v in values) total = total.Add(v);
        return total;
    }

    /// <summary>Converte com fração exata: round(amount × numerator / denominator).</summary>
    public Money Convert(CurrencyCode from, CurrencyCode to, long numerator, long denominator)
    {
        if (Currency != from)
            throw new InvalidOperationException($"Taxa {from}->{to} não se aplica a {Currency}.");
        return new Money(RoundDiv(Amount * numerator, denominator), to);
    }

    /// <summary>Divisão inteira com arredondamento half-up (equivale a Math.round no JS para positivos).</summary>
    public static long RoundDiv(long numerator, long denominator)
    {
        if (denominator <= 0) throw new ArgumentOutOfRangeException(nameof(denominator));
        if (numerator >= 0) return (numerator + denominator / 2) / denominator;
        return -RoundDiv(-numerator, denominator);
    }

    /// <summary>Parcela arredondada para cima (última parcela absorve a diferença no front).</summary>
    public Money InstallmentAmount(int installments)
    {
        if (installments <= 0) throw new ArgumentOutOfRangeException(nameof(installments));
        return this with { Amount = (Amount + installments - 1) / installments };
    }

    private void AssertSameCurrency(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException($"Moedas diferentes: {Currency} vs {other.Currency}.");
    }
}
