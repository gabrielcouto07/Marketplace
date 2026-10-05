using System.Globalization;
using System.Text;
using Marketplace.Application.Abstractions;
using Marketplace.Domain.Common;

namespace Marketplace.Infrastructure.RemessaConforme;

/// <summary>
/// Etiqueta 10 × 15 cm em PDF, sem dependências: marca, nome comercial e CNPJ/TIN da plataforma em destaque (Portaria
/// Coana 130/2023, art. 8º, III), remetente, destinatário, código de rastreio em Code 128 e o resumo da declaração.
/// </summary>
public static class LabelPdf
{
    private const float W = 283.46f; // 10 cm
    private const float H = 425.2f;  // 15 cm

    private static readonly Encoding WinAnsi = CreateWinAnsi();

    private static Encoding CreateWinAnsi()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        return Encoding.GetEncoding(1252);
    }
    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");

    public static byte[] Build(RemessaShipmentRequest r, string trackingCode, string carrier, string? declarationNumber, bool sandbox)
    {
        var c = new Canvas();
        var p = r.Platform;

        // Faixa da plataforma (identidade obrigatória no remetente).
        c.Fill(0, H - 58, W, 58, 0.06f, 0.11f, 0.24f);
        c.Text(12, H - 24, 15, bold: true, p.Brand.ToUpperInvariant(), white: true);
        c.Text(12, H - 37, 7.5f, false, $"{p.TradeName} · {p.DocumentType} {FormatDocument(p.DocumentType, p.Document)}", white: true);
        c.Text(12, H - 49, 7.5f, false, string.IsNullOrWhiteSpace(p.AdeNumber)
            ? "Remessa Conforme · tributos pagos na compra"
            : $"Remessa Conforme · ADE {p.AdeNumber} · tributos pagos na compra", white: true);
        if (sandbox)
        {
            c.Fill(W - 92, H - 50, 82, 18, 0.86f, 0.15f, 0.15f);
            c.Text(W - 86, H - 44, 8, true, "SANDBOX · NÃO POSTAR", white: true);
        }

        // Rastreio.
        var y = H - 72;
        c.Text(12, y, 7, false, $"{carrier} · pedido {r.OrderNumber}");
        y -= 44;
        Code128.Draw(c, trackingCode, 14, y, W - 28, 38);
        y -= 13;
        c.TextCentered(W / 2, y, 11, true, trackingCode);
        y -= 8;
        c.Line(10, y, W - 10, y);

        // Destinatário.
        y -= 13;
        c.Text(12, y, 7, true, "DESTINATÁRIO");
        y -= 13;
        c.Text(12, y, 10, true, Fit(r.Recipient.Name, 40));
        y -= 11;
        c.Text(12, y, 8, false, $"CPF {Mappers(r.Recipient.Document)}");
        foreach (var line in Wrap(r.Recipient.AddressLine, 52))
        {
            y -= 10;
            c.Text(12, y, 8, false, line);
        }
        y -= 11;
        c.Text(12, y, 9, true, $"CEP {FormatCep(r.Recipient.PostalCode)} · {r.Recipient.City}/{r.Recipient.State}");
        y -= 8;
        c.Line(10, y, W - 10, y);

        // Remetente (loja).
        y -= 13;
        c.Text(12, y, 7, true, "REMETENTE");
        y -= 11;
        c.Text(12, y, 8.5f, true, Fit($"{r.Sender.Name} · RUC {r.Sender.Document}", 52));
        foreach (var line in Wrap($"{r.Sender.AddressLine} · {r.Sender.City}, {r.Sender.Country}", 58).Take(2))
        {
            y -= 10;
            c.Text(12, y, 7.5f, false, line);
        }
        y -= 8;
        c.Line(10, y, W - 10, y);

        // Declaração.
        y -= 13;
        c.Text(12, y, 7, true, "DECLARAÇÃO ANTECIPADA");
        if (declarationNumber is not null) c.Text(W - 12 - Measure(declarationNumber, 7), y, 7, false, declarationNumber);
        y -= 11;
        var items = r.Items.Count == 1 ? $"1 item · NCM {Ncm(r.Items[0].Ncm)}" : $"{r.Items.Count} itens · NCM {string.Join(", ", r.Items.Select(i => Ncm(i.Ncm)).Distinct().Take(3))}";
        c.Text(12, y, 7.5f, false, Fit(items, 60));
        y -= 10;
        var usd = r.CustomsValueUsdCents is { } cents ? $" (US$ {(cents / 100m).ToString("N2", PtBr)})" : "";
        c.Text(12, y, 7.5f, false, $"Valor aduaneiro {Brl(r.CustomsValue)}{usd}");
        y -= 10;
        c.Text(12, y, 7.5f, false, $"II {Brl(r.Taxes.ImportDuty)} · ICMS {Brl(r.Taxes.Icms)} · IBS {Brl(r.Taxes.IbsState.Add(r.Taxes.IbsMunicipal))} · CBS {Brl(r.Taxes.Cbs)}");
        y -= 10;
        c.Text(12, y, 7.5f, true, $"Tributos recolhidos pela plataforma: {Brl(r.Taxes.Total)}");
        y -= 10;
        c.Text(12, y, 7.5f, false, $"Peso {(r.WeightGrams / 1000m).ToString("N2", PtBr)} kg · compra em {r.PurchasedAt:dd/MM/yyyy}");

        return c.ToPdf();
    }

    private static string Mappers(string cpf) => Application.Common.Mappers.MaskDocument(cpf) ?? "";

    private static string Brl(Money m) => "R$ " + (m.Amount / 100m).ToString("N2", PtBr);

    private static string Ncm(string code) => code.Length == 8 ? $"{code[..4]}.{code[4..6]}.{code[6..]}" : code;

    private static string FormatCep(string? cep) => cep is { Length: 8 } ? $"{cep[..5]}-{cep[5..]}" : cep ?? "";

    private static string FormatDocument(string type, string doc)
    {
        var d = Documents.OnlyDigits(doc);
        return type.Equals("CNPJ", StringComparison.OrdinalIgnoreCase) && d.Length == 14
            ? $"{d[..2]}.{d[2..5]}.{d[5..8]}/{d[8..12]}-{d[12..]}"
            : string.IsNullOrWhiteSpace(doc) ? "não configurado" : doc;
    }

    private static string Fit(string text, int max) => text.Length <= max ? text : text[..(max - 1)] + "…";

    private static IEnumerable<string> Wrap(string text, int width)
    {
        var line = new StringBuilder();
        foreach (var word in text.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (line.Length > 0 && line.Length + word.Length + 1 > width)
            {
                yield return line.ToString();
                line.Clear();
            }
            if (line.Length > 0) line.Append(' ');
            line.Append(word);
        }
        if (line.Length > 0) yield return line.ToString();
    }

    /// <summary>Largura aproximada do texto em Helvetica (0,5 em por caractere).</summary>
    private static float Measure(string text, float size) => text.Length * size * 0.5f;

    /// <summary>Página única com Helvetica/Helvetica-Bold (WinAnsiEncoding) e comandos de desenho.</summary>
    public sealed class Canvas
    {
        private readonly StringBuilder _ops = new();

        private static string F(float v) => v.ToString("0.##", CultureInfo.InvariantCulture);

        public void Fill(float x, float y, float w, float h, float r, float g, float b) =>
            _ops.Append($"{F(r)} {F(g)} {F(b)} rg {F(x)} {F(y)} {F(w)} {F(h)} re f 0 g\n");

        public void Bar(float x, float y, float w, float h) => _ops.Append($"{F(x)} {F(y)} {F(w)} {F(h)} re f\n");

        public void Line(float x1, float y1, float x2, float y2) =>
            _ops.Append($"0.6 w 0.75 G {F(x1)} {F(y1)} m {F(x2)} {F(y2)} l S 0 G\n");

        public void Text(float x, float y, float size, bool bold, string text, bool white = false)
        {
            if (white) _ops.Append("1 g ");
            _ops.Append($"BT /{(bold ? "F2" : "F1")} {F(size)} Tf {F(x)} {F(y)} Td ({Escape(text)}) Tj ET");
            _ops.Append(white ? " 0 g\n" : "\n");
        }

        public void TextCentered(float cx, float y, float size, bool bold, string text) =>
            Text(cx - Measure(text, size) * 1.1f / 2, y, size, bold, text);

        private static string Escape(string text)
        {
            var bytes = WinAnsi.GetBytes(text);
            var sb = new StringBuilder(bytes.Length);
            foreach (var b in bytes)
            {
                var ch = (char)b;
                if (ch is '(' or ')' or '\\') sb.Append('\\').Append(ch);
                else if (b < 32 || b > 126) sb.Append('\\').Append(Convert.ToString(b, 8).PadLeft(3, '0'));
                else sb.Append(ch);
            }
            return sb.ToString();
        }

        public byte[] ToPdf()
        {
            var content = Encoding.ASCII.GetBytes(_ops.ToString());
            var objects = new List<byte[]>
            {
                Encoding.ASCII.GetBytes("<< /Type /Catalog /Pages 2 0 R >>"),
                Encoding.ASCII.GetBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
                Encoding.ASCII.GetBytes($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {F(W)} {F(H)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>"),
                Encoding.ASCII.GetBytes($"<< /Length {content.Length} >>\nstream\n").Concat(content).Concat(Encoding.ASCII.GetBytes("\nendstream")).ToArray(),
                Encoding.ASCII.GetBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
                Encoding.ASCII.GetBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"),
            };
            using var ms = new MemoryStream();
            void Write(string s) { var b = Encoding.ASCII.GetBytes(s); ms.Write(b); }
            Write("%PDF-1.4\n");
            var offsets = new List<long>();
            for (var i = 0; i < objects.Count; i++)
            {
                offsets.Add(ms.Position);
                Write($"{i + 1} 0 obj\n");
                ms.Write(objects[i]);
                Write("\nendobj\n");
            }
            var xref = ms.Position;
            Write($"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
            foreach (var o in offsets) Write($"{o:D10} 00000 n \n");
            Write($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF");
            return ms.ToArray();
        }
    }

    /// <summary>Code 128 (conjunto B) desenhado com retângulos: start B, dados, dígito de controle mod 103 e stop.</summary>
    public static class Code128
    {
        // Larguras barra/espaço dos 107 símbolos (106 = stop, 7 elementos).
        private static readonly string[] Patterns =
        [
            "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
            "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
            "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
            "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
            "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
            "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
            "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
            "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
            "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
            "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
            "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
        ];

        public static IReadOnlyList<int> Encode(string text)
        {
            var codes = new List<int> { 104 };
            foreach (var ch in text)
            {
                if (ch < 32 || ch > 126) throw new ArgumentException($"Caractere fora do Code 128B: {ch}");
                codes.Add(ch - 32);
            }
            var checksum = codes[0];
            for (var i = 1; i < codes.Count; i++) checksum += codes[i] * i;
            codes.Add(checksum % 103);
            codes.Add(106);
            return codes;
        }

        public static void Draw(Canvas canvas, string text, float x, float y, float maxWidth, float height)
        {
            var codes = Encode(text);
            var modules = codes.Sum(c => Patterns[c].Sum(d => d - '0')) + 20; // 10 módulos de margem de cada lado
            var unit = maxWidth / modules;
            var cursor = x + 10 * unit;
            foreach (var code in codes)
            {
                var pattern = Patterns[code];
                for (var i = 0; i < pattern.Length; i++)
                {
                    var width = (pattern[i] - '0') * unit;
                    if (i % 2 == 0) canvas.Bar(cursor, y, width, height);
                    cursor += width;
                }
            }
        }

        /// <summary>Todo símbolo soma 11 módulos (o stop, 13): confere a tabela.</summary>
        public static bool TableIsConsistent() =>
            Patterns.Length == 107 && Patterns.Take(106).All(p => p.Length == 6 && p.Sum(c => c - '0') == 11) && Patterns[106].Sum(c => c - '0') == 13;
    }
}
