import type { DayRange, Money } from "@marketplace/contracts";
import { CalendarClock, Landmark, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Elementos de confiança (DESIGN.md › Confiança). Bonitos, não burocráticos: ícone em círculo
 * azul-suave, título em peso 500 e uma linha explicando o que aquilo significa.
 */

interface TrustRowProps {
  icon: typeof ShieldCheck;
  title: string;
  hint?: string;
  trailing?: string;
  /** `inline`: linha compacta (cards) · `card`: com borda e respiro (PDP, checkout). */
  variant?: "inline" | "card";
  className?: string;
}

function TrustRow({
  icon: Icon,
  title,
  hint,
  trailing,
  variant = "inline",
  className,
}: TrustRowProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3",
        variant === "card" && "rounded-lg border border-border bg-surface p-4 shadow-xs",
        className,
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-body-sm font-medium text-foreground">{title}</span>
          {trailing ? (
            <span className="shrink-0 text-body-sm font-medium text-foreground tabular-nums">
              {trailing}
            </span>
          ) : null}
        </span>
        {hint ? <span className="text-caption text-foreground-secondary">{hint}</span> : null}
      </span>
    </div>
  );
}

/** "Compra garantida" com escudo. */
export function GuaranteeBadge({
  variant,
  className,
}: {
  variant?: TrustRowProps["variant"];
  className?: string;
}) {
  const t = useTranslations("trust");
  return (
    <TrustRow
      icon={ShieldCheck}
      title={t("guaranteedTitle")}
      hint={t("guaranteedHint")}
      variant={variant}
      className={className}
    />
  );
}

/** Linha de impostos de importação estimados: sempre visível no checkout, com o valor e a alíquota. */
export function ImportTaxLine({
  amount,
  ratePercent,
  variant,
  className,
}: {
  amount: Money;
  /** Alíquota em %, ex.: 60. */
  ratePercent?: number;
  variant?: TrustRowProps["variant"];
  className?: string;
}) {
  const t = useTranslations("trust");
  const hint =
    ratePercent !== undefined
      ? `${t("importTaxHint")} ${t("importTaxRate", { rate: `${ratePercent}%` })}`
      : t("importTaxHint");
  return (
    <TrustRow
      icon={Landmark}
      title={t("importTaxLabel")}
      hint={hint}
      trailing={formatMoney(amount)}
      variant={variant}
      className={className}
    />
  );
}

/** Prazo em faixa de dias úteis. */
export function DeliveryWindow({
  range,
  variant,
  className,
}: {
  range: DayRange;
  variant?: TrustRowProps["variant"];
  className?: string;
}) {
  const t = useTranslations("trust");
  const tc = useTranslations("common");
  return (
    <TrustRow
      icon={CalendarClock}
      title={t("deliveryLabel")}
      hint={t("deliveryHint")}
      trailing={tc("businessDays", { min: range.min, max: range.max })}
      variant={variant}
      className={className}
    />
  );
}
