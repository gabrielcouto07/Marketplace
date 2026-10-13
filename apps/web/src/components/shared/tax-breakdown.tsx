"use client";

import type { ImportTaxBreakdownDto, Money } from "@marketplace/contracts";
import { Landmark, PackageCheck } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Valores discriminados da remessa, como pedem o critério ii da Portaria Coana 130/2023 (art. 8º) e o item 4.2 do
 * Programa de Conformidade: produto, frete e seguro, descontos, despesas, II, ICMS, IBS, CBS, total e taxa de câmbio.
 * - `full`: a conta inteira (página de produto, resumo do checkout e detalhe do pedido);
 * - `taxes`: só os tributos e a nota de câmbio. Antes do fechamento o valor é prévia: fica definitivo no pedido,
 *   quando entra o frete de cada loja.
 */
export function TaxBreakdown({
  taxes,
  mode = "full",
  withoutFreight,
  freightIncluded,
  freightPending,
  showTotal,
  listingDiscount,
  className,
}: {
  taxes: ImportTaxBreakdownDto;
  mode?: "full" | "taxes";
  /** Conta sem o frete (exemplos, antes do checkout): a linha de frete diz que ele entra no fechamento. */
  withoutFreight?: boolean;
  /** Frete já incluído no preço do produto (frete grátis): a página diz isso expressamente (Programa 4.2 b). */
  freightIncluded?: boolean;
  /** Frete ainda não cotado (página de produto sem CEP): a linha pede o CEP. */
  freightPending?: boolean;
  /** Linha "Total a pagar" (produto + frete + seguro + despesas − desconto + tributos), Programa 4.2 i. */
  showTotal?: boolean;
  /**
   * Promoção do próprio anúncio ("de R$ X por R$ Y"), já embutida no preço: a linha de produto mostra o preço "de" e a
   * de descontos mostra a diferença (Programa 4.2 a e c). O valor aduaneiro e os tributos não mudam.
   */
  listingDiscount?: Money;
  className?: string;
}) {
  const t = useTranslations("taxes");
  const format = useFormatter();
  // Dólar no idioma da página ("US$ 166,48"), não no padrão en-US da moeda.
  const locale = useLocale();
  const pct = (bp: number) =>
    format.number(bp / 10_000, { style: "percent", maximumFractionDigits: 2 });
  const zero = (m: Money) => m.amount === 0;
  const estimate = !taxes.isFinal;
  const preview = !estimate && (mode === "taxes" || Boolean(withoutFreight) || Boolean(freightPending));
  const freightValue = freightIncluded
    ? t("freightIncluded")
    : freightPending
      ? t("freightPending")
      : withoutFreight
        ? t("freightAtCheckout")
        : zero(taxes.freight)
          ? t("free")
          : formatMoney(taxes.freight);

  const listing = listingDiscount && listingDiscount.amount > 0 ? listingDiscount.amount : 0;
  const products: Money = { ...taxes.products, amount: taxes.products.amount + listing };
  const discount: Money = { ...taxes.discount, amount: taxes.discount.amount + listing };

  // −1 = a alíquota varia entre as remessas da compra (0% é faixa válida: até US$ 50, Portaria MF 1.342/2026).
  const dutyVaries = taxes.importDutyBasisPoints < 0;
  const dutyRate = pct(Math.max(0, taxes.importDutyBasisPoints));
  const deductionUsd = taxes.importDutyDeductionUsd ? formatMoney(taxes.importDutyDeductionUsd, { locale }) : null;
  const highTier = taxes.importDutyDeduction.amount > 0 || (taxes.customsValueUsd?.amount ?? 0) > 50_00;
  const dutyLabel = dutyVaries
    ? t("importDuty")
    : taxes.importDutyDeduction.amount > 0
      ? deductionUsd
        ? t("importDutyHigh", { rate: dutyRate, deduction: deductionUsd })
        : t("importDutyHighPlain", { rate: dutyRate })
      : t("importDutyRate", { rate: dutyRate });
  const deductionHint =
    taxes.importDutyDeduction.amount > 0
      ? deductionUsd
        ? t("deduction", { usd: deductionUsd, value: formatMoney(taxes.importDutyDeduction) })
        : t("deductionPlain", { value: formatMoney(taxes.importDutyDeduction) })
      : undefined;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {mode === "full" ? (
        <dl className="flex flex-col gap-2">
          {/* Na ordem do item 4.2: produto, frete e seguro, descontos (sempre, mesmo zerados) e demais despesas. */}
          <Row label={t("products")} value={formatMoney(products)} />
          <Row
            label={t("freight")}
            value={freightValue}
            muted={Boolean(withoutFreight) || Boolean(freightPending)}
            valueClassName={freightIncluded ? "text-success" : undefined}
          />
          <Row label={t("insurance")} value={formatMoney(taxes.insurance)} muted={zero(taxes.insurance)} />
          <Row
            label={t("discount")}
            hint={listing > 0 ? t("listingDiscountHint") : undefined}
            value={zero(discount) ? formatMoney(discount) : `− ${formatMoney(discount)}`}
            muted={zero(discount)}
            valueClassName={zero(discount) ? undefined : "text-success"}
          />
          <Row label={t("otherExpenses")} value={formatMoney(taxes.otherExpenses)} muted={zero(taxes.otherExpenses)} />
          <Row
            label={t("customsValue")}
            hint={
              taxes.customsValueUsd
                ? t("customsValueUsd", { usd: formatMoney(taxes.customsValueUsd, { locale }) })
                : undefined
            }
            value={formatMoney(taxes.customsValue)}
            strong
          />
        </dl>
      ) : null}

      <div className="flex flex-col gap-2 rounded-md bg-surface-muted p-3">
        <p className="flex items-center gap-2 text-caption font-bold text-foreground-secondary uppercase">
          <Landmark className="size-4" strokeWidth={2} aria-hidden />
          {estimate || preview ? t("taxesEstimated") : t("taxesTitle")}
        </p>
        <dl className="flex flex-col gap-1.5">
          <Row
            label={dutyLabel}
            hint={deductionHint}
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

      {showTotal ? (
        <dl>
          <Row
            label={freightPending || withoutFreight ? t("totalToPayWithoutFreight") : t("totalToPay")}
            value={formatMoney(taxes.total)}
            strong
          />
        </dl>
      ) : null}

      <ul className="flex flex-col gap-1 text-caption text-foreground-secondary">
        <li>
          {estimate
            ? t("noteEstimate", { rate: pct(taxes.importDutyBasisPoints > 0 ? taxes.importDutyBasisPoints : taxes.effectiveBasisPoints) })
            : preview
              ? t("notePreview")
              : t("noteFinal")}
        </li>
        {taxes.usdRate ? (
          <li className="tabular-nums">
            {t("noteRateAt", {
              rate: taxes.usdRate.displayRate,
              date: format.dateTime(new Date(taxes.usdRate.quotedAt), { dateStyle: "short" }),
            })}
          </li>
        ) : null}
        {!estimate && !dutyVaries ? (
          <li>
            {!highTier
              ? t("noteLowTier", { rate: dutyRate })
              : deductionUsd
                ? t("noteHighTier", { rate: dutyRate, usd: deductionUsd })
                : t("noteHighTierPlain", { rate: dutyRate })}
          </li>
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

/**
 * Aviso de produto importado e tributado (Programa 4.1): o produto vem do exterior e será importado, e a compra é
 * objeto de declaração de importação, sujeita à tributação federal e estadual. Página de produto e carrinho.
 */
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
