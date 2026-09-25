import type { Money } from "@marketplace/contracts";
import { useTranslations } from "next-intl";

import { formatMoney, formatMoneyParts } from "@/lib/money";
import { cn } from "@/lib/utils";

interface PriceTagProps {
  price: Money;
  compareAtPrice?: Money | null;
  /** Preço de referência na moeda de origem (PYG). */
  referencePrice?: Money | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** `short`: "12x R$ 41,58" (cards) · `long`: "em até 12x de R$ 41,58 sem juros" (produto). */
  installments?: "short" | "long";
  installmentCount?: number;
  /** Mostra o selo "-25%" ao lado do preço riscado. */
  showDiscountBadge?: boolean;
}

const SIZES = {
  sm: { symbol: "text-xs", integer: "text-[19px]", fraction: "text-xs", meta: "text-[11.5px]" },
  md: { symbol: "text-sm", integer: "text-2xl", fraction: "text-sm", meta: "text-xs" },
  lg: { symbol: "text-base", integer: "text-[34px]", fraction: "text-base", meta: "text-[13.5px]" },
} as const;

/**
 * Preço em BRL com o inteiro em destaque (peso 800, tracking apertado, números tabulares),
 * preço riscado acima, referência em PYG e parcelamento abaixo. Nunca recebe float:
 * Money.amount é inteiro em unidades mínimas e a formatação é via Intl.
 */
export function PriceTag({
  price,
  compareAtPrice,
  referencePrice,
  size = "md",
  className,
  installments,
  installmentCount = 12,
  showDiscountBadge,
}: PriceTagProps) {
  const t = useTranslations("common");
  const s = SIZES[size];
  const parts = formatMoneyParts(price);
  const hasDiscount = Boolean(compareAtPrice && compareAtPrice.amount > price.amount);
  const discount = hasDiscount
    ? Math.round(((compareAtPrice!.amount - price.amount) / compareAtPrice!.amount) * 100)
    : 0;
  const installment = {
    amount: Math.ceil(price.amount / installmentCount),
    currency: price.currency,
  };

  return (
    <div className={cn("flex flex-col gap-0.5 tabular-nums", className)}>
      {hasDiscount ? (
        <span className={cn("flex items-center gap-2 text-muted-foreground", s.meta)}>
          <span className="line-through">
            <span className="sr-only">De </span>
            {formatMoney(compareAtPrice!)}
          </span>
          {showDiscountBadge && discount > 0 ? (
            <span className="rounded-md bg-destructive-soft px-1.5 py-0.5 text-xs font-extrabold text-destructive">
              -{discount}%
            </span>
          ) : null}
        </span>
      ) : null}
      <span
        className="flex items-baseline gap-0.5 leading-none text-foreground"
        aria-label={formatMoney(price)}
      >
        <span className={cn("font-bold", s.symbol)}>{parts.symbol}</span>
        <span className={cn("font-extrabold tracking-tight", s.integer)}>{parts.integer}</span>
        {parts.fraction ? (
          <span className={cn("font-bold", s.fraction)}>,{parts.fraction}</span>
        ) : null}
      </span>
      {installments === "long" ? (
        <span className={cn("font-bold text-success", s.meta)}>
          {t("installmentsLong", { count: installmentCount, amount: formatMoney(installment) })}
        </span>
      ) : installments === "short" ? (
        <span className={cn("text-muted-foreground", s.meta)}>
          {t("installmentsShort", { count: installmentCount, amount: formatMoney(installment) })}
        </span>
      ) : null}
      {referencePrice ? (
        <span className={cn("text-muted-foreground", s.meta)}>≈ {formatMoney(referencePrice)}</span>
      ) : null}
    </div>
  );
}
