"use client";

import {
  ChevronRight,
  Download,
  Heart,
  HelpCircle,
  Languages,
  LogOut,
  MapPin,
  Shield,
  Store,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddresses } from "@/features/account/api";
import { useLogout } from "@/features/auth/api";
import { useAuthStore, useCurrentUser } from "@/features/auth/store";
import { useFavoritesStore } from "@/features/catalog/favorites-store";
import { useOrders } from "@/features/orders/api";
import {
  OrderFilterTabs,
  OrderRow,
  matchesOrderFilter,
  type OrderFilter,
} from "@/features/orders/components/orders-view";
import { Link, usePathname } from "@/i18n/navigation";
import { initials } from "@/lib/palette";
import { cn } from "@/lib/utils";

const APP_VERSION = "0.1.0";

export function AccountView() {
  const t = useTranslations("account");
  const user = useCurrentUser();
  const hydrated = useAuthStore.persist.hasHydrated();

  if (!hydrated) {
    return (
      <div className="flex flex-col">
        <div className="bg-header px-4 pt-[22px] pb-[60px]">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3.5">
            <Skeleton className="size-[60px] rounded-2xl bg-white/20" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-40 bg-white/20" />
              <Skeleton className="h-3.5 w-52 bg-white/20" />
            </div>
          </div>
        </div>
        <PageContainer className="relative -mt-10 flex flex-col gap-3">
          <Skeleton className="h-[86px] rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </PageContainer>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col">
        <Hero>
          <div className="relative flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-[21px] leading-tight font-extrabold tracking-[-0.02em]">
                {t("guestTitle")}
              </h1>
              <p className="text-[13px] leading-snug text-brand-blue-200">
                {t("guestDescription")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="white" className="flex-1" render={<Link href="/entrar" />}>
                {t("signIn")}
              </Button>
              <Button
                variant="ghost"
                className="flex-1 border-2 border-white/60 text-white hover:bg-white/10 hover:text-white"
                render={<Link href="/cadastrar" />}
              >
                {t("signUp")}
              </Button>
            </div>
          </div>
        </Hero>
        <PageContainer className="relative -mt-10 flex flex-col gap-3">
          <MenuCard>
            <MenuLink
              href="/instalar"
              icon={Download}
              label={t("menuInstall")}
              hint={t("menuInstallHint")}
            />
            <LanguageRow />
            <HelpRow />
          </MenuCard>
          <VersionNote />
        </PageContainer>
      </div>
    );
  }

  return <SignedInAccount />;
}

function SignedInAccount() {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const user = useCurrentUser()!;
  const logout = useLogout();
  const isSeller = user.roles.includes("Vendedor") || user.roles.includes("Admin");
  const isAdmin = user.roles.includes("Admin");

  return (
    <div className="flex flex-col">
      <Hero>
        <span
          aria-hidden
          className="relative flex size-[60px] shrink-0 items-center justify-center rounded-2xl bg-card text-xl font-extrabold text-primary"
        >
          {initials(user.fullName)}
        </span>
        <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="truncate text-[21px] leading-tight font-extrabold tracking-[-0.02em]">
            {t("hello", { name: user.fullName.split(" ")[0] })}
          </h1>
          <p className="truncate text-[13px] text-brand-blue-200">{user.email}</p>
        </div>
      </Hero>

      <PageContainer className="relative -mt-10 flex flex-col gap-3">
        <StatsCard />
        <RecentOrdersCard />

        <MenuCard>
          <MenuLink
            href="/conta/perfil"
            icon={UserCircle}
            label={t("menuProfile")}
            hint={t("menuProfileHint")}
          />
          <MenuLink
            href="/conta/enderecos"
            icon={MapPin}
            label={t("menuAddresses")}
            hint={t("menuAddressesHint")}
          />
          <MenuLink
            href="/favoritos"
            icon={Heart}
            label={t("menuFavorites")}
            hint={t("menuFavoritesHint")}
          />
          <MenuLink
            href="/instalar"
            icon={Download}
            label={t("menuInstall")}
            hint={t("menuInstallHint")}
          />
          <LanguageRow />
          {isSeller ? (
            <MenuLink
              href="/vendedor"
              icon={Store}
              label={t("menuSeller")}
              hint={t("menuSellerHint")}
            />
          ) : null}
          {isAdmin ? (
            <MenuLink
              href="/admin"
              icon={Shield}
              label={t("menuAdmin")}
              hint={t("menuAdminHint")}
            />
          ) : null}
          <HelpRow />
          <MenuRow
            as="button"
            icon={LogOut}
            tone="danger"
            label={t("signOut")}
            hint={t("signOutHint")}
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => toast(tAuth("loggedOut")) })}
          />
        </MenuCard>

        <VersionNote />
      </PageContainer>
    </div>
  );
}

/** Faixa azul do topo com círculo decorativo; o conteúdo fica acima dele (relative). */
function Hero({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-header px-4 pt-[22px] pb-[60px] text-header-foreground">
      <span
        aria-hidden
        className="absolute -top-[70px] -right-[60px] size-[200px] rounded-full bg-white/[0.07]"
      />
      <span
        aria-hidden
        className="absolute -bottom-[90px] left-[30%] size-[180px] rounded-full bg-white/[0.05]"
      />
      <div className="relative mx-auto flex w-full max-w-6xl items-center gap-3.5">{children}</div>
    </div>
  );
}

function StatsCard() {
  const t = useTranslations("account");
  const orders = useOrders({ pageSize: 3 });
  const addresses = useAddresses();
  const favoritesCount = useFavoritesStore((s) => s.items.length);
  const stats: Array<{ href: string; value: number | undefined; label: string }> = [
    { href: "/conta/pedidos", value: orders.data?.pages[0]?.totalCount, label: t("statOrders") },
    { href: "/favoritos", value: favoritesCount, label: t("statFavorites") },
    { href: "/conta/enderecos", value: addresses.data?.length, label: t("statAddresses") },
  ];
  return (
    <nav
      aria-label={t("title")}
      className="grid animate-rise grid-cols-3 gap-2 rounded-3xl bg-card p-3.5 text-center shadow-card"
    >
      {stats.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="flex pressable flex-col items-center gap-0.5 rounded-xl py-1.5 hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          {s.value === undefined ? (
            <Skeleton className="my-1 h-5 w-8" />
          ) : (
            <span className="text-xl leading-7 font-extrabold tabular-nums">{s.value}</span>
          )}
          <span className="text-xs font-semibold text-muted-foreground">{s.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function RecentOrdersCard() {
  const t = useTranslations("account");
  const tOrders = useTranslations("orders");
  const [filter, setFilter] = useState<OrderFilter>("all");
  const orders = useOrders({ pageSize: 3 });
  const all = orders.data?.pages.flatMap((p) => p.items) ?? [];
  const visible = all.filter((o) => matchesOrderFilter(o, filter)).slice(0, 3);

  return (
    <section
      className="flex animate-rise flex-col gap-3 rounded-3xl bg-card p-4 shadow-card"
      style={{ animationDelay: "40ms" }}
    >
      <h2 className="text-base font-extrabold">{t("menuOrders")}</h2>
      <OrderFilterTabs compact value={filter} onChange={setFilter} />

      {orders.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : orders.isError ? (
        <p className="py-2 text-center text-[13px] text-muted-foreground">
          {tOrders("emptyDescription")}
        </p>
      ) : visible.length === 0 ? (
        <p className="py-3 text-center text-[13px] text-muted-foreground">{t("noRecentOrders")}</p>
      ) : (
        <ul className="flex flex-col">
          {visible.map((order) => (
            <li key={order.id}>
              <OrderRow order={order} className="border-t border-border pt-3 pb-0.5" />
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/conta/pedidos"
        className="flex min-h-11 items-center justify-center gap-1 rounded-xl text-sm font-bold text-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {t("viewAllOrders")} <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

function MenuCard({ children }: { children: ReactNode }) {
  return (
    <nav
      className="flex animate-rise flex-col rounded-3xl bg-card px-4 py-1.5 shadow-card [&>*]:border-b [&>*]:border-border [&>*:last-child]:border-b-0"
      style={{ animationDelay: "80ms" }}
    >
      {children}
    </nav>
  );
}

interface MenuRowProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  tone?: "blue" | "danger";
  /** Conteúdo à direita no lugar do chevron (ex.: seletor de idioma). */
  trailing?: ReactNode;
  as?: "link" | "button";
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

function MenuRow({
  icon: Icon,
  label,
  hint,
  tone = "blue",
  trailing,
  as = "link",
  href = "/",
  onClick,
  disabled,
}: MenuRowProps) {
  const inner = (
    <>
      <span
        className={cn(
          "flex size-[38px] shrink-0 items-center justify-center rounded-md",
          tone === "danger"
            ? "bg-destructive-soft text-destructive"
            : "bg-accent text-accent-foreground",
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-sm font-bold", tone === "danger" && "text-destructive")}>
          {label}
        </span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      {trailing ?? (
        <ChevronRight className="size-4 shrink-0 text-chevron" strokeWidth={2.2} aria-hidden />
      )}
    </>
  );
  const className =
    "flex w-full items-center gap-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:[&>span:first-child]:ring-2 focus-visible:[&>span:first-child]:ring-ring/40 disabled:opacity-50";

  if (as === "button") {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={className}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

function MenuLink({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  hint?: string;
}) {
  return <MenuRow as="link" href={href} icon={icon} label={label} hint={hint} />;
}

function HelpRow() {
  const t = useTranslations("account");
  return (
    <MenuRow
      as="button"
      icon={HelpCircle}
      label={t("menuHelp")}
      hint={t("menuHelpHint")}
      onClick={() => toast(t("helpSoon"))}
    />
  );
}

/** Linha "Idioma" com os dois idiomas como pílulas; troca o locale mantendo a rota. */
function LanguageRow() {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const options = [
    { locale: "pt-BR" as const, short: "PT", label: tCommon("portuguese") },
    { locale: "es-PY" as const, short: "ES", label: tCommon("spanish") },
  ];
  const current = options.find((o) => o.locale === locale);
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
        <Languages className="size-[18px]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-bold">{t("menuLanguage")}</span>
        <span className="truncate text-xs text-muted-foreground">{current?.label}</span>
      </span>
      <div className="flex gap-1" role="group" aria-label={t("menuLanguage")}>
        {options.map((o) => (
          <Link
            key={o.locale}
            href={pathname}
            locale={o.locale}
            aria-current={locale === o.locale ? "true" : undefined}
            className={cn(
              "flex h-9 min-w-11 pressable items-center justify-center rounded-full px-3 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
              locale === o.locale
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-muted-foreground hover:bg-surface-strong hover:text-foreground",
            )}
          >
            {o.short}
            <span className="sr-only"> — {o.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function VersionNote() {
  const t = useTranslations("account");
  return (
    <p className="pt-1 text-center text-xs text-muted-foreground">
      {t("version", { version: APP_VERSION })}
    </p>
  );
}
