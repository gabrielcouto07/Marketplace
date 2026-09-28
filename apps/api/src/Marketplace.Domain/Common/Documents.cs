using System.Text.RegularExpressions;

namespace Marketplace.Domain.Common;

/// <summary>Validadores de documentos: CPF (comprador, BR), RUC (vendedor, PY) e CEP.</summary>
public static partial class Documents
{
    public static string OnlyDigits(string? value) =>
        value is null ? string.Empty : NonDigits().Replace(value, string.Empty);

    public static bool IsValidCpf(string? input)
    {
        var cpf = OnlyDigits(input);
        if (cpf.Length != 11) return false;
        if (cpf.Distinct().Count() == 1) return false;

        int Calc(int len)
        {
            var sum = 0;
            for (var i = 0; i < len; i++) sum += (cpf[i] - '0') * (len + 1 - i);
            var rest = sum * 10 % 11;
            return rest == 10 ? 0 : rest;
        }

        return Calc(9) == cpf[9] - '0' && Calc(10) == cpf[10] - '0';
    }

    /// <summary>RUC paraguaio: base de 1 a 8 dígitos + dígito verificador (módulo 11).</summary>
    public static bool IsValidRuc(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return false;
        var cleaned = RucNoise().Replace(input, string.Empty).ToUpperInvariant();
        var match = RucPattern().Match(cleaned);
        if (!match.Success) return false;
        var baseDigits = match.Groups[1].Value;
        var dv = match.Groups[2].Value[0] - '0';

        var k = 2;
        var total = 0;
        for (var i = baseDigits.Length - 1; i >= 0; i--)
        {
            if (k > 11) k = 2;
            total += (baseDigits[i] - '0') * k;
            k++;
        }
        var rest = total % 11;
        var expected = rest > 1 ? 11 - rest : 0;
        return expected == dv;
    }

    public static bool IsValidCep(string? input) => OnlyDigits(input).Length == 8;

    public static bool IsValidEmail(string? input)
    {
        if (string.IsNullOrWhiteSpace(input) || input.Length > 254) return false;
        return EmailPattern().IsMatch(input.Trim());
    }

    [GeneratedRegex(@"\D")]
    private static partial Regex NonDigits();

    [GeneratedRegex(@"[^\dkK-]")]
    private static partial Regex RucNoise();

    [GeneratedRegex(@"^(\d{1,8})-?(\d)$")]
    private static partial Regex RucPattern();

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();
}
