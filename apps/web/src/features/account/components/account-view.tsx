"use client";

import {
  ChevronRight,
  Download,
  Heart,
  Languages,
  LogOut,
  MapPin,
  Package,
  Shield,
  Store,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/features/auth/api";
import { useAuthStore, useCurrentUser } from "@/features/auth/store";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const APP_VERSION = "0.1.0";

interface MenuItem {
  href: string;
  icon: LucideIcon;
  title: string;
  hint?: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function AccountView() {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const format = useFormatter();
  const user = useCurrentUser();
  const hydrated = useAuthStore.persist.hasHydrated();
  const logout = useLogout();

  if (!hydrated) {
    return (
      <PageContainer className="py-4">
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      </PageContainer>
    );
  }

  if (!user) return <GuestCard />;

  const menu: MenuItem[] = [
    { href: "/conta/pedidos", icon: Package, title: t("menuOrders"), hint: t("menuOrdersHint") },
    { href: "/conta/perfil", icon: UserCircle, title: t("menuProfile"), hint: t("menuProfileHint") },
    { href: "/conta/enderecos", icon: MapPin, title: t("menuAddresses"), hint: t("menuAddressesHint") },
    { href: "/favoritos", icon: Heart, title: t("menuFavorites") },
    { href: "/instalar", icon: Download, title: t("menuInstall") },
    { href: "/vendedor", icon: Store, title: t("menuSeller") },
    { href: "/admin", icon: Shield, title: t("menuAdmin") },
  ];

  return (
    <PageContainer className="flex flex-col gap-4 py-4">
      <section className="flex items-center gap-4 rounded-2xl bg-header p-4 text-header-foreground">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-bold ring-2 ring-white/30" aria-hidden>
          {initials(user.fullName)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{t("hello", { name: user.fullName.split(" ")[0] })}</h1>
          <p className="truncate text-sm text-white/80">{user.email}</p>
          <p className="text-xs text-white/70">{t("memberSince", { date: format.dateTime(new Date(user.createdAt), "short") })}</p>
        </div>
      </section>

      <nav aria-label={t("title")}>
        <ul className="overflow-hidden rounded-2xl border border-border bg-card">
          {menu.map(({ href, icon: Icon, title, hint }) => (
            <li key={href} className="border-b border-border last:border-b-0">
              <Link
                href={href}
                className="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{title}</span>
                  {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
                </span>
                <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
          <li>
            <LanguageSwitcher />
          </li>
        </ul>
      </nav>

      <Button
        variant="outline"
        className="w-full text-destructive hover:text-destructive"
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSettled: () => toast(tAuth("loggedOut")) })}
      >
        <LogOut data-icon="inline-start" />
        {t("signOut")}
      </Button>

      <p className="text-center text-xs text-muted-foreground">{t("version", { version: APP_VERSION })}</p>
    </PageContainer>
  );
}

function GuestCard() {
  const t = useTranslations("account");
  return (
    <PageContainer className="py-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <span className="flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <UserCircle className="size-8" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-bold">{t("guestTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("guestDescription")}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="cta" size="lg" className="flex-1" render={<Link href="/entrar" />}>
            {t("signIn")}
          </Button>
          <Button variant="outline" size="lg" className="flex-1" render={<Link href="/cadastrar" />}>
            {t("signUp")}
          </Button>
        </div>
        <Link href="/instalar" className="text-sm font-medium text-primary hover:underline">
          {t("menuInstall")}
        </Link>
      </div>
      <LanguageSwitcherBlock />
    </PageContainer>
  );
}

function LanguageSwitcher() {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const options = [
    { locale: "pt-BR" as const, label: tCommon("portuguese") },
    { locale: "es-PY" as const, label: tCommon("spanish") },
  ];
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2">
      <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Languages className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold">{t("menuLanguage")}</span>
      <div className="flex gap-1" role="group" aria-label={t("menuLanguage")}>
        {options.map((o) => (
          <Link
            key={o.locale}
            href={pathname}
            locale={o.locale}
            aria-current={locale === o.locale ? "true" : undefined}
            className={cn(
              "flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition-colors",
              locale === o.locale ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:bg-muted",
            )}
          >
            {o.locale === "pt-BR" ? "PT" : "ES"}
            <span className="sr-only"> — {o.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LanguageSwitcherBlock() {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
      <LanguageSwitcher />
    </div>
  );
}
