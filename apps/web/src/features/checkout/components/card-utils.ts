import type { z } from "zod";

import type { CardPaymentMethodId, KnownCardPaymentMethodId } from "@/lib/payments/card-token";
import { onlyDigits } from "@/lib/validation/documents";
import { cardSchema } from "@/lib/validation/schemas";

/** Dados do cartão sem o CPF do pagador (que é um campo próprio do checkout). */
export const cardOnlySchema = cardSchema.omit({ payerDocument: true });
export type CardOnlyInput = z.input<typeof cardOnlySchema>;
export type CardOnlyOutput = z.output<typeof cardOnlySchema>;

export interface CardBrand {
  /** `payment_method_id` do Mercado Pago, enviado à API como `brand`. */
  id: CardPaymentMethodId;
  /** Nome para exibição. */
  name: string;
}

const BRANDS: Record<KnownCardPaymentMethodId, CardBrand> = {
  visa: { id: "visa", name: "Visa" },
  master: { id: "master", name: "Mastercard" },
  amex: { id: "amex", name: "Amex" },
  elo: { id: "elo", name: "Elo" },
  hipercard: { id: "hipercard", name: "Hipercard" },
};

/** Nome da bandeira para exibição a partir do `payment_method_id` gravado ("master" → "Mastercard"). */
export function cardBrandName(id: string): string {
  return (BRANDS as Record<string, CardBrand | undefined>)[id.toLowerCase()]?.name ?? id;
}

/** Bandeira pelo BIN (prefixo) — só para exibição e `payment_method_id`; o gateway valida de verdade. */
export function detectBrand(number: string): CardBrand | null {
  const d = onlyDigits(number);
  if (d.length < 4) return null;
  if (/^(606282|3841)/.test(d)) return BRANDS.hipercard;
  if (/^(636368|438935|504175|451416|636297|5067|4576|4011)/.test(d)) return BRANDS.elo;
  if (/^4/.test(d)) return BRANDS.visa;
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return BRANDS.master;
  if (/^3[47]/.test(d)) return BRANDS.amex;
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
