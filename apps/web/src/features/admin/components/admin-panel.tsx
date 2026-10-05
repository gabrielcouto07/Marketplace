"use client";

import {
  AlertOctagon,
  ArrowLeftRight,
  Banknote,
  ClipboardList,
  CreditCard,
  Flag,
  LayoutDashboard,
  Package,
  PackageCheck,
  PlugZap,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Ticket,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Suspense, type ReactNode } from "react";

import { PanelShell, PanelTitle } from "@/components/layout/panel-shell";
import { OrderStatusBadge } from "@/components/shared/order-status";
import { ErrorState, SectionHeader } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard, KpiGrid, PanelCard } from "@/components/shared/panel-widgets";
import { Link } from "@/i18n/navigation";

import { useAdminOverview } from "../api";
import { AdminGate } from "./admin-gate";
import { brl } from "./admin-widgets";
import { OrdersTable } from "./admin-orders";
import { SalesChart } from "./sales-chart";

export { AdminOrders, AdminDisputes } from "./admin-orders";
export { AdminBuyers } from "./admin-users";
export { AdminSellers } from "./admin-sellers";
export { AdminProducts } from "./admin-products";
export { AdminPayments, AdminPayouts } from "./admin-finance";
export { AdminCoupons, AdminRates } from "./admin-catalog";
export { AdminSettings } from "./admin-settings";
export { AdminAudit } from "./admin-audit";
export { AdminCompliance, AdminIntegrations, AdminReports, AdminShipments } from "./admin-compliance";

export function AdminPanelShell({ children }: { children: ReactNode }) {
  const t = useTranslations("admin");
  const items = [
    { href: "/admin", label: t("overview"), icon: LayoutDashboard },
    { href: "/admin/pedidos", label: t("orders"), icon: ShoppingBag },
    { href: "/admin/disputas", label: t("disputes"), icon: AlertOctagon },
    { href: "/admin/compradores", label: t("buyers"), icon: Users },
    { href: "/admin/vendedores", label: t("sellers"), icon: Store },
    { href: "/admin/produtos", label: t("products"), icon: Package },
    { href: "/admin/conformidade", label: t("compliance"), icon: ShieldCheck },
    { href: "/admin/denuncias", label: t("reports"), icon: Flag },
    { href: "/admin/remessas", label: t("shipments"), icon: PackageCheck },
    { href: "/admin/pagamentos", label: t("payments"), icon: CreditCard },
    { href: "/admin/repasses", label: t("payouts"), icon: Banknote },
    { href: "/admin/cupons", label: t("coupons"), icon: Ticket },
    { href: "/admin/cambio", label: t("rates"), icon: ArrowLeftRight },
    { href: "/admin/configuracoes", label: t("settings"), icon: Settings },
    { href: "/admin/integracoes", label: t("integrations"), icon: PlugZap },
    { href: "/admin/auditoria", label: t("audit"), icon: ClipboardList },
  ];
  return (
    <PanelShell title={t("title")} subtitle={t("subtitle")} items={items}>
      {/* useSearchParams nas listas exige Suspense para a pré-renderização. */}
      <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/* Visão geral                                                          */
/* ------------------------------------------------------------------ */

export function AdminOverview() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const format = useFormatter();
  const overview = useAdminOverview();

  if (overview.isError)
    return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const d = overview.data;

  const kpis = d
    ? [
        { label: t("kpiGmv"), value: brl(d.gmv30d.amount), icon: Wallet, href: "/admin/pedidos" },
        {
          label: t("kpiOrders30d"),
          value: format.number(d.orders30d),
          icon: ShoppingBag,
          href: "/admin/pedidos",
        },
        {
          label: t("kpiInTransit"),
          value: format.number(d.ordersInTransit),
          icon: Truck,
          href: "/admin/pedidos?inTransit=1",
        },
        {
          label: t("kpiAwaitingShipment"),
          value: format.number(d.ordersAwaitingShipment),
          icon: Package,
          href: "/admin/pedidos?status=Pago",
        },
        {
          label: t("kpiUsers"),
          value: format.number(d.totalUsers),
          icon: Users,
          href: "/admin/compradores",
          note: t("kpiNew30d", { count: d.newUsers30d }),
        },
        {
          label: t("kpiSellers"),
          value: format.number(d.totalSellers),
          icon: Store,
          href: "/admin/vendedores",
          note: d.suspendedSellers ? t("kpiSuspended", { count: d.suspendedSellers }) : undefined,
        },
        {
          label: t("kpiProducts"),
          value: format.number(d.activeProducts),
          icon: Package,
          href: "/admin/produtos",
          note: d.draftProducts ? t("kpiDrafts", { count: d.draftProducts }) : undefined,
        },
        {
          label: t("openDisputes"),
          value: format.number(d.openDisputes),
          icon: AlertOctagon,
          href: "/admin/disputas",
        },
        {
          label: t("kpiPendingPayouts"),
          value: brl(d.pendingPayouts.amount),
          icon: Banknote,
          href: "/admin/repasses",
          note: t("kpiPayoutsCount", { count: d.pendingPayoutsCount }),
        },
        {
          label: t("kpiTax30d"),
          value: brl(d.importTaxCollected30d.amount),
          icon: ClipboardList,
          href: "/admin/configuracoes",
        },
        {
          label: t("kpiFees30d"),
          value: brl(d.platformFees30d.amount),
          icon: Wallet,
          href: "/admin/repasses",
        },
        {
          label: t("kpiGmvTotal"),
          value: brl(d.gmvTotal.amount),
          icon: Wallet,
          href: "/admin/pedidos",
        },
      ]
    : [];

  return (
    <div>
      <PanelTitle>{t("overview")}</PanelTitle>

      {d ? (
        <KpiGrid className="lg:grid-cols-4">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className="contents focus-ring">
              <KpiCard
                label={k.label}
                value={k.value}
                icon={k.icon}
                compare={k.note ?? t("kpiPeriod")}
              />
            </Link>
          ))}
        </KpiGrid>
      ) : (
        <KpiGrid className="lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </KpiGrid>
      )}

      <div className="mt-8 flex flex-col gap-8">
        <section className="rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
          {d ? <SalesChart points={d.salesByDay} /> : <Skeleton className="h-48" />}
        </section>

        {d ? (
          <section>
            <SectionHeader title={t("ordersByStatus")} />
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {d.ordersByStatus
                .filter((s) => s.count > 0)
                .map((s) => (
                  <li key={s.status}>
                    <Link
                      href={`/admin/pedidos?status=${s.status}`}
                      className="flex pressable items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 focus-ring"
                    >
                      <OrderStatusBadge status={s.status} />
                      <span className="text-body-sm font-medium text-foreground tabular-nums">
                        {format.number(s.count)}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

        <section>
          <SectionHeader
            title={t("recentOrders")}
            action={
              <Button variant="link" size="sm" render={<Link href="/admin/pedidos" />}>
                {tc("seeAll")}
              </Button>
            }
          />
          {d ? (
            <PanelCard>
              <OrdersTable orders={d.recentOrders} />
            </PanelCard>
          ) : (
            <Skeleton className="h-64 rounded-lg" />
          )}
        </section>
      </div>
    </div>
  );
}
