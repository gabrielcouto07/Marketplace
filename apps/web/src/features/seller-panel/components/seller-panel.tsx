"use client";

import type {
  OrderDto,
  OrderStatus,
  ProductStatus,
  SellerProductListItemDto,
} from "@marketplace/contracts";
import {
  Banknote,
  HelpCircle,
  LayoutDashboard,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Settings,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PanelShell, PanelTitle, SkeletonNotice } from "@/components/layout/panel-shell";
import { OrderStatusBadge } from "@/components/shared/order-status";
import { EmptyState, ErrorState, SectionHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
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
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";
import { BLUR_DATA_URL, isDirectImage } from "@/lib/images";
import { formatMoney } from "@/lib/money";

import {
  FilterSelect,
  KpiCard,
  KpiGrid,
  PanelCard,
  PanelToolbar,
  SearchInput,
} from "@/components/shared/panel-widgets";
import { useDebouncedValue } from "@/hooks/use-debounce";

import {
  useArchiveProduct,
  usePrepareOrder,
  useSellerDashboard,
  useSellerOrders,
  useSellerProducts,
  useSellerProfile,
  useUpdateSellerProfile,
} from "../api";
import { SellerGate } from "./seller-gate";
import { ShipOrderSheet } from "./ship-order-sheet";
import { StoreForm } from "./store-form";

const brl = (amount: number) => formatMoney({ amount, currency: "BRL" });

/* ------------------------------------------------------------------ */
/* Casca                                                                */
/* ------------------------------------------------------------------ */

export function SellerPanelShell({ children }: { children: ReactNode }) {
  const t = useTranslations("sellerPanel");
  const profile = useSellerProfile();
  const items = [
    { href: "/vendedor", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/vendedor/produtos", label: t("products"), icon: Package },
    { href: "/vendedor/pedidos", label: t("orders"), icon: ShoppingBag },
    { href: "/vendedor/perguntas", label: t("questions"), icon: HelpCircle },
    { href: "/vendedor/repasses", label: t("payouts"), icon: Banknote },
    { href: "/vendedor/configuracoes", label: t("settings"), icon: Settings },
  ];
  return (
    <PanelShell title={t("title")} subtitle={profile.data?.name ?? t("subtitle")} items={items}>
      <SellerGate>{children}</SellerGate>
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                            */
/* ------------------------------------------------------------------ */

export function SellerDashboard() {
  const t = useTranslations("sellerPanel");
  const tc = useTranslations("common");
  const format = useFormatter();
  const dashboard = useSellerDashboard();
  const recent = useSellerOrders({ pageSize: 5 });

  if (dashboard.isError)
    return <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />;

  const d = dashboard.data;
  const kpis = d
    ? [
        { label: t("kpiSales"), value: brl(d.grossSales.amount), icon: Banknote },
        { label: t("kpiOrders"), value: format.number(d.ordersCount), icon: ShoppingBag },
        { label: t("kpiPending"), value: format.number(d.pendingShipments), icon: Truck },
        { label: t("kpiProducts"), value: format.number(d.activeProducts), icon: Package },
      ]
    : [];

  return (
    <div>
      <PanelTitle>{t("dashboard")}</PanelTitle>

      {d ? (
        <KpiGrid>
          {kpis.map((k) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={k.value}
              icon={k.icon}
              compare={t("kpiPeriod")}
            />
          ))}
        </KpiGrid>
      ) : (
        <KpiGrid>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </KpiGrid>
      )}

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
          <OrdersSection orders={recent} />
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                              */
/* ------------------------------------------------------------------ */

function OrdersSection({
  orders,
  onPrepare,
  onShip,
  preparingId,
}: {
  orders: ReturnType<typeof useSellerOrders>;
  onPrepare?: (order: OrderDto) => void;
  onShip?: (order: OrderDto) => void;
  preparingId?: string | null;
}) {
  const t = useTranslations("sellerPanel");
  if (orders.isPending) return <Skeleton className="h-64 rounded-lg" />;
  if (orders.isError)
    return <ErrorState error={orders.error} onRetry={() => orders.refetch()} compact />;
  if (!orders.data.items.length) {
    return (
      <EmptyState
        illustration="box"
        title={t("ordersEmptyTitle")}
        description={t("ordersEmptyDescription")}
      />
    );
  }
  return (
    <PanelCard>
      <OrdersTable
        orders={orders.data.items}
        onPrepare={onPrepare}
        onShip={onShip}
        preparingId={preparingId}
      />
    </PanelCard>
  );
}

function OrdersTable({
  orders,
  onPrepare,
  onShip,
  preparingId,
}: {
  orders: OrderDto[];
  onPrepare?: (order: OrderDto) => void;
  onShip?: (order: OrderDto) => void;
  preparingId?: string | null;
}) {
  const t = useTranslations("sellerPanel");
  const format = useFormatter();
  const withActions = Boolean(onPrepare || onShip);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("colOrder")}</TableHead>
          <TableHead>{t("colBuyer")}</TableHead>
          <TableHead className="hidden sm:table-cell">{t("colDate")}</TableHead>
          <TableHead className="text-right">{t("colTotal")}</TableHead>
          <TableHead>{t("colStatus")}</TableHead>
          {withActions ? <TableHead className="text-right">{t("colActions")}</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => (
          <TableRow key={o.id}>
            <TableCell className="font-medium tabular-nums">{o.number}</TableCell>
            <TableCell>
              <span className="block max-w-[160px] truncate">
                {o.shippingAddress.recipientName}
              </span>
              <span className="block text-caption text-foreground-secondary">
                {o.shippingAddress.city}/{o.shippingAddress.state}
              </span>
            </TableCell>
            <TableCell className="hidden text-foreground-secondary tabular-nums sm:table-cell">
              {format.dateTime(new Date(o.createdAt), "short")}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {brl(o.totals.subtotal.amount + o.totals.shipping.amount - o.totals.discount.amount)}
            </TableCell>
            <TableCell>
              <OrderStatusBadge status={o.status} />
            </TableCell>
            {withActions ? (
              <TableCell className="text-right">
                {o.status === "Pago" && onPrepare ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={preparingId === o.id}
                    onClick={() => onPrepare(o)}
                  >
                    <PackageCheck data-icon="inline-start" strokeWidth={1.75} />{" "}
                    {t("actionPrepare")}
                  </Button>
                ) : null}
                {(o.status === "Pago" || o.status === "EmPreparacao") && onShip ? (
                  <Button variant="primary" size="sm" className="ml-2" onClick={() => onShip(o)}>
                    <Truck data-icon="inline-start" strokeWidth={1.75} /> {t("actionShip")}
                  </Button>
                ) : null}
                {o.trackingCode ? (
                  <span className="block text-caption text-foreground-secondary tabular-nums">
                    {o.trackingCode}
                  </span>
                ) : null}
              </TableCell>
            ) : null}
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
  const tErrors = useTranslations("errors");
  const [status, setStatus] = useState<OrderFilter>("all");
  const [shipping, setShipping] = useState<OrderDto | null>(null);
  const orders = useSellerOrders({
    status: status === "all" ? undefined : (status as OrderStatus),
    pageSize: 50,
  });
  const prepare = usePrepareOrder();

  const items = Object.fromEntries(
    ORDER_FILTERS.map((s) => [s, s === "all" ? t("filterAllStatus") : ts(s)]),
  ) as Record<OrderFilter, string>;

  return (
    <div>
      <PanelTitle>{t("orders")}</PanelTitle>
      <PanelToolbar>
        <FilterSelect
          id="seller-orders-status"
          label={t("filterStatus")}
          value={status}
          onChange={setStatus}
          items={items}
          className="sm:w-64"
        />
      </PanelToolbar>
      <OrdersSection
        orders={orders}
        preparingId={prepare.isPending ? prepare.variables : null}
        onPrepare={(o) =>
          prepare.mutate(o.id, {
            onSuccess: () => toast.success(t("prepareSuccess", { number: o.number })),
            onError: (e) => toast.error(isApiError(e) ? e.message : tErrors("genericTitle")),
          })
        }
        onShip={setShipping}
      />
      <ShipOrderSheet order={shipping} onClose={() => setShipping(null)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Produtos                                                             */
/* ------------------------------------------------------------------ */

type ProductFilter = "all" | ProductStatus;

const PRODUCT_BADGE: Record<ProductStatus, "success" | "neutral" | "warning"> = {
  Ativo: "success",
  Rascunho: "neutral",
  Arquivado: "warning",
};

export function SellerProducts() {
  const t = useTranslations("sellerPanel");
  const tc = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ProductFilter>("all");
  const [archiving, setArchiving] = useState<SellerProductListItemDto | null>(null);
  const debounced = useDebouncedValue(query, 300);
  const products = useSellerProducts({
    q: debounced || undefined,
    status: state === "all" ? undefined : state,
    pageSize: 60,
  });
  const archive = useArchiveProduct();

  const stateLabel: Record<ProductStatus, string> = {
    Ativo: t("productActive"),
    Rascunho: t("productDraft"),
    Arquivado: t("productArchived"),
  };
  const items: Record<ProductFilter, string> = { all: t("filterAllStatus"), ...stateLabel };

  return (
    <div>
      <PanelTitle>{t("products")}</PanelTitle>
      <PanelToolbar
        action={
          <Button variant="primary" render={<Link href="/vendedor/produtos/novo" />}>
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

      {products.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : products.data.items.length === 0 ? (
        <EmptyState
          illustration="box"
          title={query || state !== "all" ? t("emptyTitle") : t("productsEmptyTitle")}
          description={
            query || state !== "all" ? t("emptyDescription") : t("productsEmptyDescription")
          }
          action={
            query || state !== "all" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery("");
                  setState("all");
                }}
              >
                {t("clearFilters")}
              </Button>
            ) : (
              <Button variant="primary" render={<Link href="/vendedor/produtos/novo" />}>
                <Plus data-icon="inline-start" strokeWidth={1.75} /> {t("newProduct")}
              </Button>
            )
          }
        />
      ) : (
        <PanelCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colProduct")}</TableHead>
                <TableHead className="text-right">{t("colPrice")}</TableHead>
                <TableHead className="text-right">{t("colStock")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead className="text-right">{t("colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.data.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/vendedor/produtos/${p.id}`}
                      className="flex items-center gap-3 rounded-sm focus-ring"
                    >
                      <span className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-surface-muted">
                        <Image
                          src={p.thumbnailUrl}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-contain"
                          placeholder="blur"
                          blurDataURL={BLUR_DATA_URL}
                          unoptimized={isDirectImage(p.thumbnailUrl)}
                        />
                      </span>
                      <span className="line-clamp-2 max-w-[220px] font-medium sm:max-w-none">
                        {p.name}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(p.price.amount)}</TableCell>
                  <TableCell className="text-right text-foreground-secondary tabular-nums">
                    {p.stock === 0 ? (
                      <span className="text-warning">{t("productOutOfStock")}</span>
                    ) : (
                      t("stockUnits", { count: p.stock })
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={PRODUCT_BADGE[p.status]}>{stateLabel[p.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={tc("edit")}
                      render={<Link href={`/vendedor/produtos/${p.id}`} />}
                    >
                      <Pencil strokeWidth={1.75} />
                    </Button>
                    {p.status !== "Arquivado" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => setArchiving(p)}
                      >
                        {t("productArchive")}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelCard>
      )}

      <Dialog open={Boolean(archiving)} onOpenChange={(open) => !open && setArchiving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("productArchive")}</DialogTitle>
            <DialogDescription>
              {archiving ? t("productArchiveConfirm", { name: archiving.name }) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setArchiving(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              loading={archive.isPending}
              onClick={() => {
                if (!archiving) return;
                archive.mutate(archiving.id, {
                  onSuccess: () => {
                    toast.success(t("productArchived"));
                    setArchiving(null);
                  },
                  onError: (e) => toast.error(isApiError(e) ? e.message : tErrors("genericTitle")),
                });
              }}
            >
              {t("productArchive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Perguntas e repasses (ainda sem endpoint)                            */
/* ------------------------------------------------------------------ */

export function SellerQuestions() {
  const t = useTranslations("sellerPanel");
  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("questions")}</PanelTitle>
      <EmptyState
        illustration="check"
        title={t("questionsEmptyTitle")}
        description={t("questionsEmptyDescription")}
      />
    </div>
  );
}

export function SellerPayouts() {
  const t = useTranslations("sellerPanel");
  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("payouts")}</PanelTitle>
      <EmptyState
        illustration="box"
        title={t("payoutsEmptyTitle")}
        description={t("payoutsEmptyDescription")}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Configurações                                                        */
/* ------------------------------------------------------------------ */

export function SellerSettings() {
  const t = useTranslations("sellerPanel");
  const tc = useTranslations("common");
  const tErrors = useTranslations("errors");
  const profile = useSellerProfile();
  const update = useUpdateSellerProfile();
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>();

  if (profile.isPending) return <Skeleton className="h-96 max-w-3xl rounded-lg" />;
  if (profile.isError)
    return <ErrorState error={profile.error} onRetry={() => profile.refetch()} />;
  const p = profile.data;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PanelTitle className="mb-0">{t("settings")}</PanelTitle>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/loja/${p.slug}`} target="_blank" />}
        >
          <Store data-icon="inline-start" strokeWidth={1.75} /> {t("viewStore")}
        </Button>
      </div>
      <StoreForm
        key={p.id}
        rucEditable={false}
        defaultValues={{
          name: p.name,
          ruc: p.ruc,
          city: p.city,
          description: p.description,
          logoUrl: p.logoUrl,
          bannerUrl: p.bannerUrl,
          exchangePolicy: p.exchangePolicy,
          categoryIds: p.categories.map((c) => c.id),
          originPostalCode: p.originPostalCode ?? "",
          phone: p.phone ?? "",
        }}
        submitLabel={tc("save")}
        submitting={update.isPending}
        serverErrors={serverErrors}
        onSubmit={(values) => {
          setServerErrors(undefined);
          update.mutate(values, {
            onSuccess: () => toast.success(t("settingsSaved")),
            onError: (error) => {
              if (isApiError(error) && error.errors) setServerErrors(error.errors);
              else toast.error(isApiError(error) ? error.message : tErrors("genericTitle"));
            },
          });
        }}
      />
    </div>
  );
}
