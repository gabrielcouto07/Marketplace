"use client";

import type { ImportTaxBreakdownDto, Money } from "@marketplace/contracts";
import { Landmark, PackageCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Valores discriminados da remessa, como pede o critério ii da Portaria Coana 130/2023 (art. 8º): produto, frete e
 * seguro, descontos, despesas, II, ICMS, IBS, CBS, total e taxa de câmbio.
 * - `full`: a conta inteira (resumo do checkout e detalhe do pedido);
 * - `taxes`: só os tributos e a nota de câmbio (página de produto e carrinho, antes do frete).
 */
export function TaxBreakdown({
  taxes,
  mode = "full",
  className,
}: {
  taxes: ImportTaxBreakdownDto;
  mode?: "full" | "taxes";
  className?: string;
}) {
  const t = useTranslations("taxes");
  const format = useFormatter();
  const pct = (bp: number) =>
    format.number(bp / 10_000, { style: "percent", maximumFractionDigits: 2 });
  const zero = (m: Money) => m.amount === 0;
  const estimate = !taxes.isFinal;

  const dutyLabel =
    taxes.importDutyBasisPoints === 0
      ? t("importDuty")
      : taxes.importDutyDeduction.amount > 0
        ? t("importDutyHigh", { rate: pct(taxes.importDutyBasisPoints) })
        : t("importDutyRate", { rate: pct(taxes.importDutyBasisPoints) });

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {mode === "full" ? (
        <dl className="flex flex-col gap-2">
          <Row label={t("products")} value={formatMoney(taxes.products)} />
          <Row label={t("freight")} value={zero(taxes.freight) ? t("free") : formatMoney(taxes.freight)} />
          <Row label={t("insurance")} value={formatMoney(taxes.insurance)} muted={zero(taxes.insurance)} />
          <Row label={t("otherExpenses")} value={formatMoney(taxes.otherExpenses)} muted={zero(taxes.otherExpenses)} />
          {taxes.discount.amount > 0 ? (
            <Row label={t("discount")} value={`− ${formatMoney(taxes.discount)}`} valueClassName="text-success" />
          ) : null}
          <Row
            label={t("customsValue")}
            hint={taxes.customsValueUsd ? t("customsValueUsd", { usd: formatMoney(taxes.customsValueUsd) }) : undefined}
            value={formatMoney(taxes.customsValue)}
            strong
          />
        </dl>
      ) : null}

      <div className="flex flex-col gap-2 rounded-md bg-surface-muted p-3">
        <p className="flex items-center gap-2 text-caption font-bold text-foreground-secondary uppercase">
          <Landmark className="size-4" strokeWidth={2} aria-hidden />
          {estimate ? t("taxesEstimated") : t("taxesTitle")}
        </p>
        <dl className="flex flex-col gap-1.5">
          <Row
            label={dutyLabel}
            hint={taxes.importDutyDeduction.amount > 0 ? t("deduction", { value: formatMoney(taxes.importDutyDeduction) }) : undefined}
            value={formatMoney(taxes.importDuty)}
          />
          {estimate && taxes.icms.amount === 0 ? null : (
            <>
              <Row
                label={taxes.icmsState ? t("icmsState", { rate: pct(taxes.icmsBasisPoints), state: taxes.icmsState }) : t("icmsRate", { rate: pct(taxes.icmsBasisPoints) })}
                value={formatMoney(taxes.icms)}
              />
              <Row
                label={t("ibsRate", { rate: pct(taxes.ibsBasisPoints) })}
                hint={taxes.ibs.amount > 0 ? t("ibsSplit", { state: formatMoney(taxes.ibsState), city: formatMoney(taxes.ibsMunicipal) }) : undefined}
                value={formatMoney(taxes.ibs)}
              />
              <Row label={t("cbsRate", { rate: pct(taxes.cbsBasisPoints) })} value={formatMoney(taxes.cbs)} />
            </>
          )}
          <div className="mt-1 border-t border-border pt-2">
            <Row label={t("totalTaxes")} value={formatMoney(taxes.totalTaxes)} strong />
          </div>
        </dl>
      </div>

      <ul className="flex flex-col gap-1 text-caption text-foreground-secondary">
        <li>{estimate ? t("noteEstimate", { rate: pct(taxes.importDutyBasisPoints || taxes.effectiveBasisPoints) }) : t("noteFinal")}</li>
        {taxes.usdRate ? <li className="tabular-nums">{t("noteRate", { rate: taxes.usdRate.displayRate })}</li> : null}
        {!estimate && taxes.importDutyBasisPoints !== 0 ? (
          <li>{taxes.importDutyDeduction.amount > 0 ? t("noteHighTier") : t("noteLowTier")}</li>
        ) : null}
      </ul>
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  strong,
  muted,
  valueClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: string;
  strong?: boolean;
  muted?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-body-sm">
      <dt className="flex min-w-0 flex-col text-foreground-secondary">
        <span className={cn(strong && "font-medium text-foreground")}>{label}</span>
        {hint ? <span className="text-caption text-foreground-muted">{hint}</span> : null}
      </dt>
      <dd
        className={cn(
          "shrink-0 tabular-nums",
          strong ? "font-semibold text-foreground" : "font-medium text-foreground",
          muted && "text-foreground-muted",
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function TaxBreakdownSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
      <Skeleton className="h-4 w-3/6" />
    </div>
  );
}

/** Aviso de produto importado e tributado (critério ii): aparece na página de produto e no carrinho. */
export function ImportedProductNotice({ className }: { className?: string }) {
  const t = useTranslations("taxes");
  return (
    <p className={cn("flex items-start gap-2 rounded-md bg-primary-soft p-3 text-body-sm text-foreground", className)}>
      <PackageCheck className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
      <span>
        <span className="font-medium">{t("importedTitle")}</span> {t("importedHint")}
      </span>
    </p>
  );
}
