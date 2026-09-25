import type { CurrencyCode, ExchangeRateDto, Money } from "@marketplace/contracts";

/**
 * Regras:
 *  - Money.amount é SEMPRE inteiro em unidades mínimas (BRL/USD: centavos; PYG: guaranis).
 *  - Nunca usar float para somar/multiplicar dinheiro. Conversões de câmbio usam fração exata.
 *  - Formatação via Intl.NumberFormat (locale-aware).
 */

export const CURRENCY_MINOR_DIGITS: Record<CurrencyCode, number> = {
  BRL: 2,
  USD: 2,
  PYG: 0,
};

export function money(amount: number, currency: CurrencyCode = "BRL"): Money {
  if (!Number.isInteger(amount)) {
    throw new TypeError(`Money.amount deve ser inteiro (recebido ${amount})`);
  }
  return { amount, currency };
}

export const ZERO_BRL: Money = { amount: 0, currency: "BRL" };

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Moedas diferentes: ${a.currency} vs ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function multiply(m: Money, factor: number): Money {
  if (!Number.isInteger(factor))
    throw new TypeError("Use multiplyBasisPoints para fatores fracionários");
  return { amount: m.amount * factor, currency: m.currency };
}

/** Aplica uma porcentagem em basis points (10000 = 100%) com arredondamento half-up. */
export function multiplyBasisPoints(m: Money, basisPoints: number): Money {
  return { amount: Math.round((m.amount * basisPoints) / 10_000), currency: m.currency };
}

export function sum(values: Money[], currency: CurrencyCode = "BRL"): Money {
  return values.reduce((acc, v) => add(acc, v), { amount: 0, currency });
}

export function isZero(m: Money): boolean {
  return m.amount === 0;
}

export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amount === b.amount ? 0 : a.amount > b.amount ? 1 : -1;
}

/** Converte usando fração exata: round(amount * numerator / denominator). */
export function convert(m: Money, rate: ExchangeRateDto): Money {
  if (m.currency !== rate.from) {
    throw new Error(`Taxa ${rate.from}->${rate.to} não se aplica a ${m.currency}`);
  }
  return { amount: Math.round((m.amount * rate.numerator) / rate.denominator), currency: rate.to };
}

export function toMajorUnits(m: Money): number {
  return m.amount / 10 ** CURRENCY_MINOR_DIGITS[m.currency];
}

export function fromMajorUnits(value: number, currency: CurrencyCode): Money {
  return { amount: Math.round(value * 10 ** CURRENCY_MINOR_DIGITS[currency]), currency };
}

const LOCALE_BY_CURRENCY: Record<CurrencyCode, string> = {
  BRL: "pt-BR",
  PYG: "es-PY",
  USD: "en-US",
};

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(
  locale: string,
  currency: CurrencyCode,
  opts?: { compact?: boolean },
): Intl.NumberFormat {
  const key = `${locale}|${currency}|${opts?.compact ? "c" : "f"}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: currency === "PYG" ? "narrowSymbol" : "symbol",
      minimumFractionDigits: CURRENCY_MINOR_DIGITS[currency],
      maximumFractionDigits: CURRENCY_MINOR_DIGITS[currency],
      ...(opts?.compact ? { notation: "compact" as const } : {}),
    });
    formatterCache.set(key, f);
  }
  return f;
}

export interface FormatMoneyOptions {
  /** Locale de formatação; por padrão usa o locale natural da moeda. */
  locale?: string;
  compact?: boolean;
}

export function formatMoney(m: Money, options: FormatMoneyOptions = {}): string {
  const locale = options.locale ?? LOCALE_BY_CURRENCY[m.currency];
  const formatted = getFormatter(locale, m.currency, { compact: options.compact }).format(
    toMajorUnits(m),
  );
  // Alguns navegadores retornam "PYG" em vez de "₲" para es-PY; normaliza.
  return m.currency === "PYG" ? formatted.replace(/PYG\s?/, "₲ ") : formatted;
}

/** Divide o valor em partes (símbolo, inteiro, decimais) para composição visual do PriceTag. */
export function formatMoneyParts(
  m: Money,
  locale?: string,
): { symbol: string; integer: string; fraction: string | null } {
  const parts = getFormatter(locale ?? LOCALE_BY_CURRENCY[m.currency], m.currency).formatToParts(
    toMajorUnits(m),
  );
  const symbol = parts.find((p) => p.type === "currency")?.value ?? m.currency;
  const integer = parts
    .filter((p) => p.type === "integer" || p.type === "group")
    .map((p) => p.value)
    .join("");
  const fraction = parts.find((p) => p.type === "fraction")?.value ?? null;
  return { symbol: symbol === "PYG" ? "₲" : symbol, integer, fraction };
}

/** Calcula desconto percentual inteiro entre preço e preço de comparação. */
export function discountPercent(price: Money, compareAt: Money | null): number {
  if (!compareAt || compareAt.amount <= price.amount || compareAt.amount === 0) return 0;
  return Math.round(((compareAt.amount - price.amount) / compareAt.amount) * 100);
}

/** Divide um total em N parcelas inteiras (a última absorve o resto). */
export function splitInstallments(total: Money, count: number): Money[] {
  const base = Math.floor(total.amount / count);
  const remainder = total.amount - base * count;
  return Array.from({ length: count }, (_, i) => ({
    amount: base + (i === count - 1 ? remainder : 0),
    currency: total.currency,
  }));
}
