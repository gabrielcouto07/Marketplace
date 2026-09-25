"use client";

import {
  ChevronRight,
  Download,
  Heart,
  HelpCircle,
  Languages,
  LogOut,
  MapPin,
  Package,
  Shield,
  Store,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLogout } from "@/features/auth/api";
import { useAuthStore, useCurrentUser } from "@/features/auth/store";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { locales, type AppLocale } from "@/i18n/routing";
import { initials } from "@/lib/palette";

const APP_VERSION = "0.1.0";

export function AccountView() {
  const user = useCurrentUser();
  const hydrated = useAuthStore.persist.hasHydrated();

  if (!hydrated) {
    return (
      <PageContainer className="flex flex-col gap-4 py-4">
        <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
        <Skeleton className="h-56 rounded-lg" />
      </PageContainer>
    );
  }

  return user ? <SignedInAccount /> : <GuestAccount />;
}

function GuestAccount() {
  const t = useTranslations("account");
  return (
    <PageContainer className="flex flex-col gap-4 py-4">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs">
        <div className="flex flex-col gap-1">
          <h2 className="text-title-3 text-foreground">{t("guestTitle")}</h2>
          <p className="text-body-sm text-foreground-secondary">{t("guestDescription")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" className="sm:flex-1" render={<Link href="/entrar" />}>
            {t("signIn")}
          </Button>
          <Button variant="secondary" className="sm:flex-1" render={<Link href="/cadastrar" />}>
            {t("signUp")}
          </Button>
        </div>
      </section>

      <MenuCard>
        <MenuLink href="/instalar" icon={Download} label={t("menuInstall")} />
        <HelpRow />
      </MenuCard>

      <LanguageCard />
      <VersionNote />
    </PageContainer>
  );
}

function SignedInAccount() {
  const t = useTranslations("account");
  const tAuth = useTranslations("auth");
  const user = useCurrentUser()!;
  const logout = useLogout();
  const isSeller = user.roles.includes("Vendedor") || user.roles.includes("Admin");
  const isAdmin = user.roles.includes("Admin");

  return (
    <PageContainer className="flex flex-col gap-4 py-4">
      <section className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-title-3 text-primary"
        >
          {initials(user.fullName)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-title-3 text-foreground">{user.fullName}</h2>
          <p className="truncate text-caption text-foreground-muted">{user.email}</p>
        </div>
      </section>

      <MenuCard>
        <MenuLink href="/conta/pedidos" icon={Package} label={t("menuOrders")} />
        <MenuLink href="/conta/perfil" icon={UserCircle} label={t("menuProfile")} />
        <MenuLink href="/conta/enderecos" icon={MapPin} label={t("menuAddresses")} />
        <MenuLink href="/favoritos" icon={Heart} label={t("menuFavorites")} />
        <MenuLink href="/instalar" icon={Download} label={t("menuInstall")} />
        {isSeller ? <MenuLink href="/vendedor" icon={Store} label={t("menuSeller")} /> : null}
        {isAdmin ? <MenuLink href="/admin" icon={Shield} label={t("menuAdmin")} /> : null}
        <HelpRow />
      </MenuCard>

      <LanguageCard />

      <Button
        variant="destructive"
        fullWidth
        loading={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSettled: () => toast(tAuth("loggedOut")) })}
      >
        <LogOut data-icon="inline-start" strokeWidth={1.75} />
        {t("signOut")}
      </Button>

      <VersionNote />
    </PageContainer>
  );
}

/** Card de menu: linhas de 56 px separadas por divide-y. */
function MenuCard({ children }: { children: ReactNode }) {
  const t = useTranslations("account");
  return (
    <nav
      aria-label={t("title")}
      className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface px-4 shadow-xs"
    >
      {children}
    </nav>
  );
}

const MENU_ROW_CLASS =
  "-mx-4 flex h-14 w-[calc(100%+2rem)] items-center gap-3 px-4 text-left transition-colors hover:bg-surface-muted focus-ring disabled:opacity-50";

function MenuRowContent({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <>
      <Icon className="size-5 shrink-0 text-foreground-secondary" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-body text-foreground">{label}</span>
      <ChevronRight
        className="size-5 shrink-0 text-foreground-muted"
        strokeWidth={1.75}
        aria-hidden
      />
    </>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className={MENU_ROW_CLASS}>
      <MenuRowContent icon={icon} label={label} />
    </Link>
  );
}

function HelpRow() {
  const t = useTranslations("account");
  return (
    <button type="button" onClick={() => toast(t("helpSoon"))} className={MENU_ROW_CLASS}>
      <MenuRowContent icon={HelpCircle} label={t("menuHelp")} />
    </button>
  );
}

/** Troca de idioma mantendo a rota atual. */
function LanguageCard() {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const items: Record<AppLocale, string> = {
    "pt-BR": tCommon("portuguese"),
    "es-PY": tCommon("spanish"),
  };

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-xs">
      <Label htmlFor="account-language">
        <Languages className="size-5 text-foreground-secondary" strokeWidth={1.75} aria-hidden />
        {t("menuLanguage")}
      </Label>
      <Select
        value={locale}
        items={items}
        onValueChange={(value) => {
          const next = value as AppLocale;
          if (locales.includes(next) && next !== locale) router.replace(pathname, { locale: next });
        }}
      >
        <SelectTrigger id="account-language" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {locales.map((value) => (
            <SelectItem key={value} value={value}>
              {items[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  );
}

function VersionNote() {
  const t = useTranslations("account");
  return (
    <p className="text-center text-caption text-foreground-secondary">
      {t("version", { version: APP_VERSION })}
    </p>
  );
}
