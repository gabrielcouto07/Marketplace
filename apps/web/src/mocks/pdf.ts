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
    ["F2", 20, "Paraguai Ja", 12],
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

// ---------------------------------------------------------------------------
// Etiqueta da remessa (Remessa Conforme, critério iii) — mesmo layout da API (LabelPdf.cs), 10 x 15 cm
// ---------------------------------------------------------------------------

/** Larguras barra/espaço dos 107 símbolos do Code 128 (106 = stop, 7 elementos). */
const CODE128_PATTERNS = [
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

/** Code 128 conjunto B: start B, dados, dígito de controle mod 103 e stop, desenhados com retângulos. */
function code128(text: string, x: number, y: number, maxWidth: number, height: number): string[] {
  const codes = [104, ...[...ascii(text)].map((ch) => ch.charCodeAt(0) - 32)];
  const checksum = codes.reduce((acc, code, i) => acc + (i === 0 ? code : code * i), 0);
  codes.push(checksum % 103, 106);
  const modules =
    codes.reduce((acc, code) => acc + [...CODE128_PATTERNS[code]].reduce((s, d) => s + Number(d), 0), 0) + 20;
  const unit = maxWidth / modules;
  let cursor = x + 10 * unit;
  const ops: string[] = [];
  for (const code of codes) {
    [...CODE128_PATTERNS[code]].forEach((d, i) => {
      const width = Number(d) * unit;
      if (i % 2 === 0) ops.push(`${cursor.toFixed(2)} ${y} ${width.toFixed(2)} ${height} re f`);
      cursor += width;
    });
  }
  return ops;
}

export interface ShipmentLabelInput {
  brand: string;
  tradeName: string;
  documentLabel: string;
  sandbox: boolean;
  carrier: string;
  orderNumber: string;
  trackingCode: string;
  declarationNumber: string | null;
  recipientName: string;
  recipientCpf: string;
  recipientAddress: string;
  recipientCityLine: string;
  senderName: string;
  senderAddress: string;
  itemsLine: string;
  customsLine: string;
  taxesLine: string;
  totalTaxesLine: string;
  footerLine: string;
}

export function buildShipmentLabelPdf(input: ShipmentLabelInput): Uint8Array {
  const W = 283.46;
  const H = 425.2;
  const ops: string[] = [];
  const text = (x: number, y: number, size: number, bold: boolean, value: string, white = false) =>
    ops.push(
      `${white ? "1 g " : ""}BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y.toFixed(1)} Td (${pdfString(value)}) Tj ET${white ? " 0 g" : ""}`,
    );
  const line = (y: number) => ops.push(`0.6 w 0.75 G 10 ${y.toFixed(1)} m ${W - 10} ${y.toFixed(1)} l S 0 G`);

  // Faixa da plataforma: marca, nome comercial e CNPJ/TIN em destaque.
  ops.push(`0.06 0.11 0.24 rg 0 ${H - 58} ${W} 58 re f 0 g`);
  text(12, H - 24, 15, true, input.brand.toUpperCase(), true);
  text(12, H - 37, 7.5, false, `${input.tradeName} - ${input.documentLabel}`, true);
  text(12, H - 49, 7.5, false, "Remessa Conforme - tributos pagos na compra", true);

  // No sandbox, uma faixa vermelha de largura total avisa que a etiqueta é de teste.
  let y = H - 72;
  if (input.sandbox) {
    const stamp = "SANDBOX - NAO POSTAR - ETIQUETA DE TESTE";
    ops.push(`0.86 0.15 0.15 rg 0 ${H - 74} ${W} 16 re f 0 g`);
    text(W / 2 - (stamp.length * 8 * 0.66) / 2, H - 69, 8, true, stamp, true);
    y -= 16;
  }
  text(12, y, 7, false, `${input.carrier} - pedido ${input.orderNumber}`);
  y -= 44;
  ops.push(...code128(input.trackingCode, 14, y, W - 28, 38));
  y -= 13;
  text(W / 2 - (input.trackingCode.length * 11 * 0.66) / 2, y, 11, true, input.trackingCode);
  y -= 8;
  line(y);

  y -= 13;
  text(12, y, 7, true, "DESTINATARIO");
  y -= 13;
  text(12, y, 10, true, input.recipientName);
  y -= 11;
  text(12, y, 8, false, `CPF ${input.recipientCpf}`);
  y -= 11;
  text(12, y, 8, false, input.recipientAddress);
  y -= 12;
  text(12, y, 9, true, input.recipientCityLine);
  y -= 8;
  line(y);

  y -= 13;
  text(12, y, 7, true, "REMETENTE");
  y -= 11;
  text(12, y, 8.5, true, input.senderName);
  y -= 10;
  text(12, y, 7.5, false, input.senderAddress);
  y -= 8;
  line(y);

  y -= 13;
  text(12, y, 7, true, "DECLARACAO ANTECIPADA");
  if (input.declarationNumber)
    text(W - 12 - input.declarationNumber.length * 7 * 0.56, y, 7, false, input.declarationNumber);
  y -= 11;
  text(12, y, 7.5, false, input.itemsLine);
  y -= 10;
  text(12, y, 7.5, false, input.customsLine);
  y -= 10;
  text(12, y, 7.5, false, input.taxesLine);
  y -= 10;
  text(12, y, 7.5, true, input.totalTaxesLine);
  y -= 10;
  text(12, y, 7.5, false, input.footerLine);

  return renderPdf(ops.join("\n"), W, H, ["Helvetica", "Helvetica-Bold"]);
}

/** Monta o PDF de uma página com fontes padrão (offsets do xref contam bytes; o conteúdo é só ASCII). */
function renderPdf(stream: string, width: number, height: number, fonts: string[]): Uint8Array {
  const fontRefs = fonts.map((_, i) => `/F${i + 1} ${5 + i} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << ${fontRefs} >> >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ...fonts.map((font) => `<< /Type /Font /Subtype /Type1 /BaseFont /${font} >>`),
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
