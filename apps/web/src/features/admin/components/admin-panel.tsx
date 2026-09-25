"use client";

import {
  AlertOctagon,
  Banknote,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { PanelShell, PanelTitle, SkeletonNotice } from "@/components/layout/panel-shell";
import { EmptyState } from "@/components/shared/states";

export type AdminSection =
  "overview" | "sellers" | "buyers" | "orders" | "disputes" | "payouts" | "settings";

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
  const cards: Array<{ key: AdminSection; value: string; icon: LucideIcon; tone?: "danger" }> = [
    { key: "sellers", value: "8", icon: Store },
    { key: "buyers", value: "1.240", icon: Users },
    { key: "orders", value: "312", icon: ShoppingBag },
    { key: "disputes", value: "4", icon: AlertOctagon, tone: "danger" },
  ];
  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <PanelTitle>{t("overview")}</PanelTitle>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ key, value, icon: Icon, tone }, i) => (
          <li
            key={key}
            className="flex animate-rise flex-col gap-2 rounded-3xl bg-card p-4 shadow-card"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span
              className={
                tone === "danger"
                  ? "flex size-[38px] items-center justify-center rounded-md bg-destructive-soft text-destructive"
                  : "flex size-[38px] items-center justify-center rounded-md bg-accent text-accent-foreground"
              }
            >
              <Icon className="size-[18px]" aria-hidden />
            </span>
            <div>
              <p className="text-xl leading-7 font-extrabold tracking-tight tabular-nums">
                {value}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">{t(key)}</p>
            </div>
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
      <PanelTitle className="mb-3">{t(section)}</PanelTitle>
      <EmptyState title={t(section)} description={t("placeholder")} />
    </div>
  );
}
