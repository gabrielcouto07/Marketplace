"use client";

import type { CheckoutQuoteDto, DayRange } from "@marketplace/contracts";
import { AlertCircle, Clock, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { DeliveryWindow, GuaranteeBadge, ImportTaxLine } from "@/components/shared/trust-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCountdown } from "@/hooks/use-countdown";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

interface CheckoutSummaryProps {
  quote: CheckoutQuoteDto | undefined;
  quoting: boolean;
  /** Segundos restantes do câmbio travado. */
  remaining: number;
  expired: boolean;
  onRefresh: () => void;
  /** Faixa de dias úteis das opções de frete escolhidas (min dos mins, max dos maxs). */
  deliveryRange: DayRange | null;
}

/**
 * Resumo do pedido (clareza de dinheiro, estilo Stripe): linhas em body-sm com valores
 * tabulares à direita, impostos/prazo/garantia como elementos de confiança e o total em display.
 */
export function CheckoutSummary({
  quote,
  quoting,
  remaining,
  expired,
  onRefresh,
  deliveryRange,
}: CheckoutSummaryProps) {
  const t = useTranslations("checkout");
  const tCatalog = useTranslations("catalog");

  if (!quote) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="mt-2 h-9 w-1/2 self-end" />
      </div>
    );
  }

  const ratePercent = quote.importTaxRateBasisPoints / 100;
  const freeShipping = quote.shippingTotal.amount === 0;

  return (
    <div
      className={cn("flex flex-col gap-4 transition-opacity", quoting && "opacity-60")}
      aria-busy={quoting}
    >
      <dl className="flex flex-col gap-2">
        <SummaryRow label={t("subtotal")} value={formatMoney(quote.subtotal)} />
        <SummaryRow
          label={t("shipping")}
          value={freeShipping ? tCatalog("freeShipping") : formatMoney(quote.shippingTotal)}
          valueClassName={freeShipping ? "text-success" : undefined}
        />
        {quote.discount.amount > 0 ? (
          <SummaryRow
            label={t("discount")}
            value={`− ${formatMoney(quote.discount)}`}
            valueClassName="text-success"
          />
        ) : null}
      </dl>

      <div className="flex flex-col gap-4 border-y border-border py-4">
        <ImportTaxLine amount={quote.estimatedImportTax} ratePercent={ratePercent} />
        {deliveryRange ? <DeliveryWindow range={deliveryRange} /> : null}
        <GuaranteeBadge />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body-sm font-medium text-foreground">{t("total")}</span>
          <span className="text-display text-foreground tabular-nums">
            {formatMoney(quote.total)}
          </span>
        </div>
        <span className="self-end text-caption text-foreground-muted tabular-nums">
          ≈ {formatMoney(quote.totalReference)}
        </span>
      </div>

      {expired ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-md bg-danger-soft p-3 text-body-sm text-danger"
        >
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="font-medium">{t("exchangeExpired")}</span>
          </span>
          <Button variant="secondary" size="sm" className="self-start" onClick={onRefresh}>
            <RefreshCw data-icon="inline-start" strokeWidth={1.75} /> {t("refreshQuote")}
          </Button>
        </div>
      ) : (
        <div role="status" className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-8 items-center gap-1 rounded-sm bg-surface-muted px-2 text-caption text-foreground-secondary tabular-nums">
            <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
            {t("exchangeLockedFor", { time: formatCountdown(remaining) })}
          </span>
          <span className="text-caption text-foreground-muted tabular-nums">
            {quote.exchangeRate.displayRate}
          </span>
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-body-sm">
      <dt className="text-foreground-secondary">{label}</dt>
      <dd className={cn("font-medium text-foreground tabular-nums", valueClassName)}>{value}</dd>
    </div>
  );
}
