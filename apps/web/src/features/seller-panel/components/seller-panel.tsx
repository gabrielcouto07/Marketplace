"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, HelpCircle, LayoutDashboard, Package, Settings, ShoppingBag, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PanelShell, SkeletonNotice } from "@/components/layout/panel-shell";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, fieldError } from "@/features/auth/components/form-field";
import { formatMoney } from "@/lib/money";
import { formatRuc } from "@/lib/validation/documents";
import { rucSchema } from "@/lib/validation/schemas";

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

/** Dashboard com KPIs estáticos (mock) — será ligado a GET /seller/dashboard. */
export function SellerDashboard() {
  const t = useTranslations("sellerPanel");
  const kpis: Array<{ label: string; value: string; icon: LucideIcon }> = [
    { label: t("kpiSales"), value: formatMoney({ amount: 1_245_000, currency: "BRL" }), icon: Banknote },
    { label: t("kpiOrders"), value: "38", icon: ShoppingBag },
    { label: t("kpiPending"), value: "5", icon: Package },
    { label: t("kpiQuestions"), value: "3", icon: HelpCircle },
  ];
  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <h1 className="mb-4 text-xl font-bold">{t("dashboard")}</h1>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <li key={label} className="rounded-2xl border border-border bg-card p-4">
            <span className="mb-2 flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Icon className="size-4.5" aria-hidden />
            </span>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold tabular-nums">{value}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SellerPlaceholder({ titleKey }: { titleKey: "products" | "orders" | "questions" | "payouts" }) {
  const t = useTranslations("sellerPanel");
  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <h1 className="mb-2 text-xl font-bold">{t(titleKey)}</h1>
      <EmptyState title={t(titleKey)} description={t("placeholder")} />
    </div>
  );
}

const settingsSchema = z.object({ ruc: rucSchema });
type SettingsValues = z.infer<typeof settingsSchema>;

/** Demonstração da validação de RUC (vendedor paraguaio), formato 80012345-6. */
export function SellerSettings() {
  const t = useTranslations("sellerPanel");
  const tc = useTranslations("common");
  const { control, handleSubmit, formState } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { ruc: "" },
  });
  return (
    <div>
      <SkeletonNotice text={t("placeholder")} />
      <h1 className="mb-4 text-xl font-bold">{t("settings")}</h1>
      <form onSubmit={handleSubmit(() => toast.success(tc("save")))} noValidate className="flex max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <FormField label={t("rucLabel")} error={fieldError(formState.errors, "ruc")} hint="Ex.: 80012345-6">
          {(a11y) => (
            <Controller
              control={control}
              name="ruc"
              render={({ field }) => (
                <Input
                  {...a11y}
                  inputMode="numeric"
                  placeholder="80012345-6"
                  value={field.value}
                  onChange={(e) => field.onChange(formatRuc(e.target.value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          )}
        </FormField>
        <Button type="submit">{tc("save")}</Button>
      </form>
    </div>
  );
}
