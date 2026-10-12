using System.Text;

namespace Marketplace.Domain.Compliance;

/// <summary>
/// Prazos do Programa de Conformidade Tributária e Aduaneira e da Política de Admissão e de Monitoramento de Vendedores.
/// </summary>
public static class ProgramDeadlines
{
    /// <summary>Vendedor corrige dados (8.4) ou responde a uma medida (8.6) em 10 dias.</summary>
    public const int SellerResponseDays = 10;
    /// <summary>Notificação do canal de denúncias decidida em até 2 dias úteis (Política 6.5).</summary>
    public const int ReportDecisionBusinessDays = 2;
    /// <summary>Plano de ação pedido pela Receita entregue em 30 dias (Programa 11.4).</summary>
    public const int ActionPlanDays = 30;
    /// <summary>Inconformidades de notificação da Receita saneadas em 30 dias (11.5).</summary>
    public const int CorrectiveNotificationDays = 30;
    /// <summary>Reclamação da ouvidoria respondida em 5 dias úteis quando a Receita não fixar prazo (12.2).</summary>
    public const int OmbudsmanBusinessDays = 5;
    /// <summary>Nova infração nos 12 meses seguintes à anterior = reincidência (Política 8.3).</summary>
    public const int RecidivismMonths = 12;
    /// <summary>Vendedor confirma os dados cadastrais a cada 12 meses (4.3).</summary>
    public const int DataConfirmationMonths = 12;
    /// <summary>Capacitação no início da função e a cada 12 meses (Programa 13.1).</summary>
    public const int TrainingMonths = 12;
    /// <summary>Auditoria dos vendedores a cada 12 meses (Política 7.4).</summary>
    public const int AuditMonths = 12;
    /// <summary>Registros das operações conservados por 5 anos, contados da data do pedido (Programa 10.4).</summary>
    public const int RecordRetentionYears = 5;
    /// <summary>Janela do fracionamento: pedidos do mesmo comprador e endereço em até 7 dias (Programa 6.4).</summary>
    public const int FractioningWindowDays = 7;

    /// <summary>Período de manifestação sobre o ciclo anual: 1º a 31 de outubro (11.8). Fim exclusivo.</summary>
    public static (DateTime Start, DateTime End) AnnualManifestationWindow(int year) =>
        (new DateTime(year, 10, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(year, 11, 1, 0, 0, 0, DateTimeKind.Utc));

    /// <summary>Soma dias úteis (segunda a sexta).</summary>
    public static DateTime AddBusinessDays(DateTime start, int businessDays)
    {
        var date = start;
        var remaining = businessDays;
        while (remaining > 0)
        {
            date = date.AddDays(1);
            if (date.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday)) remaining--;
        }
        return date;
    }
}

/// <summary>
/// Descrição da mercadoria na declaração (Programa 7.4): natureza, marca e modelo (quando houver), material e quantidade,
/// sem expressões genéricas.
/// </summary>
public static class DeclarationText
{
    public const int MaxLength = 400;

    /// <summary>Palavras que, sozinhas, não dizem o que o produto é ("Presente", "Acessórios", "Produto eletrônico").</summary>
    private static readonly HashSet<string> GenericWords =
    [
        "produto", "produtos", "item", "itens", "mercadoria", "mercadorias", "presente", "presentes", "amostra", "amostras",
        "diversos", "diversas", "variados", "variadas", "sortidos", "acessorio", "acessorios", "eletronico", "eletronicos",
        "eletronica", "eletronicas", "peca", "pecas", "roupa", "roupas", "brinquedo", "brinquedos", "objeto", "objetos", "artigo",
        "artigos", "coisa", "coisas", "kit", "kits", "outro", "outros", "outra", "outras", "utilidade", "utilidades", "utensilio",
        "utensilios", "material", "materiais", "pacote", "pacotes", "encomenda", "generico", "generica", "importado", "importados",
        "gift", "gifts", "sample", "samples", "goods", "stuff", "parts", "accessories", "clothes", "electronics", "toys", "misc",
        "regalo", "regalos", "varios", "varias", "mercaderia", "mercaderias", "producto", "productos",
    ];

    private static readonly HashSet<string> Connectors =
    [
        "de", "da", "do", "das", "dos", "e", "para", "com", "em", "a", "o", "as", "os", "um", "uma", "no", "na", "nos", "nas",
        "y", "el", "la", "los", "las", "con", "en", "del", "of", "and", "for", "the",
    ];

    /// <summary>Natureza sem nenhuma palavra que diga o que o produto é.</summary>
    public static bool IsGeneric(string? nature)
    {
        var words = TextFold.Fold(nature).Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length > 1 && !Connectors.Contains(w) && !w.All(char.IsAsciiDigit))
            .ToList();
        return words.Count == 0 || words.All(GenericWords.Contains);
    }

    /// <summary>
    /// "Fone de ouvido Bluetooth, marca X, modelo Y, variação: Preto, material: plástico e espuma, quantidade: 1 un.".
    /// Sem marca (produto que não tem marca), o texto diz "sem marca".
    /// </summary>
    public static string Build(string nature, string? brand, string? model, string material, int quantity, string? variant = null)
    {
        var sb = new StringBuilder(nature.Trim());
        sb.Append(string.IsNullOrWhiteSpace(brand) ? ", sem marca" : $", marca {brand.Trim()}");
        if (!string.IsNullOrWhiteSpace(model)) sb.Append($", modelo {model.Trim()}");
        if (!string.IsNullOrWhiteSpace(variant)) sb.Append($", variação: {variant.Trim()}");
        sb.Append($", material: {material.Trim()}");
        sb.Append($", quantidade: {Math.Max(1, quantity)} un.");
        var text = sb.ToString();
        return text.Length <= MaxLength ? text : text[..MaxLength];
    }
}

/// <summary>Países (ISO 3166-1 alfa-2) para o país de origem da mercadoria (Programa 7.6).</summary>
public static class Countries
{
    private static readonly HashSet<string> Codes =
    [
        "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE",
        "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD",
        "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM",
        "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
        "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU",
        "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN",
        "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME",
        "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
        "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM",
        "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI",
        "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK",
        "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
        "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
    ];

    public static string? Normalize(string? code) =>
        string.IsNullOrWhiteSpace(code) ? null : code.Trim().ToUpperInvariant();

    public static bool IsValid(string? code) => Normalize(code) is { Length: 2 } c && Codes.Contains(c);
}

/// <summary>Nome do titular do CPF conferido com o nome informado pelo destinatário (Programa 7.2).</summary>
public static class PersonName
{
    private static readonly HashSet<string> Particles = ["de", "da", "do", "das", "dos", "e", "del", "la", "las", "los", "y", "di", "van", "von"];

    private static List<string> Tokens(string? name) =>
        TextFold.Fold(name).Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(t => !Particles.Contains(t)).ToList();

    /// <summary>
    /// Mesmo primeiro e último nome do cadastro; os nomes do meio informados aparecem no cadastro, na ordem, por extenso
    /// ou pela inicial ("Maria A. Souza" confere com "Maria Aparecida de Souza"). Pede pelo menos nome e sobrenome.
    /// </summary>
    public static bool Matches(string? registry, string? informed)
    {
        var r = Tokens(registry);
        var i = Tokens(informed);
        if (r.Count == 0 || i.Count < 2) return false;
        if (r[0] != i[0] || r[^1] != i[^1]) return false;
        var pos = 1;
        foreach (var token in i.Skip(1).Take(i.Count - 2))
        {
            var found = false;
            while (pos < r.Count - 1)
            {
                var candidate = r[pos++];
                if (candidate == token || (token.Length == 1 && candidate[0] == token[0]))
                {
                    found = true;
                    break;
                }
            }
            if (!found) return false;
        }
        return true;
    }
}

/// <summary>
/// Indício de fracionamento (Programa 6.4): dois ou mais pedidos do mesmo comprador, para o mesmo endereço, em até 7 dias,
/// cuja soma muda a faixa de tributação de algum deles (US$ 50) ou passa do limite do regime simplificado (US$ 3.000).
/// </summary>
public static class Fractioning
{
    private static int Tier(long usdCents) =>
        usdCents <= ImportTaxCalculator.LowTierLimitUsdCents ? 0 : usdCents <= ImportTaxCalculator.SimplifiedRegimeLimitUsdCents ? 1 : 2;

    public static bool IsIndication(IReadOnlyList<long> customsValuesUsdCents)
    {
        if (customsValuesUsdCents.Count < 2) return false;
        var sumTier = Tier(customsValuesUsdCents.Sum());
        return customsValuesUsdCents.Any(v => Tier(v) != sumTier);
    }

    /// <summary>Chave do endereço de entrega: CEP + número + complemento, normalizados.</summary>
    public static string AddressKey(string postalCode, string number, string? complement) =>
        $"{new string(postalCode.Where(char.IsAsciiDigit).ToArray())}|{TextFold.Fold(number)}|{TextFold.Fold(complement)}";
}

/// <summary>Graduação das medidas da Política (8.2): gravidade, número de infrações e intenção.</summary>
public static class MeasureGuide
{
    /// <param name="priorInfractions">Infrações do vendedor nos 12 meses anteriores (reincidência, 8.3).</param>
    /// <param name="hasProduct">A infração é de um anúncio (a remoção dele resolve o caso leve).</param>
    public static (SellerMeasureType Type, int? SuspensionDays) Recommend(InfractionSeverity severity, int priorInfractions, bool intentional, bool hasProduct)
    {
        if (severity == InfractionSeverity.Grave && (intentional || priorInfractions >= 1)) return (SellerMeasureType.Exclusao, null);
        if (priorInfractions >= 3) return (SellerMeasureType.Exclusao, null);
        if (severity == InfractionSeverity.Grave) return (SellerMeasureType.SuspensaoTemporaria, 90);
        if (priorInfractions >= 1 || intentional)
            return (SellerMeasureType.SuspensaoTemporaria, severity == InfractionSeverity.Media ? 30 : 15);
        if (hasProduct) return (SellerMeasureType.RemocaoAnuncio, null);
        return (SellerMeasureType.SuspensaoTemporaria, severity == InfractionSeverity.Media ? 15 : 7);
    }
}
