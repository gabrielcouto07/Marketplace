using System.Globalization;
using System.Text;

namespace Marketplace.Application.Common;

/// <summary>
/// PDF de texto (A4, Helvetica, várias páginas) sem dependências: comprovantes e relatórios simples. Quebra linhas
/// longas por palavra e passa para a página seguinte quando acaba o espaço.
/// </summary>
public sealed class TextPdf
{
    private const float PageWidth = 595;
    private const float PageHeight = 842;
    private const float Margin = 48;

    private sealed record Line(string Text, float Size, bool Bold, float SpaceBefore);

    private readonly List<Line> _lines = [];

    public TextPdf Title(string text) => Add(text, 15, true, 0);

    public TextPdf Heading(string text) => Add(text, 10.5f, true, 10);

    public TextPdf Text(string text, float size = 9) => Add(text, size, false, 2);

    public TextPdf Strong(string text, float size = 9) => Add(text, size, true, 2);

    public TextPdf Space(float points = 6) => Add(string.Empty, 1, false, points);

    private TextPdf Add(string text, float size, bool bold, float spaceBefore)
    {
        foreach (var piece in Wrap(Sanitize(text), size))
        {
            _lines.Add(new Line(piece, size, bold, spaceBefore));
            spaceBefore = 0;
        }
        return this;
    }

    /// <summary>Caracteres fora do Latin-1 (fonte padrão do PDF) trocados por equivalentes legíveis.</summary>
    private static string Sanitize(string text) =>
        text.Replace('—', '-').Replace('–', '-').Replace('•', '-').Replace('≈', '~').Replace('“', '"').Replace('”', '"')
            .Replace('’', '\'').Replace("₲", "PYG").Replace('…', '.');

    private static IEnumerable<string> Wrap(string text, float size)
    {
        if (text.Length == 0)
        {
            yield return string.Empty;
            yield break;
        }
        // Helvetica tem ~0,5 em de largura média: suficiente para não estourar a margem.
        var max = Math.Max(20, (int)((PageWidth - 2 * Margin) / (size * 0.5f)));
        var line = new StringBuilder();
        foreach (var word in text.Split(' '))
        {
            if (line.Length > 0 && line.Length + 1 + word.Length > max)
            {
                yield return line.ToString();
                line.Clear();
            }
            if (line.Length > 0) line.Append(' ');
            line.Append(word.Length > max ? word[..max] : word);
        }
        if (line.Length > 0) yield return line.ToString();
    }

    public byte[] Build()
    {
        var pages = new List<StringBuilder>();
        var page = new StringBuilder();
        var y = PageHeight - Margin;
        foreach (var line in _lines)
        {
            var height = line.Size * 1.35f + line.SpaceBefore;
            if (y - height < Margin)
            {
                pages.Add(page);
                page = new StringBuilder();
                y = PageHeight - Margin;
            }
            y -= height;
            if (line.Text.Length == 0) continue;
            page.Append("BT /").Append(line.Bold ? "F2" : "F1").Append(' ').Append(F(line.Size)).Append(" Tf ")
                .Append(F(Margin)).Append(' ').Append(F(y)).Append(" Td (").Append(Escape(line.Text)).Append(") Tj ET\n");
        }
        pages.Add(page);

        var objects = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            string.Empty, // páginas: preenchido abaixo
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
        };
        var kids = new List<string>();
        foreach (var content in pages)
        {
            var stream = content.ToString();
            objects.Add($"<< /Length {Encoding.Latin1.GetByteCount(stream)} >>\nstream\n{stream}endstream");
            var contentRef = objects.Count;
            objects.Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {F(PageWidth)} {F(PageHeight)}] /Contents {contentRef} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>");
            kids.Add($"{objects.Count} 0 R");
        }
        objects[1] = $"<< /Type /Pages /Kids [{string.Join(' ', kids)}] /Count {kids.Count} >>";

        var sb = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var i = 0; i < objects.Count; i++)
        {
            offsets.Add(Encoding.Latin1.GetByteCount(sb.ToString()));
            sb.Append(i + 1).Append(" 0 obj\n").Append(objects[i]).Append("\nendobj\n");
        }
        var xref = Encoding.Latin1.GetByteCount(sb.ToString());
        sb.Append("xref\n0 ").Append(objects.Count + 1).Append("\n0000000000 65535 f \n");
        foreach (var offset in offsets) sb.Append(offset.ToString("D10", CultureInfo.InvariantCulture)).Append(" 00000 n \n");
        sb.Append("trailer\n<< /Size ").Append(objects.Count + 1).Append(" /Root 1 0 R >>\nstartxref\n").Append(xref).Append("\n%%EOF");
        return Encoding.Latin1.GetBytes(sb.ToString());
    }

    private static string F(float value) => value.ToString("0.##", CultureInfo.InvariantCulture);

    private static string Escape(string text) => text.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");
}
