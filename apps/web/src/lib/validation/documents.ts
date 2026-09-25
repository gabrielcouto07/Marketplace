/**
 * Validadores de documentos e códigos postais.
 * - CPF (comprador, Brasil): 11 dígitos com dígitos verificadores.
 * - RUC (vendedor, Paraguai): base numérica + dígito verificador (módulo 11), formato 80012345-6.
 * - CEP (Brasil): 8 dígitos.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calc = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function formatCpf(input: string): string {
  const d = onlyDigits(input).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * RUC paraguaio: 1 a 8 dígitos base + "-" + dígito verificador.
 * Algoritmo módulo 11 (base 2..) usado pela SET (Subsecretaría de Estado de Tributación).
 */
export function isValidRuc(input: string): boolean {
  const cleaned = input.replace(/[^\dkK-]/g, "").toUpperCase();
  const match = /^(\d{1,8})-?(\d)$/.exec(cleaned);
  if (!match) return false;
  const base = match[1];
  const dv = Number(match[2]);

  let k = 2;
  let total = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    if (k > 11) k = 2;
    total += Number(base[i]) * k;
    k++;
  }
  const rest = total % 11;
  const expected = rest > 1 ? 11 - rest : 0;
  return expected === dv;
}

export function formatRuc(input: string): string {
  const d = onlyDigits(input).slice(0, 9);
  if (d.length <= 1) return d;
  return `${d.slice(0, -1)}-${d.slice(-1)}`;
}

export function isValidCep(input: string): boolean {
  return /^\d{8}$/.test(onlyDigits(input));
}

export function formatCep(input: string): string {
  const d = onlyDigits(input).slice(0, 8);
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatPhoneBr(input: string): string {
  const d = onlyDigits(input).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "");
}
