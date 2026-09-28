"use client";

import type { PaymentStatus, PayoutStatus } from "@marketplace/contracts";
import { RotateCcw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FilterSelect,
  PanelCard,
  PanelToolbar,
  SearchInput,
} from "@/components/shared/panel-widgets";
import { useDebouncedValue } from "@/hooks/use-debounce";

import { useAdminPayments, useAdminPayoutAction, useAdminPayouts, useAdminRefund } from "../api";
import {
  Pager,
  PaymentStatusBadge,
  PayoutStatusBadge,
  brl,
  useAdminErrorToast,
} from "./admin-widgets";

const PAYMENT_STATUSES: PaymentStatus[] = [
  "Pendente",
  "Aprovado",
  "Recusado",
  "Expirado",
  "Estornado",
];
const PAYOUT_STATUSES: PayoutStatus[] = ["Agendado", "Processando", "Pago", "Falhou"];

export function AdminPayments() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const format = useFormatter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | PaymentStatus>("all");
  const [page, setPage] = useState(1);
  const [refunding, setRefunding] = useState<string | null>(null);
  const debounced = useDebouncedValue(query, 300);
  const list = useAdminPayments({
    q: debounced || undefined,
    status: filter === "all" ? undefined : filter,
    page,
    pageSize: 25,
  });
  const refund = useAdminRefund();
  const onError = useAdminErrorToast();
  const items = {
    all: t("filterAllStatus"),
    ...Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, t(`paymentStatus.${s}`)])),
  } as Record<"all" | PaymentStatus, string>;

  return (
    <div>
      <PanelTitle>{t("payments")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-payments-search"
          label={t("searchPayments")}
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          className="sm:w-80"
        />
        <FilterSelect
          id="admin-payments-status"
          label={t("filterStatus")}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          items={items}
          className="sm:w-56"
        />
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          illustration="search"
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <>
          <PanelCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colOrders")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("colBuyer")}</TableHead>
                  <TableHead>{t("colMethod")}</TableHead>
                  <TableHead className="text-right">{t("colAmount")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="block font-medium tabular-nums">
                        {p.orderNumbers.join(", ") || p.id.slice(0, 8)}
                      </span>
                      <span className="block text-caption text-foreground-secondary tabular-nums">
                        {format.dateTime(new Date(p.createdAt), "dateTime")} · {p.gateway}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-foreground-secondary sm:table-cell">
                      {p.buyerEmail}
                    </TableCell>
                    <TableCell>{p.method}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {brl(p.amount.amount)}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={p.status} />
                      {p.failureReason ? (
                        <span className="mt-1 block max-w-[160px] truncate text-caption text-foreground-secondary">
                          {p.failureReason}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === "Aprovado" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger"
                          onClick={() => setRefunding(p.id)}
                        >
                          <RotateCcw data-icon="inline-start" strokeWidth={1.75} /> {t("refund")}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelCard>
          <Pager
            page={list.data.page}
            pageSize={list.data.pageSize}
            totalCount={list.data.totalCount}
            onChange={setPage}
          />
        </>
      )}
      <Dialog open={Boolean(refunding)} onOpenChange={(open) => !open && setRefunding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("refund")}</DialogTitle>
            <DialogDescription>{t("refundConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRefunding(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              loading={refund.isPending}
              onClick={() =>
                refunding &&
                refund.mutate(refunding, {
                  onSuccess: () => {
                    toast.success(t("refunded"));
                    setRefunding(null);
                  },
                  onError,
                })
              }
            >
              {t("refund")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminPayouts() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const [filter, setFilter] = useState<"all" | PayoutStatus>("all");
  const [page, setPage] = useState(1);
  const list = useAdminPayouts({
    status: filter === "all" ? undefined : filter,
    page,
    pageSize: 25,
  });
  const action = useAdminPayoutAction();
  const onError = useAdminErrorToast();
  const items = {
    all: t("filterAllStatus"),
    ...Object.fromEntries(PAYOUT_STATUSES.map((s) => [s, t(`payoutStatus.${s}`)])),
  } as Record<"all" | PayoutStatus, string>;
  const total = list.data?.items.reduce((sum, p) => sum + p.net.amount, 0) ?? 0;

  return (
    <div>
      <PanelTitle>{t("payouts")}</PanelTitle>
      <PanelToolbar>
        <FilterSelect
          id="admin-payouts-state"
          label={t("filterStatus")}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          items={items}
          className="sm:w-56"
        />
        <p className="text-body-sm text-foreground-secondary sm:ml-auto">
          {t("payoutTotal")}{" "}
          <span className="font-semibold text-foreground tabular-nums">{brl(total)}</span>
        </p>
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          illustration="box"
          title={t("payoutsEmptyTitle")}
          description={t("payoutsEmptyDescription")}
        />
      ) : (
        <>
          <PanelCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colSeller")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("colOrder")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colScheduled")}</TableHead>
                  <TableHead className="text-right">{t("colNet")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.sellerName}</TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">
                      {p.orderNumber}
                    </TableCell>
                    <TableCell className="hidden text-foreground-secondary tabular-nums md:table-cell">
                      {format.dateTime(new Date(p.scheduledFor), "short")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-medium">{brl(p.net.amount)}</span>
                      <span className="block text-caption text-foreground-secondary">
                        {t("payoutBreakdown", {
                          gross: brl(p.gross.amount),
                          fee: brl(p.platformFee.amount + p.paymentFee.amount),
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <PayoutStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {p.status === "Agendado" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={action.isPending && action.variables?.id === p.id}
                          onClick={() =>
                            action.mutate({ id: p.id, action: "processing" }, { onError })
                          }
                        >
                          {t("payoutProcess")}
                        </Button>
                      ) : null}
                      {p.status === "Agendado" || p.status === "Processando" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="ml-2"
                          loading={action.isPending && action.variables?.id === p.id}
                          onClick={() =>
                            action.mutate(
                              { id: p.id, action: "mark-paid" },
                              { onSuccess: () => toast.success(t("payoutPaidToast")), onError },
                            )
                          }
                        >
                          {t("payoutMarkPaid")}
                        </Button>
                      ) : null}
                      {p.status === "Falhou" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={action.isPending && action.variables?.id === p.id}
                          onClick={() => action.mutate({ id: p.id, action: "retry" }, { onError })}
                        >
                          {t("payoutRetry")}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelCard>
          <Pager
            page={list.data.page}
            pageSize={list.data.pageSize}
            totalCount={list.data.totalCount}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
