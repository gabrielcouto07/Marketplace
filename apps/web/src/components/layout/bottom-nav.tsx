"use client";

import { Home, LayoutGrid, Search, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { CartBadge } from "@/components/layout/header";
import { selectItemCount, useCartHydrated, useCartStore } from "@/features/cart/store";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  key: "home" | "categories" | "cart" | "account";
  href: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

const LEFT: NavItem[] = [
  { key: "home", href: "/", icon: Home, match: (p) => p === "/" },
  {
    key: "categories",
    href: "/categorias",
    icon: LayoutGrid,
    match: (p) => p.startsWith("/categoria"),
  },
];
const RIGHT: NavItem[] = [
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

/**
 * Navegação inferior (mobile): Início · Categorias · [Buscar flutuante] · Carrinho · Conta.
 * A busca ganha o botão azul elevado no centro — o gesto mais frequente do app.
 */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const hydrated = useCartHydrated();
  const count = useCartStore((s) => selectItemCount(s.lines));
  const searchActive = pathname.startsWith("/busca");

  const renderItem = ({ key, href, icon: Icon, match }: NavItem) => {
    const active = match(pathname);
    return (
      <li key={key} className="flex">
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-14 flex-1 pressable flex-col items-center justify-center gap-[3px] rounded-xl text-[11px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            active ? "text-primary" : "text-ink-400 hover:text-foreground",
          )}
        >
          <span className="relative">
            <Icon className="size-[23px]" strokeWidth={active ? 2.3 : 2} />
            {key === "cart" && hydrated ? (
              <CartBadge count={count} className="-top-1.5 -right-2.5" />
            ) : null}
          </span>
          <span>{t(key)}</span>
        </Link>
      </li>
    );
  };

  return (
    <nav
      aria-label={t("mainNavigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-200 bg-card/95 pb-safe backdrop-blur-md supports-backdrop-filter:bg-card/90 md:hidden"
    >
      <ul className="mx-auto grid h-bottom-nav max-w-lg grid-cols-5 items-center px-1.5 pb-3">
        {LEFT.map(renderItem)}
        <li className="flex justify-center">
          <Link
            href="/busca"
            aria-label={t("search")}
            aria-current={searchActive ? "page" : undefined}
            className={cn(
              "-mt-[30px] flex size-[60px] pressable items-center justify-center rounded-[21px] text-primary-foreground shadow-primary ring-[6px] ring-background transition-colors focus-visible:ring-primary/40 focus-visible:outline-none",
              searchActive ? "bg-primary-hover" : "bg-primary hover:bg-primary-hover",
            )}
          >
            <Search className="size-[26px]" strokeWidth={2.4} />
          </Link>
        </li>
        {RIGHT.map(renderItem)}
      </ul>
    </nav>
  );
}
