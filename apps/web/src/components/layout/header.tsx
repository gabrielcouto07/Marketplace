"use client";

import { Heart, Search, ShoppingBag, User, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { BackButton } from "@/components/shared/back-button";
import { Button } from "@/components/ui/button";
import { selectItemCount, useCartHydrated, useCartStore } from "@/features/cart/store";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface HeaderProps {
  /** Título da página interna (mobile): substitui a pill de busca por título + atalho de busca. */
  title?: string;
  showBack?: boolean;
  /** Oculta a busca (ex.: checkout, login). */
  hideSearch?: boolean;
  /** Conteúdo extra à direita da barra mobile (ex.: contador "3 itens"). */
  action?: ReactNode;
  /** Páginas que desenham o próprio topo no mobile (galeria do produto, busca com input próprio). */
  hideMobileBar?: boolean;
  className?: string;
}

/**
 * Header sticky translúcido com a busca como elemento principal (DESIGN.md › Navegação).
 * - mobile: marca compacta (ou voltar) + pill de busca de 48 px + carrinho; com `title`,
 *   vira voltar + título + atalho de busca.
 * - desktop (≥ md): marca, input de busca e atalhos (favoritos, conta, carrinho).
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
  const hydrated = useCartHydrated();
  const count = useCartStore((s) => selectItemCount(s.lines));
  const cartCount = hydrated ? count : 0;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border bg-surface/85 pt-safe backdrop-blur-md supports-backdrop-filter:bg-surface/80",
        // Sem barra mobile, o header só existe a partir de md (a página desenha o próprio topo).
        hideMobileBar && "max-md:static max-md:border-0 max-md:pt-0",
        className,
      )}
    >
      {hideMobileBar ? null : (
        <div className="flex h-16 items-center gap-3 px-4 md:hidden">
          {showBack ? <BackButton className="-ml-2" /> : <BrandMark compact />}
          {title ? (
            <h1 className="min-w-0 flex-1 truncate text-title-3 text-foreground">{title}</h1>
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
              className="-mr-2"
              render={<Link href="/busca" aria-label={t("openSearch")} />}
            >
              <Search strokeWidth={1.75} />
            </Button>
          ) : null}
          {!title && !hideSearch ? (
            <Button
              variant="ghost"
              size="icon"
              className="relative -mr-2"
              render={
                <Link href="/carrinho" aria-label={t("cartWithCount", { count: cartCount })} />
              }
            >
              <ShoppingBag strokeWidth={1.75} />
              <CartBadge count={cartCount} />
            </Button>
          ) : null}
        </div>
      )}
      <DesktopBar cartCount={cartCount} />
    </header>
  );
}

/** Pill de busca (48 px): leva à página de busca, onde o input real ganha foco. */
function SearchPill({ className }: { className?: string }) {
  const t = useTranslations("nav");
  return (
    <Link
      href="/busca"
      aria-label={t("openSearch")}
      className={cn(
        "flex h-12 min-w-0 flex-1 pressable items-center gap-3 rounded-full bg-surface-muted px-4 text-body-sm text-foreground-muted focus-ring transition-colors hover:bg-border",
        className,
      )}
    >
      <Search
        className="size-5 shrink-0 text-foreground-secondary"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="truncate">{t("searchPlaceholder")}</span>
    </Link>
  );
}

function DesktopBar({ cartCount }: { cartCount: number }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
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

  const iconVariant = (active: boolean) => (active ? "soft" : "ghost");

  return (
    <div className="hidden md:block">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-4">
        <BrandMark />
        <form role="search" onSubmit={onSubmit} className="relative mx-auto w-full max-w-xl">
          <label htmlFor="global-search" className="sr-only">
            {t("searchLabel")}
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-foreground-secondary"
            strokeWidth={1.75}
          />
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
            className="h-12 w-full rounded-full border border-transparent bg-surface-muted pr-12 pl-12 text-body text-foreground transition-colors outline-none placeholder:text-foreground-muted hover:bg-border focus-visible:border-primary focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-focus-ring/25"
          />
          {query ? (
            <button
              type="button"
              aria-label={t("clearSearch")}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-foreground-secondary focus-ring transition-colors hover:bg-border hover:text-foreground"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          ) : null}
        </form>
        <nav aria-label={t("quickActions")} className="flex items-center gap-1">
          <Button
            variant={iconVariant(pathname.startsWith("/favoritos"))}
            size="icon"
            render={<Link href="/favoritos" aria-label={t("favorites")} />}
          >
            <Heart strokeWidth={1.75} />
          </Button>
          <Button
            variant={iconVariant(pathname.startsWith("/conta"))}
            size="icon"
            render={<Link href="/conta" aria-label={t("account")} />}
          >
            <User strokeWidth={1.75} />
          </Button>
          <Button
            variant={iconVariant(pathname.startsWith("/carrinho"))}
            size="icon"
            className="relative"
            render={<Link href="/carrinho" aria-label={t("cartWithCount", { count: cartCount })} />}
          >
            <ShoppingBag strokeWidth={1.75} />
            <CartBadge count={cartCount} />
          </Button>
        </nav>
      </div>
    </div>
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
        "absolute top-1 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cta px-1 text-caption font-semibold text-cta-foreground tabular-nums ring-2 ring-surface",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}
