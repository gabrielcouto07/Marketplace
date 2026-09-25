import type { z } from "zod";

import { onlyDigits } from "@/lib/validation/documents";
import { cardSchema } from "@/lib/validation/schemas";

/** Dados do cartão sem o CPF do pagador (que é um campo próprio do checkout). */
export const cardOnlySchema = cardSchema.omit({ payerDocument: true });
export type CardOnlyInput = z.input<typeof cardOnlySchema>;
export type CardOnlyOutput = z.output<typeof cardOnlySchema>;

/** Bandeira pelo BIN (prefixo) — só para exibição; o gateway valida de verdade. */
export function detectBrand(number: string): string | null {
  const d = onlyDigits(number);
  if (d.length < 4) return null;
  if (/^4/.test(d)) return "Visa";
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^(636368|438935|504175|451416|636297)/.test(d)) return "Elo";
  return null;
}

export function formatCardNumber(value: string): string {
  return onlyDigits(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function formatExpiry(value: string): string {
  const d = onlyDigits(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
