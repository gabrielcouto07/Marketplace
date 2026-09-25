"use client";

import { Heart, Search, ShoppingBag, User, X } from "lucide-react";
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
  /** Título da página interna (mobile). Sem título nem `showBack`, o mobile não mostra barra. */
  title?: string;
  showBack?: boolean;
  /** Oculta o atalho/campo de busca (ex.: checkout, login). */
  hideSearch?: boolean;
  /** Conteúdo extra à direita da barra mobile (ex.: contador "3 itens"). */
  action?: ReactNode;
  className?: string;
}

/**
 * Duas barras em uma:
 * - mobile: barra translúcida com botão voltar + título (só em páginas internas);
 *   a home usa o hero azul e produto/loja usam botões flutuantes;
 * - desktop (≥ md): barra branca fixa com marca, busca e atalhos, em todas as páginas.
 */
export function Header({ title, showBack, hideSearch, action, className }: HeaderProps) {
  const t = useTranslations("nav");
  const showMobileBar = Boolean(title || showBack);

  return (
    <header className={cn("sticky top-0 z-40 pt-safe", className)}>
      {showMobileBar ? (
        <div className="flex items-center gap-2.5 bg-background/95 px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-background/90 md:hidden">
          {showBack ? <BackButton /> : null}
          {title ? (
            <h1 className="min-w-0 flex-1 truncate text-[19px] font-extrabold tracking-tight">
              {title}
            </h1>
          ) : (
            <div className="flex-1" />
          )}
          {action}
          {!hideSearch ? (
            <Button
              variant="white"
              size="icon"
              render={<Link href="/busca" aria-label={t("openSearch")} />}
            >
              <Search strokeWidth={2.2} />
            </Button>
          ) : null}
        </div>
      ) : null}
      <DesktopBar />
    </header>
  );
}

function DesktopBar() {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [syncedUrlQuery, setSyncedUrlQuery] = useState(urlQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const hydrated = useCartHydrated();
  const count = useCartStore((s) => selectItemCount(s.lines));

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
    <div className="hidden border-b border-border bg-card md:block">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4">
        <BrandMark tone="light" />
        <form role="search" onSubmit={onSubmit} className="relative mx-auto w-full max-w-xl">
          <label htmlFor="global-search" className="sr-only">
            {t("searchLabel")}
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-primary"
            strokeWidth={2.2}
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
            className="h-12 w-full rounded-xl border-0 bg-surface pr-11 pl-12 text-[15px] text-foreground outline-none placeholder:text-placeholder focus-visible:ring-2 focus-visible:ring-primary"
          />
          {query ? (
            <button
              type="button"
              aria-label={t("clearSearch")}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface-strong text-foreground hover:bg-line-200"
            >
              <X className="size-3.5" strokeWidth={2.6} />
            </button>
          ) : null}
        </form>
        <nav aria-label={t("quickActions")} className="flex items-center gap-2">
          <Button
            variant={pathname.startsWith("/favoritos") ? "soft" : "secondary"}
            size="icon"
            render={<Link href="/favoritos" aria-label={t("favorites")} />}
          >
            <Heart />
          </Button>
          <Button
            variant={pathname.startsWith("/conta") ? "soft" : "secondary"}
            size="icon"
            render={<Link href="/conta" aria-label={t("account")} />}
          >
            <User />
          </Button>
          <Button
            variant={pathname.startsWith("/carrinho") ? "soft" : "secondary"}
            size="icon"
            className="relative"
            render={
              <Link
                href="/carrinho"
                aria-label={t("cartWithCount", { count: hydrated ? count : 0 })}
              />
            }
          >
            <ShoppingBag />
            <CartBadge count={hydrated ? count : 0} />
          </Button>
        </nav>
      </div>
    </div>
  );
}

/** Contador vermelho do carrinho; "salta" quando a quantidade muda. */
export function CartBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      key={count}
      className={cn(
        "absolute -top-1 -right-1 flex h-[18px] min-w-[18px] animate-bump items-center justify-center rounded-full bg-cta px-1.5 text-[10.5px] font-extrabold text-cta-foreground ring-2 ring-card",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
