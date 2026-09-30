"use client";

import { cva, type VariantProps } from "class-variance-authority";
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
 * Header da identidade "Etiqueta" (DESIGN.md › Navegação): superfície branca, lockup da marca,
 * busca em pill Tinta-100 com o círculo coral, atalhos em tiles pastel e a fita Pervinca na base.
 * - mobile, home: duas linhas (marca + conta/carrinho; busca de 52 px embaixo);
 * - mobile, páginas internas: voltar + busca (ou título) + carrinho numa linha de 64 px;
 * - desktop (≥ md): marca, busca e favoritos/conta/carrinho numa barra de 80 px.
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
        "sticky top-0 z-40 bg-surface pt-safe",
        // Sem barra mobile, o header só existe a partir de md (a página desenha o próprio topo).
        hideMobileBar && "max-md:static max-md:pt-0",
        className,
      )}
    >
      {hideMobileBar ? null : home ? (
        <div className="md:hidden">
          <div className="flex h-16 items-center justify-between gap-3 px-4">
            <BrandMark size="sm" />
            <nav aria-label={t("quickActions")} className="flex items-center gap-2">
              <HeaderTile
                href="/conta"
                label={t("account")}
                tone="lilas"
                size="sm"
                active={pathname.startsWith("/conta")}
              >
                <User strokeWidth={1.75} />
              </HeaderTile>
              <CartTile count={cartCount} size="sm" active={pathname.startsWith("/carrinho")} />
            </nav>
          </div>
          <div className="px-4 pb-4">
            <SearchPill size="lg" />
          </div>
        </div>
      ) : (
        <div className="flex h-16 items-center gap-3 px-4 md:hidden">
          {showBack ? <BackButton className="-ml-2" /> : <BrandMark compact />}
          {title ? (
            <h1 className="min-w-0 flex-1 truncate text-title-3 text-foreground">{title}</h1>
          ) : hideSearch ? (
            <div className="flex-1" />
          ) : (
            <SearchPill size="md" />
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
            <CartTile count={cartCount} size="sm" active={pathname.startsWith("/carrinho")} />
          ) : null}
        </div>
      )}
      <DesktopBar cartCount={cartCount} pathname={pathname} />
      <div aria-hidden className={cn("brand-ribbon", hideMobileBar && "max-md:hidden")} />
    </header>
  );
}

/* ------------------------------- Busca -------------------------------- */

const pillVariants = cva(
  "flex min-w-0 flex-1 pressable items-center gap-2 rounded-full bg-surface-muted text-foreground-muted focus-ring",
  {
    variants: {
      size: {
        lg: "h-13 pr-1 pl-5 text-body font-medium",
        md: "h-12 pr-1 pl-4 text-body-sm font-medium",
      },
    },
  },
);

const searchDotVariants = cva(
  "flex shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground",
  { variants: { size: { lg: "size-11", md: "size-10" } } },
);

/** Pill de busca no mobile: leva à página de busca, onde o input real ganha foco. */
function SearchPill({ size }: { size: "lg" | "md" }) {
  const t = useTranslations("nav");
  return (
    <Link href="/busca" aria-label={t("openSearch")} className={pillVariants({ size })}>
      <span className="min-w-0 flex-1 truncate">{t("searchPlaceholder")}</span>
      <span aria-hidden className={searchDotVariants({ size })}>
        <Search className="size-5" strokeWidth={2.25} />
      </span>
    </Link>
  );
}

function DesktopBar({ cartCount, pathname }: { cartCount: number; pathname: string }) {
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
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center gap-10 px-4">
        <BrandMark />
        <form
          role="search"
          onSubmit={onSubmit}
          className="flex h-14 min-w-0 flex-1 items-center gap-1 rounded-full bg-surface-muted pr-1.5 pl-6 transition-colors focus-within:ring-2 focus-within:ring-focus-ring"
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
            className="h-full min-w-0 flex-1 bg-transparent text-body font-medium text-foreground outline-none placeholder:text-foreground-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              aria-label={t("clearSearch")}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground-secondary focus-ring transition-colors hover:bg-surface hover:text-foreground"
            >
              <X className="size-5" strokeWidth={1.75} />
            </button>
          ) : null}
          <button
            type="submit"
            aria-label={t("search")}
            className={cn(
              searchDotVariants({ size: "lg" }),
              "pressable focus-ring transition-colors hover:bg-cta-hover",
            )}
          >
            <Search className="size-5" strokeWidth={2.25} aria-hidden />
          </button>
        </form>
        <nav aria-label={t("quickActions")} className="flex items-center gap-2">
          <HeaderTile
            href="/favoritos"
            label={t("favorites")}
            tone="coral"
            active={pathname.startsWith("/favoritos")}
          >
            <Heart strokeWidth={1.75} />
          </HeaderTile>
          <HeaderTile
            href="/conta"
            label={t("account")}
            tone="lilas"
            active={pathname.startsWith("/conta")}
          >
            <User strokeWidth={1.75} />
          </HeaderTile>
          <CartTile count={cartCount} active={pathname.startsWith("/carrinho")} />
        </nav>
      </div>
    </div>
  );
}

/* ------------------------------ Atalhos ------------------------------- */

/**
 * Atalho em tile pastel (favoritos Coral, conta Lilás, carrinho Manteiga) com ícone em Tinta.
 * A página atual ganha um anel inset em Tinta.
 */
const tileVariants = cva(
  "relative flex shrink-0 pressable items-center justify-center text-foreground ring-foreground/20 ring-inset focus-ring hover:ring-2 aria-[current=page]:ring-2 [&_svg]:size-6",
  {
    variants: {
      tone: {
        coral: "bg-brand-coral-soft",
        lilas: "bg-brand-lilas",
        manteiga: "bg-brand-manteiga-soft",
      },
      size: {
        sm: "size-11 rounded-md",
        md: "size-12 rounded-lg",
      },
    },
    defaultVariants: { size: "md" },
  },
);

interface HeaderTileProps extends VariantProps<typeof tileVariants> {
  href: string;
  label: string;
  active?: boolean;
  children: ReactNode;
}

function HeaderTile({ href, label, tone, size, active, children }: HeaderTileProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={tileVariants({ tone, size })}
    >
      {children}
    </Link>
  );
}

function CartTile({
  count,
  size,
  active,
}: {
  count: number;
  size?: "sm" | "md";
  active?: boolean;
}) {
  const t = useTranslations("nav");
  return (
    <HeaderTile
      href="/carrinho"
      label={t("cartWithCount", { count })}
      tone="manteiga"
      size={size}
      active={active}
    >
      <ShoppingBag strokeWidth={1.75} />
      <CartBadge count={count} className="-top-1.5 -right-1.5" />
    </HeaderTile>
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
