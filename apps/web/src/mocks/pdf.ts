import type { PaymentDto } from "@marketplace/contracts";

import { formatMoney } from "@/lib/money";

/** Só ASCII imprimível: garante que `string.length` == bytes (os offsets do xref dependem disso). */
function ascii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7e]/g, "");
}

function pdfString(text: string): string {
  return ascii(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Boleto de demonstração em PDF (uma página A4, fontes padrão, sem dependências).
 * O gateway real devolve o PDF pronto em `pdfUrl`; aqui só garantimos que "Baixar PDF" funcione.
 */
export function buildBoletoPdf(payment: PaymentDto): Uint8Array {
  const boleto = payment.boleto;
  if (!boleto) throw new Error("Pagamento sem boleto");

  const due = new Date(boleto.dueDate).toLocaleDateString("pt-BR");
  const text: Array<[font: "F1" | "F2" | "F3", size: number, value: string, gap: number]> = [
    ["F2", 20, "Marketplace Paraguai", 12],
    ["F1", 11, "Boleto bancario - ambiente de demonstracao", 28],
    ["F1", 11, `Pagamento: ${payment.id}`, 6],
    ["F1", 11, `Compra: ${payment.purchaseId}`, 6],
    ["F1", 11, `Valor: ${formatMoney(payment.amount)}`, 6],
    ["F1", 11, `Vencimento: ${due}`, 28],
    ["F2", 12, "Linha digitavel", 8],
    ["F3", 12, boleto.digitableLine, 40],
    ["F1", 9, "Documento gerado pelo mock (MSW). Nao possui valor de cobranca.", 0],
  ];

  const ops: string[] = [];
  let y = 780;
  for (const [font, size, value, gap] of text) {
    ops.push(`BT /${font} ${size} Tf 56 ${y} Td (${pdfString(value)}) Tj ET`);
    y -= size + gap;
  }

  // "Codigo de barras": barras finas/grossas derivadas dos digitos do codigo.
  let x = 56;
  for (const ch of boleto.barcode.replace(/\D/g, "")) {
    const digit = Number(ch);
    const width = digit % 2 === 0 ? 1.2 : 2.4;
    ops.push(`${x.toFixed(1)} ${y - 70} ${width} 60 re f`);
    x += width + (digit > 4 ? 2.2 : 1.4);
    if (x > 520) break;
  }

  const stream = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
