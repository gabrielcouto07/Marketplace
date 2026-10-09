"use client";

import { ChevronRight, MapPin, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { BackButton } from "@/components/shared/back-button";
import { RemessaConformeHeaderSeal } from "@/components/shared/trust-badge";
import { readStoredCep } from "@/components/shared/cep-shipping-calculator";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/store";
import { selectItemCount, useCartHydrated, useCartStore } from "@/features/cart/store";
import { useStoreHydrated } from "@/hooks/use-store-hydrated";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { formatCep } from "@/lib/validation/documents";

export interface HeaderProps {
  /** Título da página interna (mobile): substitui a busca por título + atalho de busca. */
  title?: string;
  showBack?: boolean;
  /** Oculta a busca (ex.: checkout, login). */
  hideSearch?: boolean;
  /** Conteúdo extra à direita da barra mobile (sobre o Azul: use texto branco). */
  action?: ReactNode;
  /** Páginas que desenham o próprio topo no mobile (galeria do produto, busca com input próprio). */
  hideMobileBar?: boolean;
  className?: string;
}

/**
 * Header de loja (DESIGN.md › Navegação): barra Azul com a marca, "Enviar para", a busca branca
 * com o botão Laranja e os atalhos de conta, pedidos e carrinho em texto branco; embaixo, a faixa
 * de departamentos (Marinho claro) a partir de md.
 * - mobile, home: marca + entrar/carrinho; busca de 44 px; faixa "Enviar para CEP …";
 * - mobile, páginas internas: voltar (ou logo) + busca (ou título) + carrinho numa linha de 56 px;
 * - desktop (≥ md): barra de 64 px + faixa de departamentos de 40 px.
 */
export function Header({
  title,
  showBack,
  hideSearch,
  action,
  hideMobileBar,
  className,
}: HeaderProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const hydrated = useCartHydrated();
  const count = useCartStore((s) => selectItemCount(s.lines));
  const cartCount = hydrated ? count : 0;
  const home = !title && !showBack && !hideSearch;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-header pt-safe text-white",
        // Sem barra mobile, o header só existe a partir de md (a página desenha o próprio topo).
        hideMobileBar && "max-md:static max-md:bg-transparent max-md:pt-0",
        className,
      )}
    >
      {hideMobileBar ? null : home ? (
        <div className="md:hidden">
          <div className="flex h-14 items-center justify-between gap-2 px-3">
            <BrandMark size="sm" />
            <nav aria-label={t("quickActions")} className="flex items-center gap-1">
              <AccountLink variant="mobile" />
              <CartLink count={cartCount} variant="mobile" />
            </nav>
          </div>
          <div className="px-4 pb-3">
            <SearchPill />
          </div>
          <DeliverToStrip />
          <RemessaConformeHeaderSeal variant="strip" />
        </div>
      ) : (
        <div className="flex h-14 items-center gap-2 px-3 md:hidden">
          {showBack ? (
            <BackButton className="text-white hover:bg-white/10 aria-expanded:bg-white/10" />
          ) : (
            <BrandMark compact />
          )}
          {title ? (
            <h1 className="min-w-0 flex-1 truncate text-title-3 text-white">{title}</h1>
          ) : hideSearch ? (
            <div className="flex-1" />
          ) : (
            <SearchPill />
          )}
          {action}
          {title && !hideSearch ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              render={<Link href="/busca" aria-label={t("openSearch")} />}
            >
              <Search strokeWidth={1.75} />
            </Button>
          ) : null}
          {!title && !hideSearch ? <CartLink count={cartCount} variant="mobile" /> : null}
        </div>
      )}
      <DesktopBar cartCount={cartCount} />
      <DepartmentsBar pathname={pathname} />
    </header>
  );
}

/* ------------------------------- Busca -------------------------------- */

/** Botão Laranja da busca: o mesmo bloco no mobile (decorativo) e no desktop (submit). */
const SEARCH_BUTTON =
  "flex w-12 shrink-0 items-center justify-center bg-cta text-cta-foreground transition-colors";

/** Busca no mobile: leva à página de busca, onde o input real ganha foco. */
function SearchPill() {
  const t = useTranslations("nav");
  return (
    <Link
      href="/busca"
      aria-label={t("openSearch")}
      className="flex h-11 min-w-0 flex-1 pressable items-stretch overflow-hidden rounded-md bg-surface shadow-xs focus-ring"
    >
      <span className="flex min-w-0 flex-1 items-center px-3 text-body text-foreground-muted">
        <span className="truncate">{t("searchPlaceholder")}</span>
      </span>
      <span aria-hidden className={SEARCH_BUTTON}>
        <Search className="size-5" strokeWidth={2.25} />
      </span>
    </Link>
  );
}

function DesktopBar({ cartCount }: { cartCount: number }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Estado derivado: quando a URL muda (nova busca), sincroniza o input sem usar effect.
  if (syncedUrlQuery !== urlQuery) {
    setSyncedUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/busca?q=${encodeURIComponent(q)}` : "/busca");
  };

  return (
    <div className="hidden md:block">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-2 px-4 py-2.5">
        <BrandMark className="mr-2" />
        <DeliverToLink />
        <form
          role="search"
          onSubmit={onSubmit}
          className="mx-2 flex h-11 min-w-0 flex-1 items-stretch overflow-hidden rounded-md bg-surface transition-shadow focus-within:ring-3 focus-within:ring-cta"
        >
          <label htmlFor="global-search" className="sr-only">
            {t("searchLabel")}
          </label>
          <input
            id="global-search"
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-full min-w-0 flex-1 bg-transparent px-4 text-body text-foreground outline-none placeholder:text-foreground-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              aria-label={t("clearSearch")}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="flex w-10 shrink-0 items-center justify-center text-foreground-secondary transition-colors hover:text-foreground focus-visible:bg-surface-muted focus-visible:outline-none"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
          ) : null}
          <button
            type="submit"
            aria-label={t("search")}
            className={cn(
              SEARCH_BUTTON,
              "w-13 hover:bg-cta-hover focus-visible:bg-cta-hover focus-visible:outline-none",
            )}
          >
            <Search className="size-6" strokeWidth={2.25} aria-hidden />
          </button>
        </form>
        <nav aria-label={t("quickActions")} className="flex items-center gap-1">
          <AccountLink variant="desktop" />
          <Link
            href="/conta/pedidos"
            className="hidden h-12 flex-col justify-center rounded-sm px-2 link-on-deep lg:flex"
          >
            <span className="text-caption leading-tight text-white/80">{t("ordersLine1")}</span>
            <span className="text-body-sm leading-tight font-bold">{t("ordersLine2")}</span>
          </Link>
          <CartLink count={cartCount} variant="desktop" />
        </nav>
      </div>
    </div>
  );
}

/* --------------------------- Enviar para (CEP) ------------------------ */

const noopSubscribe = () => () => {};

/** CEP salvo pelo cálculo de frete; só existe no cliente (no servidor renderiza o convite). */
function useStoredCep(): string {
  const stored = useSyncExternalStore(noopSubscribe, readStoredCep, () => "");
  return stored ? formatCep(stored) : "";
}

function DeliverToLink() {
  const t = useTranslations("nav");
  const cep = useStoredCep();
  const place = cep ? t("deliverToCep", { cep }) : t("deliverToEmpty");
  return (
    <Link
      href="/conta/enderecos"
      aria-label={t("deliverToLabel", { place })}
      className="hidden h-12 shrink-0 items-end gap-1 rounded-sm px-2 pb-1.5 link-on-deep lg:flex"
    >
      <MapPin className="mb-0.5 size-5" strokeWidth={2} aria-hidden />
      <span className="flex flex-col">
        <span className="text-caption leading-tight text-white/80">{t("deliverTo")}</span>
        <span className="text-body-sm leading-tight font-bold">{place}</span>
      </span>
    </Link>
  );
}

/** Faixa "Enviar para CEP …" sob a busca na home mobile, no Azul um degrau abaixo. */
function DeliverToStrip() {
  const t = useTranslations("nav");
  const cep = useStoredCep();
  const place = cep ? t("deliverToCep", { cep }) : t("deliverToEmpty");
  return (
    <Link
      href="/conta/enderecos"
      aria-label={t("deliverToLabel", { place })}
      className="flex h-10 items-center gap-2 bg-header-raised px-4 text-body-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-realce"
    >
      <MapPin className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="min-w-0 truncate">
        {t("deliverTo")} <span className="font-bold">{place}</span>
      </span>
      <ChevronRight className="ml-auto size-4 shrink-0 text-white/80" strokeWidth={2} aria-hidden />
    </Link>
  );
}

/* ------------------------------ Atalhos ------------------------------- */

/** "Olá, Ana / Conta e favoritos" (desktop) ou "Entrar ›" + ícone (mobile). */
function AccountLink({ variant }: { variant: "desktop" | "mobile" }) {
  const t = useTranslations("nav");
  const hydrated = useStoreHydrated(useAuthStore);
  const user = useAuthStore((s) => s.user);
  const firstName = hydrated && user ? user.fullName.split(/\s+/)[0] : null;

  if (variant === "mobile") {
    return (
      <Link
        href="/conta"
        aria-label={t("account")}
        className="flex h-11 items-center gap-1 rounded-sm px-2 text-body-sm font-medium link-on-deep"
      >
        <span className="max-w-24 truncate">{firstName ?? t("signIn")}</span>
        <ChevronRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        <User className="size-6 shrink-0" strokeWidth={1.75} aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      href="/conta"
      className="flex h-12 max-w-44 flex-col justify-center rounded-sm px-2 link-on-deep"
    >
      <span className="truncate text-caption leading-tight text-white/80">
        {firstName ? t("greeting", { name: firstName }) : t("greetingGuest")}
      </span>
      <span className="truncate text-body-sm leading-tight font-bold">
        {t("accountAndFavorites")}
      </span>
    </Link>
  );
}

function CartLink({ count, variant }: { count: number; variant: "desktop" | "mobile" }) {
  const t = useTranslations("nav");
  const desktop = variant === "desktop";
  return (
    <Link
      href="/carrinho"
      aria-label={t("cartWithCount", { count })}
      className={cn(
        "relative flex shrink-0 items-center rounded-sm link-on-deep",
        desktop ? "h-12 items-end gap-1 px-2 pb-1.5" : "size-11 justify-center",
      )}
    >
      <span className="relative">
        <ShoppingCart className={desktop ? "size-8" : "size-7"} strokeWidth={1.75} aria-hidden />
        <CartBadge count={count} className="-top-2 -right-2 ring-header" />
      </span>
      {desktop ? (
        <span aria-hidden className="text-body-sm font-bold">
          {t("cart")}
        </span>
      ) : null}
    </Link>
  );
}

/* --------------------------- Departamentos ---------------------------- */

const DEPARTMENT_LINK =
  "flex h-8 items-center gap-1.5 rounded-sm px-2 whitespace-nowrap link-on-deep aria-[current=page]:bg-white/10";

/**
 * Faixa de departamentos (≥ md): todos os departamentos, vitrines, o selo Remessa Conforme (quando ligado) e o convite
 * para vender.
 */
function DepartmentsBar({ pathname }: { pathname: string }) {
  const t = useTranslations("nav");
  const links = [
    { href: "/busca?onlyOffers=true", label: t("deals") },
    { href: "/busca?sort=bestSelling", label: t("bestSellers") },
    { href: "/busca?sort=newest", label: t("newArrivals") },
    { href: "/lojas", label: t("stores"), current: pathname.startsWith("/lojas") },
    { href: "/favoritos", label: t("favorites"), current: pathname.startsWith("/favoritos") },
  ];
  return (
    <nav aria-label={t("departments")} className="hidden bg-header-raised md:block">
      <ul className="mx-auto scrollbar-none flex h-10 w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 text-body-sm font-medium">
        <li>
          <Link
            href="/categorias"
            aria-label={t("allDepartmentsLabel")}
            aria-current={pathname.startsWith("/categoria") ? "page" : undefined}
            className={cn(DEPARTMENT_LINK, "-ml-2 font-bold")}
          >
            <Menu className="size-5" strokeWidth={2} aria-hidden />
            {t("allDepartments")}
          </Link>
        </li>
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={l.current ? "page" : undefined}
              className={DEPARTMENT_LINK}
            >
              {l.label}
            </Link>
          </li>
        ))}
        {env.remessaConforme ? (
          <li className="ml-auto">
            <RemessaConformeHeaderSeal variant="nav" />
          </li>
        ) : null}
        <li className={env.remessaConforme ? undefined : "ml-auto"}>
          <Link href="/vendedor/cadastro" className={cn(DEPARTMENT_LINK, "-mr-2 font-bold")}>
            {t("sell")}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/** Contador do carrinho em --cta; entra com uma mola (motion) sempre que a quantidade muda. */
export function CartBadge({ count, className }: { count: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  if (count <= 0) return null;
  return (
    <motion.span
      key={count}
      initial={reduceMotion ? false : { scale: 0.5 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}
      className={cn(
        "absolute top-1 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cta px-1 text-caption font-bold text-cta-foreground tabular-nums ring-2 ring-surface",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}
