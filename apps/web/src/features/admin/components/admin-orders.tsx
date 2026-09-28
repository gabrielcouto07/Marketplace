"use client";

import type { AdminOrderListItemDto, OrderStatus } from "@marketplace/contracts";
import { AlertOctagon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { FormField } from "@/components/shared/form-field";
import { OrderStatusBadge, OrderTimeline } from "@/components/shared/order-status";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  FilterSelect,
  PanelCard,
  PanelToolbar,
  SearchInput,
} from "@/components/shared/panel-widgets";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { Link } from "@/i18n/navigation";

import { useAdminOrder, useAdminOrderMutations, useAdminOrders } from "../api";
import {
  DetailSheet,
  DetailSkeleton,
  KeyValueList,
  Pager,
  PaymentStatusBadge,
  PayoutStatusBadge,
  SheetSection,
  brl,
  rowButtonClass,
  useAdminErrorToast,
} from "./admin-widgets";

const ORDER_FILTERS = [
  "all",
  "AguardandoPagamento",
  "Pago",
  "EmPreparacao",
  "Enviado",
  "EmTransitoInternacional",
  "Entregue",
  "Concluido",
  "EmDisputa",
  "Devolvido",
  "Reembolsado",
  "Cancelado",
] as const;
type OrderFilter = (typeof ORDER_FILTERS)[number];

export function OrdersTable({
  orders,
  onSelect,
}: {
  orders: AdminOrderListItemDto[];
  onSelect?: (o: AdminOrderListItemDto) => void;
}) {
  const t = useTranslations("admin");
  const format = useFormatter();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("colOrder")}</TableHead>
          <TableHead>{t("colBuyer")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("colSeller")}</TableHead>
          <TableHead className="hidden sm:table-cell">{t("colDate")}</TableHead>
          <TableHead className="text-right">{t("colTotal")}</TableHead>
          <TableHead>{t("colStatus")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => (
          <TableRow
            key={o.id}
            className={onSelect ? rowButtonClass() : undefined}
            onClick={onSelect ? () => onSelect(o) : undefined}
          >
            <TableCell className="font-medium tabular-nums">
              {onSelect ? (
                <button type="button" className="rounded-sm focus-ring">
                  {o.number}
                </button>
              ) : (
                o.number
              )}
            </TableCell>
            <TableCell>
              <span className="block max-w-[160px] truncate">{o.buyerName}</span>
              <span className="block truncate text-caption text-foreground-secondary">
                {o.buyerEmail}
              </span>
            </TableCell>
            <TableCell className="hidden text-foreground-secondary md:table-cell">
              {o.sellerName}
            </TableCell>
            <TableCell className="hidden text-foreground-secondary tabular-nums sm:table-cell">
              {format.dateTime(new Date(o.createdAt), "short")}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {brl(o.total.amount)}
            </TableCell>
            <TableCell>
              <OrderStatusBadge status={o.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OrderDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("admin");
  const ts = useTranslations("orders.status");
  const format = useFormatter();
  const detail = useAdminOrder(id);
  const { transition, resolve } = useAdminOrderMutations();
  const onError = useAdminErrorToast();
  const [target, setTarget] = useState<OrderStatus | "">("");
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");
  const [outcome, setOutcome] = useState<"Devolvido" | "Reembolsado" | "Concluido">("Reembolsado");

  const d = detail.data;
  const o = d?.order;
  const transitions: OrderStatus[] = o
    ? (
        {
          AguardandoPagamento: ["Pago", "Cancelado"],
          Pago: ["EmPreparacao", "Cancelado"],
          EmPreparacao: ["Enviado", "Cancelado"],
          Enviado: ["EmTransitoInternacional", "Entregue"],
          EmTransitoInternacional: ["Entregue"],
          Entregue: ["Concluido"],
          EmDisputa: [],
          Devolvido: ["Reembolsado"],
          Concluido: [],
          Cancelado: [],
          Reembolsado: [],
        } as Record<OrderStatus, OrderStatus[]>
      )[o.status]
    : [];
  const transitionItems = Object.fromEntries(transitions.map((s) => [s, ts(s)]));
  const outcomeItems = {
    Reembolsado: t("outcomeRefund"),
    Devolvido: t("outcomeReturn"),
    Concluido: t("outcomeSeller"),
  };

  return (
    <DetailSheet
      open={Boolean(id)}
      onClose={onClose}
      title={o ? t("orderSheetTitle", { number: o.number }) : t("orders")}
      description={o ? `${d.buyer.fullName} · ${o.seller.name}` : undefined}
    >
      {detail.isPending ? (
        <DetailSkeleton />
      ) : detail.isError ? (
        <ErrorState error={detail.error} compact />
      ) : o ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={o.status} />
            <PaymentStatusBadge status={d.payment.status} />
            {d.payout ? <PayoutStatusBadge status={d.payout.status} /> : null}
          </div>

          <SheetSection title={t("sheetSummary")}>
            <KeyValueList
              items={[
                {
                  label: t("colBuyer"),
                  value: (
                    <Link
                      className="text-primary"
                      href={`/admin/compradores?q=${encodeURIComponent(d.buyer.email)}`}
                    >
                      {d.buyer.email}
                    </Link>
                  ),
                },
                {
                  label: t("colSeller"),
                  value: (
                    <Link
                      className="text-primary"
                      href={`/admin/vendedores?q=${encodeURIComponent(o.seller.name)}`}
                    >
                      {o.seller.name}
                    </Link>
                  ),
                },
                { label: t("colDate"), value: format.dateTime(new Date(o.createdAt), "dateTime") },
                { label: t("colTotal"), value: brl(o.totals.total.amount) },
                { label: t("sheetImportTax"), value: brl(o.totals.importTax.amount) },
                {
                  label: t("sheetShipping"),
                  value: `${o.shippingOption.service} · ${brl(o.totals.shipping.amount)}`,
                },
                { label: t("sheetTracking"), value: o.trackingCode ?? "—" },
                {
                  label: t("sheetPayment"),
                  value: d.payment.method,
                },
                {
                  label: t("sheetAddress"),
                  value: `${o.shippingAddress.street}, ${o.shippingAddress.number} · ${o.shippingAddress.city}/${o.shippingAddress.state}`,
                },
              ]}
            />
          </SheetSection>

          <SheetSection title={t("sheetItems")}>
            <ul className="divide-y divide-border rounded-md border border-border">
              {o.items.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-body-sm"
                >
                  <span className="min-w-0 truncate">
                    {i.quantity}× {i.name}
                    {i.variantLabel ? (
                      <span className="text-foreground-secondary"> · {i.variantLabel}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums">{brl(i.lineTotal.amount)}</span>
                </li>
              ))}
            </ul>
          </SheetSection>

          <SheetSection title={t("sheetTimeline")}>
            <OrderTimeline status={o.status} events={o.timeline} />
          </SheetSection>

          {o.status === "EmDisputa" ? (
            <SheetSection title={t("resolveDispute")}>
              <FormField id="dispute-outcome" label={t("outcome")}>
                <Select
                  value={outcome}
                  onValueChange={(v) => setOutcome((v as typeof outcome) ?? "Reembolsado")}
                  items={outcomeItems}
                >
                  <SelectTrigger id="dispute-outcome" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(outcomeItems).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField id="dispute-note" label={t("note")} optional>
                <Textarea
                  id="dispute-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </FormField>
              <Button
                variant="primary"
                loading={resolve.isPending}
                onClick={() =>
                  resolve.mutate(
                    { id: o.id, body: { outcome, note: note || undefined } },
                    {
                      onSuccess: () => {
                        toast.success(t("disputeResolved"));
                        setNote("");
                      },
                      onError,
                    },
                  )
                }
              >
                <AlertOctagon data-icon="inline-start" strokeWidth={1.75} /> {t("resolveDispute")}
              </Button>
            </SheetSection>
          ) : transitions.length ? (
            <SheetSection title={t("forceStatus")}>
              <p className="text-caption text-foreground-secondary">{t("forceStatusHint")}</p>
              <FormField id="transition-status" label={t("newStatus")}>
                <Select
                  value={target}
                  onValueChange={(v) => setTarget((v as OrderStatus) ?? "")}
                  items={transitionItems}
                >
                  <SelectTrigger id="transition-status" className="w-full">
                    <SelectValue placeholder={t("choose")} />
                  </SelectTrigger>
                  <SelectContent>
                    {transitions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ts(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              {target === "Enviado" ? (
                <FormField id="transition-tracking" label={t("sheetTracking")}>
                  <Input
                    id="transition-tracking"
                    className="uppercase tabular-nums"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                  />
                </FormField>
              ) : null}
              <FormField id="transition-note" label={t("note")} optional>
                <Textarea
                  id="transition-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </FormField>
              <Button
                variant={target === "Cancelado" ? "destructive" : "primary"}
                disabled={!target}
                loading={transition.isPending}
                onClick={() =>
                  target &&
                  transition.mutate(
                    {
                      id: o.id,
                      body: {
                        status: target,
                        note: note || undefined,
                        trackingCode: tracking || undefined,
                      },
                    },
                    {
                      onSuccess: () => {
                        toast.success(t("statusChanged"));
                        setTarget("");
                        setNote("");
                      },
                      onError,
                    },
                  )
                }
              >
                {t("applyStatus")}
              </Button>
            </SheetSection>
          ) : null}
        </>
      ) : null}
    </DetailSheet>
  );
}

function useOrdersList(fixed: { status?: OrderStatus; inTransit?: boolean }) {
  const params = useSearchParams();
  const initialStatus = (params.get("status") as OrderFilter | null) ?? "all";
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<OrderFilter>(
    ORDER_FILTERS.includes(initialStatus) ? initialStatus : "all",
  );
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(query, 300);
  const list = useAdminOrders({
    q: debounced || undefined,
    status: fixed.status ?? (status === "all" ? undefined : (status as OrderStatus)),
    inTransit: fixed.inTransit ?? (params.get("inTransit") === "1" ? true : undefined),
    page,
    pageSize: 25,
  });
  return { query, setQuery, status, setStatus, page, setPage, list };
}

export function AdminOrders() {
  const t = useTranslations("admin");
  const ts = useTranslations("orders.status");
  const { query, setQuery, status, setStatus, setPage, list } = useOrdersList({});
  const [selected, setSelected] = useState<string | null>(null);
  const items = Object.fromEntries(
    ORDER_FILTERS.map((s) => [s, s === "all" ? t("filterAllStatus") : ts(s)]),
  ) as Record<OrderFilter, string>;

  return (
    <div>
      <PanelTitle>{t("orders")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-orders-search"
          label={t("searchOrders")}
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          className="sm:w-80"
        />
        <FilterSelect
          id="admin-orders-status"
          label={t("filterStatus")}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          items={items}
          className="sm:w-64"
        />
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          illustration="box"
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setStatus("all");
              }}
            >
              {t("clearFilters")}
            </Button>
          }
        />
      ) : (
        <>
          <PanelCard>
            <OrdersTable orders={list.data.items} onSelect={(o) => setSelected(o.id)} />
          </PanelCard>
          <Pager
            page={list.data.page}
            pageSize={list.data.pageSize}
            totalCount={list.data.totalCount}
            onChange={setPage}
          />
        </>
      )}
      <OrderDetail id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export function AdminDisputes() {
  const t = useTranslations("admin");
  const { query, setQuery, setPage, list } = useOrdersList({ status: "EmDisputa" });
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <PanelTitle>{t("disputes")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-disputes-search"
          label={t("searchDisputes")}
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          className="sm:w-80"
        />
        {list.data ? (
          <Badge variant="danger" className="self-start sm:self-center">
            <AlertOctagon strokeWidth={1.75} aria-hidden />{" "}
            {t("disputesCount", { count: list.data.totalCount })}
          </Badge>
        ) : null}
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          illustration="check"
          title={t("disputesEmptyTitle")}
          description={t("disputesEmptyDescription")}
        />
      ) : (
        <>
          <PanelCard>
            <OrdersTable orders={list.data.items} onSelect={(o) => setSelected(o.id)} />
          </PanelCard>
          <Pager
            page={list.data.page}
            pageSize={list.data.pageSize}
            totalCount={list.data.totalCount}
            onChange={setPage}
          />
        </>
      )}
      <OrderDetail id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
