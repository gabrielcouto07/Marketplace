"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { OrderStatus } from "@marketplace/contracts";
import {
  AlertOctagon,
  Banknote,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PanelShell, PanelTitle, SkeletonNotice } from "@/components/layout/panel-shell";
import { FormField } from "@/components/shared/form-field";
import { OrderStatusBadge } from "@/components/shared/order-status";
import { EmptyState, SectionHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  KpiCard,
  KpiGrid,
  matchesQuery,
  PanelCard,
  PanelToolbar,
  SearchInput,
  type KpiDelta,
} from "@/components/shared/panel-widgets";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { emailSchema } from "@/lib/validation/schemas";

export type AdminSection =
  "overview" | "sellers" | "buyers" | "orders" | "disputes" | "payouts" | "settings";

/* ------------------------------------------------------------------ */
/* Casca                                                                */
/* ------------------------------------------------------------------ */

export function AdminPanelShell({ children }: { children: ReactNode }) {
  const t = useTranslations("admin");
  const items = [
    { href: "/admin", label: t("overview"), icon: LayoutDashboard },
    { href: "/admin/vendedores", label: t("sellers"), icon: Store },
    { href: "/admin/compradores", label: t("buyers"), icon: Users },
    { href: "/admin/pedidos", label: t("orders"), icon: ShoppingBag },
    { href: "/admin/disputas", label: t("disputes"), icon: AlertOctagon },
    { href: "/admin/repasses", label: t("payouts"), icon: Banknote },
    { href: "/admin/configuracoes", label: t("settings"), icon: Settings },
  ];
  return (
    <PanelShell title={t("title")} subtitle={t("subtitle")} items={items}>
      {children}
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/* Dados fixos (mock) — serão ligados a GET /admin/*                    */
/* ------------------------------------------------------------------ */

type SellerState = "active" | "pending" | "suspended";

interface AdminSeller {
  id: string;
  name: string;
  ruc: string;
  products: number;
  sales: number;
  state: SellerState;
}

const SELLERS: AdminSeller[] = [
  {
    id: "s1",
    name: "TechCDE Importados",
    ruc: "80012345-6",
    products: 128,
    sales: 48_900_000,
    state: "active",
  },
  {
    id: "s2",
    name: "Perfumaria del Este",
    ruc: "80098765-1",
    products: 64,
    sales: 21_450_000,
    state: "active",
  },
  {
    id: "s3",
    name: "GamerPY",
    ruc: "80045678-9",
    products: 41,
    sales: 12_300_000,
    state: "active",
  },
  { id: "s4", name: "Casa Nipón", ruc: "80031122-3", products: 12, sales: 0, state: "pending" },
  {
    id: "s5",
    name: "Móvil Paraguay",
    ruc: "80067890-2",
    products: 33,
    sales: 8_120_000,
    state: "suspended",
  },
  {
    id: "s6",
    name: "Relojería Oriental",
    ruc: "80078901-4",
    products: 27,
    sales: 5_640_000,
    state: "active",
  },
];

interface AdminBuyer {
  id: string;
  name: string;
  email: string;
  orders: number;
  signup: string;
}

const BUYERS: AdminBuyer[] = [
  {
    id: "b1",
    name: "Ana Souza",
    email: "ana.souza@example.com",
    orders: 7,
    signup: "2026-03-12T10:00:00Z",
  },
  {
    id: "b2",
    name: "Carlos Lima",
    email: "carlos.lima@example.com",
    orders: 3,
    signup: "2026-05-02T10:00:00Z",
  },
  {
    id: "b3",
    name: "Beatriz Rocha",
    email: "bia.rocha@example.com",
    orders: 12,
    signup: "2025-11-20T10:00:00Z",
  },
  {
    id: "b4",
    name: "João Pereira",
    email: "joao.p@example.com",
    orders: 1,
    signup: "2026-09-18T10:00:00Z",
  },
  {
    id: "b5",
    name: "Marina Alves",
    email: "marina.alves@example.com",
    orders: 5,
    signup: "2026-01-08T10:00:00Z",
  },
  {
    id: "b6",
    name: "Pedro Nunes",
    email: "pedro.nunes@example.com",
    orders: 2,
    signup: "2026-07-27T10:00:00Z",
  },
];

interface AdminOrder {
  id: string;
  buyer: string;
  seller: string;
  date: string;
  total: number;
  status: OrderStatus;
}

const ORDERS: AdminOrder[] = [
  {
    id: "MP-10482",
    buyer: "Ana Souza",
    seller: "TechCDE Importados",
    date: "2026-09-24T14:12:00Z",
    total: 189_900,
    status: "Pago",
  },
  {
    id: "MP-10481",
    buyer: "Carlos Lima",
    seller: "Perfumaria del Este",
    date: "2026-09-24T09:40:00Z",
    total: 429_000,
    status: "EmPreparacao",
  },
  {
    id: "MP-10477",
    buyer: "Beatriz Rocha",
    seller: "GamerPY",
    date: "2026-09-23T18:05:00Z",
    total: 99_900,
    status: "Enviado",
  },
  {
    id: "MP-10470",
    buyer: "João Pereira",
    seller: "TechCDE Importados",
    date: "2026-09-22T11:30:00Z",
    total: 1_299_000,
    status: "EmTransitoInternacional",
  },
  {
    id: "MP-10466",
    buyer: "Marina Alves",
    seller: "Relojería Oriental",
    date: "2026-09-21T16:22:00Z",
    total: 74_900,
    status: "Entregue",
  },
  {
    id: "MP-10459",
    buyer: "Rafael Costa",
    seller: "GamerPY",
    date: "2026-09-20T08:15:00Z",
    total: 259_900,
    status: "AguardandoPagamento",
  },
  {
    id: "MP-10452",
    buyer: "Luana Martins",
    seller: "Perfumaria del Este",
    date: "2026-09-19T13:48:00Z",
    total: 359_000,
    status: "Concluido",
  },
  {
    id: "MP-10448",
    buyer: "Pedro Nunes",
    seller: "Móvil Paraguay",
    date: "2026-09-18T10:02:00Z",
    total: 149_900,
    status: "EmDisputa",
  },
];

type DisputeState = "open" | "review" | "resolved";

interface AdminDispute {
  id: string;
  orderId: string;
  buyer: string;
  reason: string;
  openedAt: string;
  state: DisputeState;
}

const DISPUTES: AdminDispute[] = [
  {
    id: "d1",
    orderId: "MP-10448",
    buyer: "Pedro Nunes",
    reason: "Produto diferente do anunciado",
    openedAt: "2026-09-23T09:10:00Z",
    state: "open",
  },
  {
    id: "d2",
    orderId: "MP-10431",
    buyer: "Fernanda Dias",
    reason: "Não recebi o pedido",
    openedAt: "2026-09-21T15:32:00Z",
    state: "review",
  },
  {
    id: "d3",
    orderId: "MP-10419",
    buyer: "Marcos Vieira",
    reason: "Chegou com defeito",
    openedAt: "2026-09-19T11:48:00Z",
    state: "open",
  },
  {
    id: "d4",
    orderId: "MP-10402",
    buyer: "Camila Reis",
    reason: "Cobrança de imposto acima do estimado",
    openedAt: "2026-09-15T17:05:00Z",
    state: "resolved",
  },
];

type PayoutState = "paid" | "processing" | "scheduled";

interface AdminPayout {
  id: string;
  seller: string;
  period: string;
  amount: number;
  state: PayoutState;
}

const PAYOUTS: AdminPayout[] = [
  {
    id: "r1",
    seller: "TechCDE Importados",
    period: "16–30 set 2026",
    amount: 18_400_000,
    state: "scheduled",
  },
  {
    id: "r2",
    seller: "Perfumaria del Este",
    period: "16–30 set 2026",
    amount: 7_950_000,
    state: "scheduled",
  },
  { id: "r3", seller: "GamerPY", period: "01–15 set 2026", amount: 5_120_000, state: "processing" },
  {
    id: "r4",
    seller: "Relojería Oriental",
    period: "01–15 set 2026",
    amount: 2_310_000,
    state: "processing",
  },
  {
    id: "r5",
    seller: "TechCDE Importados",
    period: "01–15 set 2026",
    amount: 16_780_000,
    state: "paid",
  },
  {
    id: "r6",
    seller: "Perfumaria del Este",
    period: "16–31 ago 2026",
    amount: 6_430_000,
    state: "paid",
  },
];

const brl = (amount: number) => formatMoney({ amount, currency: "BRL" });

/* ------------------------------------------------------------------ */
/* Visão geral                                                          */
/* ------------------------------------------------------------------ */

export function AdminOverview() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const format = useFormatter();

  const kpis: Array<{ label: string; value: string; delta: KpiDelta }> = [
    {
      label: t("kpiGmv"),
      value: brl(98_760_000),
      delta: { value: "+15 %", tone: "success", direction: "up" },
    },
    {
      label: t("orders"),
      value: format.number(312),
      delta: { value: "+9 %", tone: "success", direction: "up" },
    },
    {
      label: t("buyers"),
      value: format.number(1240),
      delta: { value: "+64", tone: "success", direction: "up" },
    },
    {
      label: t("openDisputes"),
      value: format.number(4),
      delta: { value: "+2", tone: "danger", direction: "up" },
    },
  ];
  const recent = ORDERS.slice(0, 5);
  const open = DISPUTES.filter((d) => d.state !== "resolved");

  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("overview")}</PanelTitle>

      <KpiGrid>
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            delta={k.delta}
            compare={t("kpiCompare")}
          />
        ))}
      </KpiGrid>

      <div className="mt-8 flex flex-col gap-8">
        <section>
          <SectionHeader
            title={t("recentOrders")}
            action={
              <Button variant="link" size="sm" render={<Link href="/admin/pedidos" />}>
                {tc("seeAll")}
              </Button>
            }
          />
          <PanelCard>
            <OrdersTable orders={recent} />
          </PanelCard>
        </section>

        <section>
          <SectionHeader
            title={t("openDisputes")}
            action={
              <Button variant="link" size="sm" render={<Link href="/admin/disputas" />}>
                {tc("seeAll")}
              </Button>
            }
          />
          <PanelCard>
            <DisputeList disputes={open} />
          </PanelCard>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vendedores                                                           */
/* ------------------------------------------------------------------ */

type SellerFilter = "all" | SellerState;

const SELLER_BADGE: Record<SellerState, "success" | "warning" | "danger"> = {
  active: "success",
  pending: "warning",
  suspended: "danger",
};

export function AdminSellers() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SellerFilter>("all");
  const stateLabel: Record<SellerState, string> = {
    active: t("sellerActive"),
    pending: t("sellerPending"),
    suspended: t("sellerSuspended"),
  };
  const items: Record<SellerFilter, string> = { all: t("filterAllStatus"), ...stateLabel };
  const rows = SELLERS.filter(
    (s) => (state === "all" || s.state === state) && matchesQuery(query, s.name, s.ruc),
  );

  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("sellers")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-sellers-search"
          label={t("searchSellers")}
          value={query}
          onChange={setQuery}
          className="sm:w-80"
        />
        <FilterSelect
          id="admin-sellers-state"
          label={t("filterStatus")}
          value={state}
          onChange={setState}
          items={items}
          className="sm:w-56"
        />
      </PanelToolbar>
      {rows.length ? (
        <PanelCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colSeller")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("colRuc")}</TableHead>
                <TableHead className="text-right">{t("colProducts")}</TableHead>
                <TableHead className="text-right">{t("colSales")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="hidden text-foreground-secondary tabular-nums sm:table-cell">
                    {s.ruc}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {format.number(s.products)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {brl(s.sales)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={SELLER_BADGE[s.state]}>{stateLabel[s.state]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelCard>
      ) : (
        <NoResults
          onClear={() => {
            setQuery("");
            setState("all");
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compradores                                                          */
/* ------------------------------------------------------------------ */

export function AdminBuyers() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const [query, setQuery] = useState("");
  const rows = BUYERS.filter((b) => matchesQuery(query, b.name, b.email));

  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("buyers")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-buyers-search"
          label={t("searchBuyers")}
          value={query}
          onChange={setQuery}
          className="sm:w-80"
        />
      </PanelToolbar>
      {rows.length ? (
        <PanelCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colName")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("colEmail")}</TableHead>
                <TableHead className="text-right">{t("colOrders")}</TableHead>
                <TableHead>{t("colSignup")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="hidden text-foreground-secondary sm:table-cell">
                    {b.email}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {format.number(b.orders)}
                  </TableCell>
                  <TableCell className="text-foreground-secondary tabular-nums">
                    {format.dateTime(new Date(b.signup), "short")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelCard>
      ) : (
        <NoResults onClear={() => setQuery("")} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                              */
/* ------------------------------------------------------------------ */

function OrdersTable({ orders }: { orders: AdminOrder[] }) {
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
          <TableRow key={o.id}>
            <TableCell className="font-medium tabular-nums">#{o.id}</TableCell>
            <TableCell>{o.buyer}</TableCell>
            <TableCell className="hidden text-foreground-secondary md:table-cell">
              {o.seller}
            </TableCell>
            <TableCell className="hidden text-foreground-secondary tabular-nums sm:table-cell">
              {format.dateTime(new Date(o.date), "short")}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">{brl(o.total)}</TableCell>
            <TableCell>
              <OrderStatusBadge status={o.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

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
  "Cancelado",
] as const;
type OrderFilter = (typeof ORDER_FILTERS)[number];

export function AdminOrders() {
  const t = useTranslations("admin");
  const ts = useTranslations("orders.status");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderFilter>("all");
  const items = Object.fromEntries(
    ORDER_FILTERS.map((s) => [s, s === "all" ? t("filterAllStatus") : ts(s)]),
  ) as Record<OrderFilter, string>;
  const rows = ORDERS.filter(
    (o) =>
      (status === "all" || o.status === status) && matchesQuery(query, o.id, o.buyer, o.seller),
  );

  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("orders")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-orders-search"
          label={t("searchOrders")}
          value={query}
          onChange={setQuery}
          className="sm:w-80"
        />
        <FilterSelect
          id="admin-orders-status"
          label={t("filterStatus")}
          value={status}
          onChange={setStatus}
          items={items}
          className="sm:w-64"
        />
      </PanelToolbar>
      {rows.length ? (
        <PanelCard>
          <OrdersTable orders={rows} />
        </PanelCard>
      ) : (
        <NoResults
          onClear={() => {
            setQuery("");
            setStatus("all");
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Disputas                                                             */
/* ------------------------------------------------------------------ */

const DISPUTE_BADGE: Record<DisputeState, "danger" | "warning" | "success"> = {
  open: "danger",
  review: "warning",
  resolved: "success",
};

function DisputeList({ disputes }: { disputes: AdminDispute[] }) {
  const t = useTranslations("admin");
  const format = useFormatter();
  const stateLabel: Record<DisputeState, string> = {
    open: t("disputeOpen"),
    review: t("disputeReview"),
    resolved: t("disputeResolved"),
  };
  if (!disputes.length) {
    return (
      <EmptyState
        illustration="check"
        title={t("disputesEmptyTitle")}
        description={t("disputesEmptyDescription")}
      />
    );
  }
  return (
    <ul className="divide-y divide-border">
      {disputes.map((d) => (
        <li key={d.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-body-sm font-medium text-foreground tabular-nums">#{d.orderId}</p>
              <Badge variant={DISPUTE_BADGE[d.state]}>
                {d.state !== "resolved" ? <AlertOctagon strokeWidth={1.75} aria-hidden /> : null}
                {stateLabel[d.state]}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-body-sm text-foreground-secondary">{d.reason}</p>
            <p className="mt-1 text-caption text-foreground-muted">
              {d.buyer} ·{" "}
              <span className="tabular-nums">{format.dateTime(new Date(d.openedAt), "short")}</span>
            </p>
          </div>
          {d.state !== "resolved" ? (
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 self-start sm:self-center"
              onClick={() => toast.info(t("placeholder"))}
            >
              {t("review")}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

type DisputeFilter = "all" | DisputeState;

export function AdminDisputes() {
  const t = useTranslations("admin");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<DisputeFilter>("all");
  const items: Record<DisputeFilter, string> = {
    all: t("filterAllStatus"),
    open: t("disputeOpen"),
    review: t("disputeReview"),
    resolved: t("disputeResolved"),
  };
  const rows = DISPUTES.filter(
    (d) =>
      (state === "all" || d.state === state) && matchesQuery(query, d.orderId, d.buyer, d.reason),
  );

  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("disputes")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-disputes-search"
          label={t("searchDisputes")}
          value={query}
          onChange={setQuery}
          className="sm:w-80"
        />
        <FilterSelect
          id="admin-disputes-state"
          label={t("filterStatus")}
          value={state}
          onChange={setState}
          items={items}
          className="sm:w-56"
        />
      </PanelToolbar>
      {rows.length ? (
        <PanelCard>
          <DisputeList disputes={rows} />
        </PanelCard>
      ) : (
        <NoResults
          onClear={() => {
            setQuery("");
            setState("all");
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Repasses                                                             */
/* ------------------------------------------------------------------ */

type PayoutFilter = "all" | PayoutState;

const PAYOUT_BADGE: Record<PayoutState, "success" | "soft" | "neutral"> = {
  paid: "success",
  processing: "soft",
  scheduled: "neutral",
};

export function AdminPayouts() {
  const t = useTranslations("admin");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<PayoutFilter>("all");
  const stateLabel: Record<PayoutState, string> = {
    paid: t("payoutPaid"),
    processing: t("payoutProcessing"),
    scheduled: t("payoutScheduled"),
  };
  const items: Record<PayoutFilter, string> = { all: t("filterAllStatus"), ...stateLabel };
  const rows = PAYOUTS.filter(
    (p) => (state === "all" || p.state === state) && matchesQuery(query, p.seller, p.period),
  );
  const total = rows.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("payouts")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-payouts-search"
          label={t("searchPayouts")}
          value={query}
          onChange={setQuery}
          className="sm:w-80"
        />
        <FilterSelect
          id="admin-payouts-state"
          label={t("filterStatus")}
          value={state}
          onChange={setState}
          items={items}
          className="sm:w-56"
        />
        <p className="text-body-sm text-foreground-secondary sm:ml-auto">
          {t("payoutTotal")}{" "}
          <span className="font-semibold text-foreground tabular-nums">{brl(total)}</span>
        </p>
      </PanelToolbar>
      {rows.length ? (
        <PanelCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colSeller")}</TableHead>
                <TableHead>{t("colPeriod")}</TableHead>
                <TableHead className="text-right">{t("colAmount")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.seller}</TableCell>
                  <TableCell className="text-foreground-secondary">{p.period}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {brl(p.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={PAYOUT_BADGE[p.state]}>{stateLabel[p.state]}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelCard>
      ) : (
        <NoResults
          onClear={() => {
            setQuery("");
            setState("all");
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Configurações                                                        */
/* ------------------------------------------------------------------ */

export function AdminSettings() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const schema = z.object({
    commission: z
      .string()
      .trim()
      .min(1, "required")
      .refine((v) => {
        const n = Number(v.replace(",", "."));
        return Number.isFinite(n) && n >= 0 && n <= 30;
      }, t("commissionInvalid")),
    supportEmail: emailSchema,
  });
  type Values = z.infer<typeof schema>;
  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { commission: "12", supportEmail: "suporte@marketplacepy.com" },
  });
  const commissionId = "admin-commission";
  const emailId = "admin-support-email";
  const commissionError = formState.errors.commission?.message;
  const emailError = formState.errors.supportEmail?.message;

  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("settings")}</PanelTitle>
      <form
        onSubmit={handleSubmit(() => toast.success(t("settingsSaved")))}
        noValidate
        className="flex max-w-md flex-col gap-6 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-title-3 text-foreground">{t("settingsRules")}</h2>
          <p className="text-body-sm text-foreground-secondary">{t("settingsRulesHint")}</p>
        </div>
        <FormField
          id={commissionId}
          label={t("commissionLabel")}
          error={commissionError}
          hint={t("commissionHint")}
        >
          <Controller
            control={control}
            name="commission"
            render={({ field }) => (
              <Input
                id={commissionId}
                inputMode="decimal"
                placeholder="12"
                aria-invalid={Boolean(commissionError)}
                aria-describedby={
                  commissionError ? `${commissionId}-error` : `${commissionId}-hint`
                }
                className="tabular-nums sm:max-w-40"
                {...field}
              />
            )}
          />
        </FormField>
        <FormField
          id={emailId}
          label={t("supportEmailLabel")}
          error={emailError}
          hint={t("supportEmailHint")}
        >
          <Controller
            control={control}
            name="supportEmail"
            render={({ field }) => (
              <Input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? `${emailId}-error` : `${emailId}-hint`}
                {...field}
              />
            )}
          />
        </FormField>
        <Button type="submit" variant="primary" className="w-full sm:w-auto sm:self-start">
          {tc("save")}
        </Button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Utilitários                                                          */
/* ------------------------------------------------------------------ */

function NoResults({ onClear }: { onClear: () => void }) {
  const t = useTranslations("admin");
  return (
    <EmptyState
      illustration="box"
      title={t("emptyTitle")}
      description={t("emptyDescription")}
      action={
        <Button variant="secondary" onClick={onClear}>
          {t("clearFilters")}
        </Button>
      }
    />
  );
}
