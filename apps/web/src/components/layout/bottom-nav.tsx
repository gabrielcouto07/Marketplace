"use client";

import { Heart, Home, LayoutGrid, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { CartBadge } from "@/components/layout/header";
import { selectItemCount, useCartHydrated, useCartStore } from "@/features/cart/store";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  key: "home" | "categories" | "favorites" | "cart" | "account";
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

const ITEMS: NavItem[] = [
  { key: "home", href: "/", icon: Home, match: (p) => p === "/" },
  {
    key: "categories",
    href: "/categorias",
    icon: LayoutGrid,
    match: (p) => p.startsWith("/categoria"),
  },
  { key: "favorites", href: "/favoritos", icon: Heart, match: (p) => p.startsWith("/favoritos") },
  {
    key: "cart",
    href: "/carrinho",
    icon: ShoppingBag,
    match: (p) => p.startsWith("/carrinho") || p.startsWith("/checkout"),
  },
  {
    key: "account",
    href: "/conta",
    icon: User,
    match: (p) => p.startsWith("/conta") || p.startsWith("/entrar") || p.startsWith("/cadastrar"),
  },
];

interface BottomNavProps {
  /** Renderiza em fluxo (não fixo) — usado pelo styleguide. */
  embedded?: boolean;
  /** Força um item ativo (styleguide). */
  activeKey?: NavItem["key"];
  className?: string;
}

/**
 * Bottom nav (DESIGN.md › Navegação): 64 px + safe-area, surface translúcida com borda superior.
 * Ícone ativo em --primary com pill atrás; badge do carrinho em --cta. A busca vive no header.
 */
export function BottomNav({ embedded, activeKey, className }: BottomNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const hydrated = useCartHydrated();
  const count = useCartStore((s) => selectItemCount(s.lines));

  return (
    <nav
      aria-label={t("mainNavigation")}
      className={cn(
        "z-40 border-t border-border bg-surface/85 backdrop-blur-md supports-backdrop-filter:bg-surface/80",
        embedded ? "relative" : "fixed inset-x-0 bottom-0 pb-safe md:hidden",
        className,
      )}
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5 items-stretch">
        {ITEMS.map(({ key, href, icon: Icon, match }) => {
          const active = activeKey ? activeKey === key : match(pathname);
          return (
            <li key={key} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 pressable flex-col items-center justify-center gap-1 px-1 text-caption focus-ring transition-colors",
                  active ? "text-primary" : "text-foreground-secondary hover:text-foreground",
                )}
              >
                <span className="relative flex h-8 w-14 items-center justify-center">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 rounded-full bg-primary-soft transition-opacity duration-200",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icon className="relative size-6" strokeWidth={active ? 2 : 1.75} aria-hidden />
                  {key === "cart" && hydrated ? (
                    <CartBadge count={count} className="-top-1 right-1" />
                  ) : null}
                </span>
                <span className={cn("max-w-full truncate", active && "font-semibold")}>
                  {t(key)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
