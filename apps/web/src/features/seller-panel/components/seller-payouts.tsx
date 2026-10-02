"use client";

import type { PayoutStatus } from "@marketplace/contracts";
import { Banknote, CalendarClock, CheckCircle2, Hourglass } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { PanelTitle } from "@/components/layout/panel-shell";
import {
  FilterSelect,
  KpiCard,
  KpiGrid,
  PanelCard,
  PanelToolbar,
} from "@/components/shared/panel-widgets";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/money";

import { useSellerPayoutSummary, useSellerPayouts } from "../api";

type PayoutFilter = "all" | PayoutStatus;

const PAYOUT_FILTERS: readonly PayoutFilter[] = ["all", "Agendado", "Processando", "Pago", "Falhou"];

const PAYOUT_BADGE: Record<PayoutStatus, "neutral" | "soft" | "success" | "danger"> = {
  Agendado: "neutral",
  Processando: "soft",
  Pago: "success",
  Falhou: "danger",
};

/** Ledger de repasses da loja: o que já foi pago, o que está agendado e o que caiu por cancelamento/estorno. */
export function SellerPayouts() {
  const t = useTranslations("sellerPanel");
  const format = useFormatter();
  const [status, setStatus] = useState<PayoutFilter>("all");
  const summary = useSellerPayoutSummary();
  const payouts = useSellerPayouts({
    status: status === "all" ? undefined : status,
    pageSize: 50,
  });

  const statusLabel = (s: PayoutStatus) => t(`payoutStatus_${s}`);
  const items = Object.fromEntries(
    PAYOUT_FILTERS.map((s) => [s, s === "all" ? t("filterAllStatus") : statusLabel(s)]),
  ) as Record<PayoutFilter, string>;

  const s = summary.data;
  const kpis = s
    ? [
        { label: t("payoutsScheduled"), value: formatMoney(s.scheduled), icon: CalendarClock },
        { label: t("payoutsProcessing"), value: formatMoney(s.processing), icon: Hourglass },
        { label: t("payoutsPaid"), value: formatMoney(s.paid), icon: CheckCircle2 },
        { label: t("payoutsFailed"), value: formatMoney(s.failed), icon: Banknote },
      ]
    : [];

  return (
    <div>
      <PanelTitle>{t("payouts")}</PanelTitle>
      <p className="mb-6 -mt-4 max-w-2xl text-body-sm text-foreground-secondary">
        {t("payoutsIntro")}
      </p>

      {summary.isError ? null : s ? (
        <KpiGrid className="mb-6">
          {kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} />
          ))}
        </KpiGrid>
      ) : (
        <KpiGrid className="mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </KpiGrid>
      )}

      <PanelToolbar>
        <FilterSelect
          id="seller-payouts-status"
          label={t("filterStatus")}
          value={status}
          onChange={setStatus}
          items={items}
          className="sm:w-64"
        />
      </PanelToolbar>

      {payouts.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : payouts.isError ? (
        <ErrorState error={payouts.error} onRetry={() => payouts.refetch()} />
      ) : payouts.data.items.length === 0 ? (
        <EmptyState
          illustration="box"
          title={status === "all" ? t("payoutsEmptyTitle") : t("emptyTitle")}
          description={status === "all" ? t("payoutsEmptyDescription") : t("emptyDescription")}
        />
      ) : (
        <PanelCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colOrder")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("colPayoutScheduledFor")}</TableHead>
                <TableHead className="hidden text-right md:table-cell">{t("colPayoutGross")}</TableHead>
                <TableHead className="hidden text-right md:table-cell">{t("colPayoutFees")}</TableHead>
                <TableHead className="text-right">{t("colPayoutNet")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium tabular-nums">{p.orderNumber}</TableCell>
                  <TableCell className="hidden text-foreground-secondary tabular-nums sm:table-cell">
                    {format.dateTime(new Date(p.paidAt ?? p.scheduledFor), "short")}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {formatMoney(p.gross)}
                  </TableCell>
                  <TableCell className="hidden text-right text-foreground-secondary tabular-nums md:table-cell">
                    −{formatMoney({ amount: p.platformFee.amount + p.paymentFee.amount, currency: "BRL" })}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatMoney(p.net)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={PAYOUT_BADGE[p.status]}>{statusLabel(p.status)}</Badge>
                    {p.failureReason ? (
                      <span className="mt-1 block max-w-[200px] text-caption text-foreground-secondary">
                        {p.failureReason}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelCard>
      )}
    </div>
  );
}
