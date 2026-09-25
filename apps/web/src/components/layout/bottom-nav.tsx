"use client";

import { Heart, Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { selectItemCount, useCartHydrated, useCartStore } from "@/features/cart/store";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "home", href: "/", icon: Home, match: (p: string) => p === "/" },
  { key: "categories", href: "/categorias", icon: LayoutGrid, match: (p: string) => p.startsWith("/categoria") || p.startsWith("/busca") },
  { key: "cart", href: "/carrinho", icon: ShoppingCart, match: (p: string) => p.startsWith("/carrinho") || p.startsWith("/checkout") },
  { key: "favorites", href: "/favoritos", icon: Heart, match: (p: string) => p.startsWith("/favoritos") },
  { key: "account", href: "/conta", icon: User, match: (p: string) => p.startsWith("/conta") || p.startsWith("/entrar") || p.startsWith("/cadastrar") },
] as const;

/** Navegação inferior fixa (mobile). Escondida em ≥ md, onde o header cobre as ações. */
export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const hydrated = useCartHydrated();
  const count = useCartStore((s) => selectItemCount(s.lines));

  return (
    <nav
      aria-label={t("mainNavigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-safe backdrop-blur supports-backdrop-filter:bg-background/85 md:hidden"
    >
      <ul className="mx-auto grid h-bottom-nav max-w-lg grid-cols-5">
        {ITEMS.map(({ key, href, icon: Icon, match }) => {
          const active = match(pathname);
          const badge = key === "cart" && hydrated && count > 0 ? count : 0;
          return (
            <li key={key} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-6", active && "fill-primary/15")} strokeWidth={active ? 2.4 : 2} />
                  {badge ? (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-cta px-1 text-[10px] font-bold text-cta-foreground">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                <span>{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
