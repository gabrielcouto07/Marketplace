"use client";

import { AlertOctagon, Banknote, LayoutDashboard, Settings, ShoppingBag, Store, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { PanelShell, SkeletonNotice } from "@/components/layout/panel-shell";
import { EmptyState } from "@/components/shared/states";

export type AdminSection = "overview" | "sellers" | "buyers" | "orders" | "disputes" | "payouts" | "settings";

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

export function AdminOverview() {
  const t = useTranslations("admin");
  const cards: Array<{ key: AdminSection; value: string }> = [
    { key: "sellers", value: "8" },
    { key: "buyers", value: "1.240" },
    { key: "orders", value: "312" },
    { key: "disputes", value: "4" },
  ];
  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <h1 className="mb-4 text-xl font-bold">{t("overview")}</h1>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.key} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t(c.key)}</p>
            <p className="text-lg font-bold tabular-nums">{c.value}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminPlaceholder({ section }: { section: Exclude<AdminSection, "overview"> }) {
  const t = useTranslations("admin");
  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <h1 className="mb-2 text-xl font-bold">{t(section)}</h1>
      <EmptyState title={t(section)} description={t("placeholder")} />
    </div>
  );
}
