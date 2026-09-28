using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Marketplace.Domain.Common;

public static partial class Slug
{
    /// <summary>Mesmo algoritmo do front: NFD sem acentos, minúsculas, sem aspas, hífens.</summary>
    public static string From(string input)
    {
        var normalized = input.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark) sb.Append(ch);
        }
        var s = sb.ToString().ToLowerInvariant();
        s = Quotes().Replace(s, string.Empty);
        s = NonAlnum().Replace(s, "-");
        return s.Trim('-');
    }

    /// <summary>Texto para busca: minúsculo e sem acentos.</summary>
    public static string Normalize(string input)
    {
        var normalized = input.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark) sb.Append(ch);
        }
        return sb.ToString().ToLowerInvariant();
    }

    [GeneratedRegex("[\"']")]
    private static partial Regex Quotes();

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonAlnum();
}
