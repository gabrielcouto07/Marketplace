using System.Globalization;
using System.Text;

namespace Marketplace.Domain.Compliance;

/// <summary>Texto normalizado para comparação: minúsculo, sem acento e só letras/dígitos separados por um espaço.</summary>
public static class TextFold
{
    public static string Fold(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(char.IsLetterOrDigit(c) ? char.ToLowerInvariant(c) : ' ');
        }
        return string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    /// <summary>Palavra ou expressão inteira (já normalizada) dentro do texto normalizado.</summary>
    public static bool ContainsPhrase(string foldedText, string foldedPhrase) =>
        foldedPhrase.Length > 0 && $" {foldedText} ".Contains($" {foldedPhrase} ", StringComparison.Ordinal);
}

/// <summary>Bloqueio impede a publicação; análise tira o anúncio da vitrine até a equipe decidir.</summary>
public enum RestrictionLevel
{
    Bloqueio,
    Analise,
}

/// <param name="AnnexItem">Letra do item do Anexo I da Política de Vendedores (a a p).</param>
/// <param name="Term">Termo encontrado no anúncio (só nas restrições por texto).</param>
public sealed record RestrictionHit(RestrictionLevel Level, string AnnexItem, string Reason, string? Term = null);

/// <summary>
/// Anexo I da Política de Admissão e de Monitoramento de Vendedores: produtos de oferta vedada. O NCM decide o que é
/// bloqueado de vez (posições sem exceção, ex.: 22.08 destilados); termos no anúncio mandam para análise, porque uma
/// palavra sozinha engana ("taça de vinho", "cor vinho", "pode ser usado").
/// </summary>
public static class ProhibitedGoods
{
    public sealed record AnnexEntry(string Letter, string Title);

    /// <summary>Itens do Anexo I, na ordem e com o texto da Política.</summary>
    public static readonly IReadOnlyList<AnnexEntry> Annex =
    [
        new("a", "armas de fogo, suas peças, munições, explosivos e agentes de guerra química"),
        new("b", "brinquedos, réplicas e simulacros de armas de fogo que com elas se possam confundir"),
        new("c", "substâncias entorpecentes ou drogas afins"),
        new("d", "cigarro eletrônico"),
        new("e", "cigarros, fumo e produtos de tabacaria"),
        new("f", "bebidas alcoólicas"),
        new("g", "produtos cuja importação dependa de autorização de órgão de controle sanitário, metrológico, de segurança pública ou ambiental, sem essa autorização"),
        new("h", "animais e vegetais da vida silvestre, espécies ameaçadas de extinção e seus derivados, e animal morto"),
        new("i", "bens usados ou recondicionados"),
        new("j", "diamantes"),
        new("k", "dinheiro em espécie"),
        new("l", "substâncias perecíveis, como alimentos de origem animal e frutas"),
        new("m", "resíduos e rejeitos sólidos perigosos, poluentes orgânicos persistentes e produtos que destroem a camada de ozônio"),
        new("n", "mercadorias atentatórias à moral, aos bons costumes, à saúde ou à ordem pública"),
        new("o", "produtos contrafeitos ou que infrinjam direito de propriedade intelectual"),
        new("p", "bens cujo transporte seja proibido pelos Correios"),
    ];

    /// <summary>Prefixos de NCM (capítulo, posição ou subposição) sem exceção possível: o anúncio não é publicado.</summary>
    private static readonly (string Prefix, string Item, string Reason)[] BlockedNcm =
    [
        ("93", "a", "Armas, munições e suas partes não podem ser vendidas."),
        ("3601", "a", "Pólvoras não podem ser vendidas."),
        ("3602", "a", "Explosivos não podem ser vendidos."),
        ("3603", "a", "Estopins, detonadores e cápsulas fulminantes não podem ser vendidos."),
        ("12113", "c", "Folha de coca não pode ser vendida."),
        ("12114", "c", "Palha de papoula não pode ser vendida."),
        ("130211", "c", "Ópio não pode ser vendido."),
        ("293911", "c", "Alcaloides do ópio não podem ser vendidos."),
        ("293971", "c", "Cocaína e derivados não podem ser vendidos."),
        ("854340", "d", "Cigarros eletrônicos e vaporizadores não podem ser vendidos."),
        ("24", "e", "Cigarros, fumo e produtos com nicotina não podem ser vendidos."),
        ("9614", "e", "Cachimbos, narguilés e piteiras (tabacaria) não podem ser vendidos."),
        ("2203", "f", "Bebidas alcoólicas não podem ser vendidas (cerveja)."),
        ("2204", "f", "Bebidas alcoólicas não podem ser vendidas (vinho)."),
        ("2205", "f", "Bebidas alcoólicas não podem ser vendidas (vermute)."),
        ("2206", "f", "Bebidas alcoólicas não podem ser vendidas (fermentados)."),
        ("2207", "f", "Álcool etílico não pode ser vendido."),
        ("2208", "f", "Bebidas alcoólicas não podem ser vendidas (destilados e licores)."),
        ("30", "g", "Medicamentos dependem de autorização da Anvisa e não são vendidos aqui."),
        ("3808", "g", "Agrotóxicos e saneantes dependem de registro (Anvisa, Mapa, Ibama) e não são vendidos aqui."),
        ("1209", "g", "Sementes para semeadura dependem de autorização fitossanitária e não são vendidas aqui."),
        ("01", "h", "Animais vivos não podem ser vendidos."),
        ("06", "h", "Plantas vivas não podem ser vendidas."),
        ("0507", "h", "Marfim, carapaças de tartaruga e chifres não podem ser vendidos."),
        ("0508", "h", "Corais e conchas não podem ser vendidos."),
        ("9705", "h", "Peças de coleção de interesse zoológico, botânico ou arqueológico não podem ser vendidas."),
        ("6309", "i", "Artigos têxteis usados não podem ser vendidos."),
        ("4012", "i", "Pneus usados ou recauchutados não podem ser vendidos."),
        ("7102", "j", "Diamantes não podem ser vendidos."),
        ("4907", "k", "Papel-moeda, cheques e títulos não podem ser vendidos."),
        ("7118", "k", "Moedas não podem ser vendidas."),
        ("02", "l", "Carnes são perecíveis e não podem ser vendidas."),
        ("03", "l", "Peixes e frutos do mar são perecíveis e não podem ser vendidos."),
        ("04", "l", "Laticínios, ovos e mel são perecíveis e não podem ser vendidos."),
        ("07", "l", "Hortaliças são perecíveis e não podem ser vendidas."),
        ("08", "l", "Frutas são perecíveis e não podem ser vendidas."),
        ("16", "l", "Preparações de carne e de pescado são perecíveis e não podem ser vendidas."),
        ("2524", "m", "Amianto não pode ser vendido."),
        ("29037", "m", "Gases que destroem a camada de ozônio (HCFC) não podem ser vendidos."),
        ("3825", "m", "Resíduos químicos não podem ser vendidos."),
        ("8549", "m", "Sucata e resíduos elétricos e eletrônicos não podem ser vendidos."),
        ("2711", "p", "Gases inflamáveis não podem ser enviados pelos Correios."),
        ("2844", "p", "Material radioativo não pode ser enviado pelos Correios."),
        ("2845", "p", "Isótopos não podem ser enviados pelos Correios."),
        ("3604", "p", "Fogos de artifício não podem ser enviados pelos Correios."),
        ("3605", "p", "Fósforos não podem ser enviados pelos Correios."),
        ("3606", "p", "Combustíveis para isqueiro e artigos inflamáveis não podem ser enviados pelos Correios."),
        ("3813", "p", "Cargas de extintores não podem ser enviadas pelos Correios."),
        ("842410", "p", "Extintores pressurizados não podem ser enviados pelos Correios."),
        ("9613", "p", "Isqueiros não podem ser enviados pelos Correios."),
    ];

    /// <summary>Prefixos de NCM que pedem conferência da equipe antes da vitrine.</summary>
    private static readonly (string Prefix, string Item, string Reason)[] ReviewNcm =
    [
        ("9503", "b", "Brinquedo: a equipe confere se não é réplica ou simulacro de arma de fogo."),
        ("2106", "g", "Preparação alimentícia ou suplemento: a equipe confere se depende de registro na Anvisa."),
        ("2936", "g", "Vitaminas: a equipe confere se dependem de registro na Anvisa."),
        ("9018", "g", "Aparelho médico: a equipe confere o registro na Anvisa."),
        ("9019", "g", "Aparelho de terapia: a equipe confere o registro na Anvisa."),
        ("9021", "g", "Artigo ortopédico: a equipe confere o registro na Anvisa."),
        ("9022", "g", "Aparelho de raios X: a equipe confere as autorizações."),
        ("4301", "h", "Peles: a equipe confere se não são de animal silvestre."),
        ("4302", "h", "Peles: a equipe confere se não são de animal silvestre."),
        ("4303", "h", "Artigos de peles: a equipe confere se não são de animal silvestre."),
        ("7113", "j", "Joia: a equipe confere se não tem diamantes."),
        ("2710", "p", "Óleos e combustíveis: a equipe confere as restrições de transporte dos Correios."),
        ("8506", "p", "Pilhas avulsas: a equipe confere as restrições dos Correios para baterias de lítio."),
        ("8507", "p", "Baterias avulsas: a equipe confere as restrições dos Correios para baterias de lítio."),
    ];

    /// <param name="TitleOnly">Termo ambíguo: só vale no nome, na natureza e no material (na descrição gera falso alarme).</param>
    private sealed record Term(string Phrase, string Item, bool TitleOnly = false);

    private static readonly Term[] Terms =
    [
        // a) armas e explosivos
        new("arma de fogo", "a"), new("revolver", "a", true), new("fuzil", "a"), new("municao", "a"), new("municoes", "a"),
        new("polvora", "a"), new("explosivo", "a"), new("explosivos", "a"), new("granada", "a", true),
        // b) réplicas de armas
        new("airsoft", "b"), new("simulacro", "b"), new("arma de brinquedo", "b"), new("replica de arma", "b"),
        new("arma de pressao", "b"), new("arma de chumbinho", "b"),
        // c) entorpecentes
        new("maconha", "c"), new("cannabis", "c"), new("thc", "c", true), new("cbd", "c", true), new("cocaina", "c"),
        new("anabolizante", "c"), new("esteroide", "c"), new("sibutramina", "c"),
        // d) cigarro eletrônico
        new("vape", "d"), new("vaper", "d"), new("pod descartavel", "d"), new("cigarro eletronico", "d"), new("e cig", "d"),
        new("essencia para pod", "d"), new("juice para vape", "d"),
        // e) tabacaria
        new("cigarro", "e", true), new("cigarros", "e", true), new("tabaco", "e"), new("fumo", "e", true), new("charuto", "e"),
        new("narguile", "e"), new("tabacaria", "e"), new("piteira", "e"),
        // f) bebidas alcoólicas
        new("whisky", "f"), new("whiskey", "f"), new("uisque", "f"), new("vodka", "f"), new("vodca", "f"), new("tequila", "f"),
        new("cachaca", "f"), new("conhaque", "f"), new("aguardente", "f"), new("bebida alcoolica", "f"), new("gin", "f", true),
        new("rum", "f", true), new("licor", "f", true), new("vinho", "f", true), new("espumante", "f", true),
        new("champagne", "f", true), new("cerveja", "f", true), new("sake", "f", true),
        // g) depende de autorização
        new("medicamento", "g", true), new("remedio", "g", true), new("antibiotico", "g"), new("agrotoxico", "g"),
        new("pesticida", "g"),
        // h) vida silvestre
        new("marfim", "h"), new("casco de tartaruga", "h"), new("animal empalhado", "h"), new("taxidermia", "h"),
        new("especie ameacada", "h"), new("pele de onca", "h"),
        // i) usados e recondicionados
        new("usado", "i", true), new("usada", "i", true), new("usados", "i", true), new("seminovo", "i"), new("seminova", "i"),
        new("semi novo", "i"), new("recondicionado", "i"), new("recondicionada", "i"), new("refurbished", "i"),
        new("remanufaturado", "i"), new("open box", "i"), new("segunda mao", "i"), new("de vitrine", "i"), new("mostruario", "i"),
        // j) diamantes
        new("diamante", "j"), new("diamantes", "j"),
        // k) dinheiro
        new("papel moeda", "k"), new("cedulas", "k", true), new("moedas antigas", "k"), new("dinheiro em especie", "k"),
        // l) perecíveis
        new("carne", "l", true), new("queijo", "l", true), new("salame", "l", true), new("presunto", "l", true),
        new("fruta fresca", "l"), new("frutas frescas", "l"), new("frutos do mar", "l"), new("pescado", "l", true),
        // m) resíduos e camada de ozônio
        new("sucata", "m"), new("residuo", "m", true), new("residuos", "m", true), new("amianto", "m"), new("gas refrigerante", "m"),
        // n) moral, saúde e ordem pública
        new("pornografico", "n"), new("pornografia", "n"), new("conteudo adulto", "n"), new("nazista", "n"), new("suastica", "n"),
        // o) contrafação
        new("replica", "o"), new("primeira linha", "o"), new("aaa", "o", true), new("contratipo", "o"), new("inspirado no", "o"),
        new("inspirado em", "o"), new("inspirada no", "o"), new("similar ao original", "o"), new("tipo original", "o"),
        new("copia", "o", true), new("falsificado", "o"), new("fake", "o", true), new("pirata", "o", true),
        // p) proibido pelos Correios
        new("aerossol", "p"), new("aerosol", "p"), new("inflamavel", "p"), new("isqueiro", "p"), new("fogos de artificio", "p"),
        new("power bank", "p"), new("powerbank", "p"), new("bateria externa", "p"), new("bateria de litio avulsa", "p"),
    ];

    public static string AnnexTitle(string letter) =>
        Annex.FirstOrDefault(a => a.Letter == letter)?.Title ?? letter;

    /// <summary>Primeira restrição do NCM: bloqueio antes de análise.</summary>
    public static RestrictionHit? CheckNcm(string? ncm)
    {
        if (string.IsNullOrWhiteSpace(ncm)) return null;
        foreach (var (prefix, item, reason) in BlockedNcm)
            if (ncm.StartsWith(prefix, StringComparison.Ordinal))
                return new RestrictionHit(RestrictionLevel.Bloqueio, item, $"{reason} (Anexo I, {item}, da Política de Vendedores)");
        foreach (var (prefix, item, reason) in ReviewNcm)
            if (ncm.StartsWith(prefix, StringComparison.Ordinal))
                return new RestrictionHit(RestrictionLevel.Analise, item, $"{reason} (Anexo I, {item})");
        return null;
    }

    /// <summary>
    /// Termos de oferta vedada no anúncio. <paramref name="title"/> = nome, natureza e material (vale tudo);
    /// <paramref name="body"/> = descrição (só termos inequívocos).
    /// </summary>
    public static RestrictionHit? CheckText(string? title, string? body)
    {
        var t = TextFold.Fold(title);
        var b = TextFold.Fold(body);
        foreach (var term in Terms)
        {
            var hit = TextFold.ContainsPhrase(t, term.Phrase) || (!term.TitleOnly && TextFold.ContainsPhrase(b, term.Phrase));
            if (!hit) continue;
            return new RestrictionHit(RestrictionLevel.Analise, term.Item,
                $"O anúncio cita \"{term.Phrase}\", que indica produto de oferta vedada ({AnnexTitle(term.Item)} — Anexo I, {term.Item}). A equipe confere antes de publicar.",
                term.Phrase);
        }
        return null;
    }
}
