import type { Money } from "@marketplace/contracts";
import { useTranslations } from "next-intl";

import { discountPercent, formatMoney, formatMoneyParts } from "@/lib/money";
import { cn } from "@/lib/utils";

interface PriceTagProps {
  price: Money;
  compareAtPrice?: Money | null;
  /** Preço de referência na moeda de origem (PYG): "≈ ₲ 245.000". */
  referencePrice?: Money | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** `short`: "12x R$ 41,58" (cards) · `long`: "em até 12x de R$ 41,58 sem juros" (produto). */
  installments?: "short" | "long";
  installmentCount?: number;
  /** Mostra o "-25%" ao lado do preço riscado (verde: desconto é ganho, não alerta). */
  showDiscountBadge?: boolean;
}

/* Três tamanhos por componente: inteiro · símbolo/centavos · metadados. */
const SIZES = {
  sm: { integer: "text-title-3", minor: "text-caption", meta: "text-caption" },
  md: { integer: "text-title-1", minor: "text-body-sm", meta: "text-body-sm" },
  lg: { integer: "text-display", minor: "text-body", meta: "text-body-sm" },
} as const;

/**
 * Preço em BRL sempre em destaque: inteiro grande em --text, centavos menores sobrescritos,
 * preço antigo riscado em muted, % de desconto em --success, parcelamento e referência em
 * guaranis em caption muted. Nunca recebe float: Money.amount é inteiro em unidades mínimas.
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
  const discount = discountPercent(price, compareAtPrice ?? null);
  const hasDiscount = discount > 0;
  const installment = {
    amount: Math.ceil(price.amount / installmentCount),
    currency: price.currency,
  };

  return (
    <div className={cn("flex flex-col gap-0.5 tabular-nums", className)}>
      {hasDiscount ? (
        <span className={cn("flex items-center gap-2 text-foreground-muted", s.meta)}>
          <span className="line-through">
            <span className="sr-only">De </span>
            {formatMoney(compareAtPrice!)}
          </span>
          {showDiscountBadge ? (
            <span className="font-medium text-success">-{discount}%</span>
          ) : null}
        </span>
      ) : null}
      <span
        className="flex items-start leading-none text-foreground"
        aria-label={formatMoney(price)}
      >
        <span className={cn("mt-[0.2em] mr-1 font-medium", s.minor)} aria-hidden>
          {parts.symbol}
        </span>
        <span className={cn("leading-none", s.integer)} aria-hidden>
          {parts.integer}
        </span>
        {parts.fraction ? (
          <span className={cn("mt-[0.2em] ml-0.5 font-semibold", s.minor)} aria-hidden>
            ,{parts.fraction}
          </span>
        ) : null}
      </span>
      {installments === "long" ? (
        <span className={cn("font-medium text-success", s.meta)}>
          {t("installmentsLong", { count: installmentCount, amount: formatMoney(installment) })}
        </span>
      ) : installments === "short" ? (
        <span className={cn("text-foreground-secondary", s.meta)}>
          {t("installmentsShort", { count: installmentCount, amount: formatMoney(installment) })}
        </span>
      ) : null}
      {referencePrice ? (
        <span className={cn("text-foreground-muted", s.meta)}>≈ {formatMoney(referencePrice)}</span>
      ) : null}
    </div>
  );
}
