import type { Money } from "@marketplace/contracts";

import { formatMoney, formatMoneyParts } from "@/lib/money";
import { cn } from "@/lib/utils";

interface PriceTagProps {
  price: Money;
  compareAtPrice?: Money | null;
  /** Preço de referência na moeda de origem (PYG). */
  referencePrice?: Money | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Mostra "à vista no Pix" e parcelamento. */
  showInstallments?: boolean;
  installments?: number;
}

const SIZES = {
  sm: { symbol: "text-xs", integer: "text-base", fraction: "text-xs", compare: "text-xs", ref: "text-[11px]" },
  md: { symbol: "text-sm", integer: "text-xl", fraction: "text-sm", compare: "text-xs", ref: "text-xs" },
  lg: { symbol: "text-base", integer: "text-3xl", fraction: "text-base", compare: "text-sm", ref: "text-sm" },
} as const;

/**
 * Preço em BRL em destaque + referência em PYG. Nunca recebe float:
 * Money.amount é inteiro em unidades mínimas e a formatação é via Intl.
 */
export function PriceTag({ price, compareAtPrice, referencePrice, size = "md", className, showInstallments, installments = 12 }: PriceTagProps) {
  const s = SIZES[size];
  const parts = formatMoneyParts(price);
  const hasDiscount = compareAtPrice && compareAtPrice.amount > price.amount;

  return (
    <div className={cn("flex flex-col", className)}>
      {hasDiscount ? (
        <span className={cn("text-muted-foreground line-through", s.compare)}>
          <span className="sr-only">De </span>
          {formatMoney(compareAtPrice)}
        </span>
      ) : null}
      <span className="flex items-baseline gap-0.5 leading-none font-bold text-foreground" aria-label={formatMoney(price)}>
        <span className={cn("font-semibold", s.symbol)}>{parts.symbol}</span>
        <span className={s.integer}>{parts.integer}</span>
        {parts.fraction ? <span className={cn("font-semibold", s.fraction)}>,{parts.fraction}</span> : null}
      </span>
      {referencePrice ? (
        <span className={cn("mt-0.5 text-muted-foreground", s.ref)}>≈ {formatMoney(referencePrice)}</span>
      ) : null}
      {showInstallments ? (
        <span className={cn("mt-0.5 text-success", s.ref)}>
          {installments}x de {formatMoney({ amount: Math.ceil(price.amount / installments), currency: price.currency })}
        </span>
      ) : null}
    </div>
  );
}
