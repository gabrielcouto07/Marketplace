"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { OrderStatus } from "@marketplace/contracts";
import {
  Banknote,
  HelpCircle,
  LayoutDashboard,
  Package,
  Plus,
  Settings,
  ShoppingBag,
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
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { formatRuc } from "@/lib/validation/documents";
import { rucSchema } from "@/lib/validation/schemas";

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

/* ------------------------------------------------------------------ */
/* Casca                                                                */
/* ------------------------------------------------------------------ */

export function SellerPanelShell({ children }: { children: ReactNode }) {
  const t = useTranslations("sellerPanel");
  const items = [
    { href: "/vendedor", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/vendedor/produtos", label: t("products"), icon: Package },
    { href: "/vendedor/pedidos", label: t("orders"), icon: ShoppingBag },
    { href: "/vendedor/perguntas", label: t("questions"), icon: HelpCircle },
    { href: "/vendedor/repasses", label: t("payouts"), icon: Banknote },
    { href: "/vendedor/configuracoes", label: t("settings"), icon: Settings },
  ];
  return (
    <PanelShell title={t("title")} subtitle={t("subtitle")} items={items}>
      {children}
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/* Dados fixos (mock) — serão ligados a GET /seller/*                   */
/* ------------------------------------------------------------------ */

interface SellerOrder {
  id: string;
  buyer: string;
  date: string;
  total: number;
  status: OrderStatus;
}

const ORDERS: SellerOrder[] = [
  {
    id: "MP-10482",
    buyer: "Ana Souza",
    date: "2026-09-24T14:12:00Z",
    total: 189_900,
    status: "Pago",
  },
  {
    id: "MP-10481",
    buyer: "Carlos Lima",
    date: "2026-09-24T09:40:00Z",
    total: 429_000,
    status: "EmPreparacao",
  },
  {
    id: "MP-10477",
    buyer: "Beatriz Rocha",
    date: "2026-09-23T18:05:00Z",
    total: 99_900,
    status: "Enviado",
  },
  {
    id: "MP-10470",
    buyer: "João Pereira",
    date: "2026-09-22T11:30:00Z",
    total: 1_299_000,
    status: "EmTransitoInternacional",
  },
  {
    id: "MP-10466",
    buyer: "Marina Alves",
    date: "2026-09-21T16:22:00Z",
    total: 74_900,
    status: "Entregue",
  },
  {
    id: "MP-10459",
    buyer: "Rafael Costa",
    date: "2026-09-20T08:15:00Z",
    total: 259_900,
    status: "AguardandoPagamento",
  },
  {
    id: "MP-10452",
    buyer: "Luana Martins",
    date: "2026-09-19T13:48:00Z",
    total: 359_000,
    status: "Concluido",
  },
  {
    id: "MP-10448",
    buyer: "Pedro Nunes",
    date: "2026-09-18T10:02:00Z",
    total: 149_900,
    status: "EmDisputa",
  },
];

type ProductState = "active" | "paused" | "outOfStock";

interface SellerProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  state: ProductState;
}

const PRODUCTS: SellerProduct[] = [
  {
    id: "p1",
    name: "Perfume Carolina Herrera Good Girl 80 ml",
    price: 389_00,
    stock: 12,
    state: "active",
  },
  { id: "p2", name: "Fone JBL Tune 520BT", price: 199_00, stock: 0, state: "outOfStock" },
  { id: "p3", name: "Smartwatch Amazfit GTS 4", price: 799_00, stock: 5, state: "active" },
  { id: "p4", name: "Câmera GoPro Hero 12 Black", price: 2_199_00, stock: 3, state: "paused" },
  { id: "p5", name: "Caixa de som JBL Flip 6", price: 549_00, stock: 8, state: "active" },
  { id: "p6", name: "Lego Technic Ford GT", price: 459_00, stock: 2, state: "active" },
];

interface SellerQuestion {
  id: string;
  product: string;
  text: string;
  askedAt: string;
  answered: boolean;
}

const QUESTIONS: SellerQuestion[] = [
  {
    id: "q1",
    product: "Smartwatch Amazfit GTS 4",
    text: "Vem com carregador original e manual em português?",
    askedAt: "2026-09-24T15:20:00Z",
    answered: false,
  },
  {
    id: "q2",
    product: "Câmera GoPro Hero 12 Black",
    text: "O produto tem nota fiscal? Qual o prazo para Curitiba?",
    askedAt: "2026-09-24T11:05:00Z",
    answered: false,
  },
  {
    id: "q3",
    product: "Perfume Carolina Herrera Good Girl 80 ml",
    text: "É lacrado? Tem garantia de originalidade?",
    askedAt: "2026-09-23T19:41:00Z",
    answered: false,
  },
  {
    id: "q4",
    product: "Fone JBL Tune 520BT",
    text: "Quando volta ao estoque?",
    askedAt: "2026-09-22T08:12:00Z",
    answered: true,
  },
  {
    id: "q5",
    product: "Caixa de som JBL Flip 6",
    text: "Aceita PIX com desconto?",
    askedAt: "2026-09-21T17:30:00Z",
    answered: true,
  },
];

type PayoutState = "paid" | "processing" | "scheduled";

interface SellerPayout {
  id: string;
  period: string;
  orders: number;
  amount: number;
  state: PayoutState;
}

const PAYOUTS: SellerPayout[] = [
  { id: "r5", period: "16–30 set 2026", orders: 14, amount: 4_120_000, state: "scheduled" },
  { id: "r4", period: "01–15 set 2026", orders: 11, amount: 3_385_000, state: "processing" },
  { id: "r3", period: "16–31 ago 2026", orders: 9, amount: 2_940_000, state: "paid" },
  { id: "r2", period: "01–15 ago 2026", orders: 13, amount: 3_710_000, state: "paid" },
  { id: "r1", period: "16–31 jul 2026", orders: 7, amount: 1_985_000, state: "paid" },
];

const brl = (amount: number) => formatMoney({ amount, currency: "BRL" });

/* ------------------------------------------------------------------ */
/* Dashboard                                                            */
/* ------------------------------------------------------------------ */

export function SellerDashboard() {
  const t = useTranslations("sellerPanel");
  const tc = useTranslations("common");
  const format = useFormatter();

  const kpis: Array<{ label: string; value: string; delta: KpiDelta }> = [
    {
      label: t("kpiSales"),
      value: brl(1_245_000),
      delta: { value: "+12 %", tone: "success", direction: "up" },
    },
    {
      label: t("kpiOrders"),
      value: format.number(38),
      delta: { value: "+8 %", tone: "success", direction: "up" },
    },
    {
      label: t("kpiPending"),
      value: format.number(5),
      delta: { value: "−2", tone: "success", direction: "down" },
    },
    {
      label: t("kpiQuestions"),
      value: format.number(3),
      delta: { value: "+1", tone: "danger", direction: "up" },
    },
  ];
  const recent = ORDERS.slice(0, 5);
  const unanswered = QUESTIONS.filter((q) => !q.answered);

  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("dashboard")}</PanelTitle>

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
              <Button variant="link" size="sm" render={<Link href="/vendedor/pedidos" />}>
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
            title={t("unansweredQuestions")}
            action={
              <Button variant="link" size="sm" render={<Link href="/vendedor/perguntas" />}>
                {tc("seeAll")}
              </Button>
            }
          />
          <PanelCard>
            <QuestionList questions={unanswered} />
          </PanelCard>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                              */
/* ------------------------------------------------------------------ */

function OrdersTable({ orders }: { orders: SellerOrder[] }) {
  const t = useTranslations("sellerPanel");
  const format = useFormatter();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("colOrder")}</TableHead>
          <TableHead>{t("colBuyer")}</TableHead>
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

export function SellerOrders() {
  const t = useTranslations("sellerPanel");
  const ts = useTranslations("orders.status");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderFilter>("all");

  const items = Object.fromEntries(
    ORDER_FILTERS.map((s) => [s, s === "all" ? t("filterAllStatus") : ts(s)]),
  ) as Record<OrderFilter, string>;

  const rows = ORDERS.filter(
    (o) => (status === "all" || o.status === status) && matchesQuery(query, o.id, o.buyer),
  );

  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("orders")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="seller-orders-search"
          label={t("searchOrders")}
          value={query}
          onChange={setQuery}
          className="sm:w-80"
        />
        <FilterSelect
          id="seller-orders-status"
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
/* Produtos                                                             */
/* ------------------------------------------------------------------ */

type ProductFilter = "all" | ProductState;

const PRODUCT_BADGE: Record<ProductState, "success" | "neutral" | "warning"> = {
  active: "success",
  paused: "neutral",
  outOfStock: "warning",
};

export function SellerProducts() {
  const t = useTranslations("sellerPanel");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ProductFilter>("all");

  const stateLabel: Record<ProductState, string> = {
    active: t("productActive"),
    paused: t("productPaused"),
    outOfStock: t("productOutOfStock"),
  };
  const items: Record<ProductFilter, string> = { all: t("filterAllStatus"), ...stateLabel };

  const rows = PRODUCTS.filter(
    (p) => (state === "all" || p.state === state) && matchesQuery(query, p.name),
  );

  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("products")}</PanelTitle>
      <PanelToolbar
        action={
          <Button variant="primary" onClick={() => toast.info(t("placeholder"))}>
            <Plus data-icon="inline-start" strokeWidth={1.75} /> {t("newProduct")}
          </Button>
        }
      >
        <SearchInput
          id="seller-products-search"
          label={t("searchProducts")}
          value={query}
          onChange={setQuery}
          className="sm:w-80"
        />
        <FilterSelect
          id="seller-products-state"
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
                <TableHead>{t("colProduct")}</TableHead>
                <TableHead className="text-right">{t("colPrice")}</TableHead>
                <TableHead className="text-right">{t("colStock")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-[240px] truncate font-medium sm:max-w-none">
                    {p.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(p.price)}</TableCell>
                  <TableCell className="text-right text-foreground-secondary tabular-nums">
                    {t("stockUnits", { count: p.stock })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={PRODUCT_BADGE[p.state]}>{stateLabel[p.state]}</Badge>
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
/* Perguntas                                                            */
/* ------------------------------------------------------------------ */

function QuestionList({ questions }: { questions: SellerQuestion[] }) {
  const t = useTranslations("sellerPanel");
  const format = useFormatter();
  if (!questions.length) {
    return (
      <EmptyState
        illustration="check"
        title={t("questionsEmptyTitle")}
        description={t("questionsEmptyDescription")}
      />
    );
  }
  return (
    <ul className="divide-y divide-border">
      {questions.map((q) => (
        <li key={q.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption text-foreground-secondary">{q.product}</p>
            <p className="mt-1 line-clamp-2 text-body-sm text-foreground">{q.text}</p>
            <p className="mt-1 text-caption text-foreground-muted tabular-nums">
              {format.dateTime(new Date(q.askedAt), "dateTime")}
            </p>
          </div>
          {q.answered ? (
            <Badge variant="success" className="shrink-0 self-start sm:self-center">
              {t("questionAnswered")}
            </Badge>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 self-start sm:self-center"
              onClick={() => toast.info(t("placeholder"))}
            >
              {t("answer")}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

type QuestionFilter = "all" | "unanswered" | "answered";

export function SellerQuestions() {
  const t = useTranslations("sellerPanel");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QuestionFilter>("unanswered");
  const items: Record<QuestionFilter, string> = {
    all: t("filterAllQuestions"),
    unanswered: t("filterUnanswered"),
    answered: t("filterAnswered"),
  };
  const rows = QUESTIONS.filter(
    (q) =>
      (filter === "all" || (filter === "answered") === q.answered) &&
      matchesQuery(query, q.product, q.text),
  );
  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("questions")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="seller-questions-search"
          label={t("searchQuestions")}
          value={query}
          onChange={setQuery}
          className="sm:w-80"
        />
        <FilterSelect
          id="seller-questions-filter"
          label={t("filterStatus")}
          value={filter}
          onChange={setFilter}
          items={items}
          className="sm:w-56"
        />
      </PanelToolbar>
      {rows.length ? (
        <PanelCard>
          <QuestionList questions={rows} />
        </PanelCard>
      ) : (
        <NoResults
          onClear={() => {
            setQuery("");
            setFilter("all");
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

export function SellerPayouts() {
  const t = useTranslations("sellerPanel");
  const format = useFormatter();
  const [filter, setFilter] = useState<PayoutFilter>("all");
  const stateLabel: Record<PayoutState, string> = {
    paid: t("payoutPaid"),
    processing: t("payoutProcessing"),
    scheduled: t("payoutScheduled"),
  };
  const items: Record<PayoutFilter, string> = { all: t("filterAllStatus"), ...stateLabel };
  const rows = PAYOUTS.filter((p) => filter === "all" || p.state === filter);
  const total = rows.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("payouts")}</PanelTitle>
      <PanelToolbar>
        <FilterSelect
          id="seller-payouts-state"
          label={t("filterStatus")}
          value={filter}
          onChange={setFilter}
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
                <TableHead>{t("colPeriod")}</TableHead>
                <TableHead className="text-right">{t("colOrders")}</TableHead>
                <TableHead className="text-right">{t("colAmount")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.period}</TableCell>
                  <TableCell className="text-right text-foreground-secondary tabular-nums">
                    {format.number(p.orders)}
                  </TableCell>
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
        <NoResults onClear={() => setFilter("all")} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Configurações                                                        */
/* ------------------------------------------------------------------ */

const settingsSchema = z.object({ ruc: rucSchema });
type SettingsValues = z.infer<typeof settingsSchema>;

/** Validação de RUC (vendedor paraguaio), formato 80012345-6. */
export function SellerSettings() {
  const t = useTranslations("sellerPanel");
  const tc = useTranslations("common");
  const { control, handleSubmit, formState } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { ruc: "" },
  });
  const rucError = formState.errors.ruc?.message;
  const rucId = "seller-ruc";

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
          <h2 className="text-title-3 text-foreground">{t("settingsStore")}</h2>
          <p className="text-body-sm text-foreground-secondary">{t("settingsStoreHint")}</p>
        </div>
        <FormField id={rucId} label={t("rucLabel")} error={rucError} hint={t("rucHint")}>
          <Controller
            control={control}
            name="ruc"
            render={({ field }) => (
              <Input
                id={rucId}
                inputMode="numeric"
                placeholder="80012345-6"
                aria-invalid={Boolean(rucError)}
                aria-describedby={rucError ? `${rucId}-error` : `${rucId}-hint`}
                value={field.value}
                onChange={(e) => field.onChange(formatRuc(e.target.value))}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
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
  const t = useTranslations("sellerPanel");
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
