/**
 * Descrição da mercadoria na declaração de importação (Programa de Conformidade 7.4): natureza, marca e modelo quando
 * houver, material e quantidade, sem expressões genéricas. Espelha `DeclarationText` da API para o formulário avisar
 * antes de salvar; a API confere de novo.
 */

const GENERIC_WORDS = new Set([
  "produto", "produtos", "item", "itens", "mercadoria", "mercadorias", "presente", "presentes", "amostra", "amostras",
  "diversos", "diversas", "variados", "variadas", "sortidos", "acessorio", "acessorios", "eletronico", "eletronicos",
  "eletronica", "eletronicas", "peca", "pecas", "roupa", "roupas", "brinquedo", "brinquedos", "objeto", "objetos", "artigo",
  "artigos", "coisa", "coisas", "kit", "kits", "outro", "outros", "outra", "outras", "utilidade", "utilidades", "utensilio",
  "utensilios", "material", "materiais", "pacote", "pacotes", "encomenda", "generico", "generica", "importado", "importados",
  "gift", "gifts", "sample", "samples", "goods", "stuff", "parts", "accessories", "clothes", "electronics", "toys", "misc",
  "regalo", "regalos", "varios", "varias", "mercaderia", "mercaderias", "producto", "productos",
]);

const CONNECTORS = new Set([
  "de", "da", "do", "das", "dos", "e", "para", "com", "em", "a", "o", "as", "os", "um", "uma", "no", "na", "nos", "nas",
  "y", "el", "la", "los", "las", "con", "en", "del", "of", "and", "for", "the",
]);

/** Minúsculas, sem acento e só letras/dígitos separados por espaço. */
export function foldText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Natureza sem nenhuma palavra que diga o que o produto é ("Acessórios", "Produto eletrônico", "Presente"). */
export function isGenericNature(nature: string | null | undefined): boolean {
  const words = foldText(nature)
    .split(" ")
    .filter((w) => w.length > 1 && !CONNECTORS.has(w) && !/^\d+$/.test(w));
  return words.length === 0 || words.every((w) => GENERIC_WORDS.has(w));
}

/**
 * "Fone de ouvido Bluetooth, marca X, modelo Y, material: plástico, quantidade: 1 un." — como a mercadoria sai na
 * declaração. Sem marca, o texto diz "sem marca".
 */
export function buildDeclaration(input: {
  nature: string;
  brand?: string | null;
  unbranded?: boolean;
  model?: string | null;
  material: string;
  quantity: number;
}): string {
  const parts = [input.nature.trim()];
  const brand = input.unbranded ? "" : (input.brand ?? "").trim();
  parts.push(brand ? `marca ${brand}` : "sem marca");
  if (input.model?.trim()) parts.push(`modelo ${input.model.trim()}`);
  parts.push(`material: ${input.material.trim()}`);
  parts.push(`quantidade: ${Math.max(1, input.quantity)} un.`);
  return parts.join(", ");
}
