using System.Globalization;
using System.Text;
using Marketplace.Domain.Common;

namespace Marketplace.Domain.Compliance;

/// <summary>
/// NCM (Nomenclatura Comum do Mercosul). A existência do código é conferida na tabela oficial do Siscomex
/// (<c>INcmCatalog</c>); aqui ficam as regras que não dependem dela: formato, capítulos proibidos em remessa e
/// capítulos esperados para cada categoria da loja.
/// </summary>
public static class Ncm
{
    /// <summary>Capítulos que não podem ser vendidos por remessa nesta plataforma, com o motivo.</summary>
    public static readonly IReadOnlyDictionary<string, string> ProhibitedChapters = new Dictionary<string, string>
    {
        ["24"] = "Tabaco e cigarros não podem ser importados por remessa.",
        ["30"] = "Medicamentos dependem de autorização da Anvisa e não são vendidos aqui.",
        ["36"] = "Pólvoras, explosivos e fogos de artifício são proibidos em remessa.",
        ["93"] = "Armas e munições são proibidas em remessa.",
    };

    /// <summary>Capítulos aceitos por categoria (slug). Categoria fora do mapa aceita qualquer capítulo permitido.</summary>
    public static readonly IReadOnlyDictionary<string, string[]> CategoryChapters = new Dictionary<string, string[]>
    {
        ["eletronicos"] = ["84", "85", "90", "91", "95"],
        ["perfumes"] = ["33", "34"],
        ["informatica"] = ["84", "85", "90"],
        ["celulares"] = ["84", "85", "39", "40", "42", "70", "90"],
        ["bebidas"] = ["20", "21", "22"],
        ["casa"] = ["39", "44", "63", "69", "70", "73", "76", "82", "84", "85", "94"],
        ["esportes"] = ["42", "61", "62", "63", "64", "65", "85", "87", "89", "90", "91", "95"],
        ["moda"] = ["42", "43", "61", "62", "63", "64", "65", "71", "90", "91"],
    };

    /// <summary>Somente dígitos; nulo quando vazio.</summary>
    public static string? Normalize(string? raw)
    {
        var digits = Documents.OnlyDigits(raw);
        return digits.Length == 0 ? null : digits;
    }

    /// <summary>8 dígitos e capítulo de 01 a 97.</summary>
    public static bool IsWellFormed(string? code) =>
        code is { Length: 8 } && code.All(char.IsAsciiDigit) && int.Parse(code[..2], CultureInfo.InvariantCulture) is >= 1 and <= 97;

    public static string Chapter(string code) => code[..2];

    /// <summary>"85171300" → "8517.13.00".</summary>
    public static string Format(string code) =>
        code.Length == 8 ? $"{code[..4]}.{code[4..6]}.{code[6..]}" : code;

    public static string? ProhibitionReason(string code) =>
        ProhibitedChapters.TryGetValue(Chapter(code), out var reason) ? reason : null;

    public static bool MatchesCategory(string categorySlug, string code) =>
        !CategoryChapters.TryGetValue(categorySlug, out var chapters) || chapters.Contains(Chapter(code));
}

/// <summary>Faixas e ciclo de apuração dos indicadores (Portaria Coana 193/2026).</summary>
public static class ComplianceBands
{
    /// <summary>Limites em centésimos de ponto percentual (9970 = 99,70%).</summary>
    public const int Gold = 9970;
    public const int Silver = 9940;
    public const int Bronze = 9900;
    public const int Warning = 9800;
    /// <summary>Selo só sai para quem movimentou ao menos 100 mil remessas no ciclo (julho a junho).</summary>
    public const int SealMinimumShipments = 100_000;

    /// <summary>Proporção de remessas sem ocorrência, em centésimos de %; 10000 quando não houve remessa.</summary>
    public static int CompliancePermyriad(int shipments, int occurrences)
    {
        if (shipments <= 0) return 10_000;
        var clean = Math.Max(0, shipments - occurrences);
        return (int)Math.Floor(clean * 10_000.0 / shipments);
    }

    public static ComplianceBand BandOf(int permyriad) => permyriad switch
    {
        >= Gold => ComplianceBand.Ouro,
        >= Silver => ComplianceBand.Prata,
        >= Bronze => ComplianceBand.Bronze,
        >= Warning => ComplianceBand.Advertencia,
        _ => ComplianceBand.Exclusao,
    };

    /// <summary>Consequência prevista para a faixa.</summary>
    public static string Consequence(ComplianceBand band) => band switch
    {
        ComplianceBand.Ouro => "Monitoramento ordinário.",
        ComplianceBand.Prata => "Comunicação para aprimorar controles internos.",
        ComplianceBand.Bronze => "Monitoramento reforçado e plano de ação em 30 dias.",
        ComplianceBand.Advertencia => "Advertência e plano de ação em 30 dias.",
        _ => "Procedimento de exclusão do programa, com contraditório.",
    };

    /// <summary>Ano em que começa o ciclo (julho) que contém a data. Ex.: 10/2026 → 2026; 03/2027 → 2026.</summary>
    public static int CycleStartYear(DateTime date) => date.Month >= 7 ? date.Year : date.Year - 1;

    public static (DateTime Start, DateTime End) CycleRange(int startYear) =>
        (new DateTime(startYear, 7, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(startYear + 1, 7, 1, 0, 0, 0, DateTimeKind.Utc));
}

/// <summary>Marcas protegidas (risco de contrafação): procura a marca como palavra inteira, sem acento e sem caixa.</summary>
public static class BrandWatch
{
    public static string? FindProtectedBrand(string? text, IEnumerable<string> brands)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var haystack = $" {Fold(text)} ";
        foreach (var brand in brands)
        {
            var needle = Fold(brand);
            if (needle.Length >= 2 && haystack.Contains($" {needle} ", StringComparison.Ordinal)) return brand;
        }
        return null;
    }

    private static string Fold(string text)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : ' ');
        }
        return string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }
}

/// <summary>Código de objeto postal UPU S10 (ex.: LB123456785PY): 2 letras + 8 dígitos + dígito verificador + país.</summary>
public static class S10
{
    private static readonly int[] Weights = [8, 6, 4, 2, 3, 5, 9, 7];

    public static string Build(string serviceIndicator, long serial, string country)
    {
        if (serviceIndicator.Length != 2 || country.Length != 2) throw new ArgumentException("Indicador de serviço e país têm 2 letras.");
        var digits = (serial % 100_000_000).ToString("D8", CultureInfo.InvariantCulture);
        return $"{serviceIndicator.ToUpperInvariant()}{digits}{CheckDigit(digits)}{country.ToUpperInvariant()}";
    }

    public static bool IsValid(string? code) =>
        code is { Length: 13 } && char.IsAsciiLetter(code[0]) && char.IsAsciiLetter(code[1]) &&
        code[2..11].All(char.IsAsciiDigit) && char.IsAsciiLetter(code[11]) && char.IsAsciiLetter(code[12]) &&
        CheckDigit(code[2..10]) == code[10] - '0';

    public static int CheckDigit(string eightDigits)
    {
        var sum = 0;
        for (var i = 0; i < 8; i++) sum += (eightDigits[i] - '0') * Weights[i];
        var check = 11 - sum % 11;
        return check switch { 10 => 0, 11 => 5, _ => check };
    }
}
