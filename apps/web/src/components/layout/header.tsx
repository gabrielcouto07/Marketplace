"use client";

import { ArrowLeft, Heart, Search, ShoppingCart, User, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { TricolorStripe } from "@/components/layout/tricolor-stripe";
import { Button } from "@/components/ui/button";
import { useCartHydrated, useCartStore, selectItemCount } from "@/features/cart/store";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface HeaderProps {
  /** Título curto para páginas internas (mobile); quando presente mostra botão voltar. */
  title?: string;
  showBack?: boolean;
  /** Oculta a busca (ex.: checkout). */
  hideSearch?: boolean;
  className?: string;
}

export function Header({ title, showBack, hideSearch, className }: HeaderProps) {
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
    <header className={cn("sticky top-0 z-40 bg-header pt-safe text-header-foreground shadow-sm", className)}>
      <div className="mx-auto flex h-header w-full max-w-6xl items-center gap-2 px-3 sm:px-4">
        {showBack ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("back")}
            className="text-header-foreground hover:bg-white/10 hover:text-header-foreground"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          >
            <ArrowLeft />
          </Button>
        ) : (
          <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md py-1 pr-1 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none" aria-label={t("home")}>
            <Image src="/logo.svg" alt="" width={36} height={36} priority className="size-9" />
            <span className="hidden text-base font-bold tracking-tight sm:inline">Marketplace Paraguai</span>
          </Link>
        )}

        {title && !hideSearch ? null : title ? (
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
        ) : null}

        {!hideSearch ? (
          <form role="search" onSubmit={onSubmit} className="relative min-w-0 flex-1">
            <label htmlFor="global-search" className="sr-only">
              {t("searchLabel")}
            </label>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-500" />
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
              className="h-11 w-full rounded-full border-0 bg-white pr-10 pl-9 text-sm text-neutral-900 shadow-inner outline-none placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-brand-red-300"
            />
            {query ? (
              <button
                type="button"
                aria-label={t("clearSearch")}
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </form>
        ) : (
          <div className="flex-1" />
        )}

        <nav aria-label={t("quickActions")} className="hidden items-center gap-1 md:flex">
          <Button
            variant="ghost"
            size="icon"
            className="text-header-foreground hover:bg-white/10 hover:text-header-foreground"
            render={<Link href="/favoritos" aria-label={t("favorites")} />}
          >
            <Heart />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-header-foreground hover:bg-white/10 hover:text-header-foreground"
            render={<Link href="/conta" aria-label={t("account")} />}
          >
            <User />
          </Button>
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative text-header-foreground hover:bg-white/10 hover:text-header-foreground",
            pathname === "/carrinho" && "bg-white/10",
          )}
          render={<Link href="/carrinho" aria-label={t("cartWithCount", { count: hydrated ? count : 0 })} />}
        >
          <ShoppingCart />
          {hydrated && count > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-cta px-1 text-[11px] font-bold text-cta-foreground ring-2 ring-header">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </div>
      <TricolorStripe />
    </header>
  );
}
