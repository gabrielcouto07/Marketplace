"use client";

import { ArrowLeft, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { TricolorStripe } from "@/components/layout/tricolor-stripe";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface PanelNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface PanelShellProps {
  title: string;
  subtitle?: string;
  items: PanelNavItem[];
  children: ReactNode;
}

/**
 * Casca dos painéis (vendedor/admin): barra branca com a marca, sidebar em desktop e
 * pílulas horizontais roláveis no mobile. Sem bottom nav da loja.
 */
export function PanelShell({ title, subtitle, items, children }: PanelShellProps) {
  const t = useTranslations("sellerPanel");
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === items[0]?.href ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 bg-card pt-safe shadow-card">
        <TricolorStripe />
        <div className="mx-auto flex h-header w-full max-w-7xl items-center gap-3 px-4">
          <BrandMark tone="light" compact />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] leading-tight font-extrabold tracking-tight">
              {title}
            </p>
            {subtitle ? (
              <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <Button variant="soft" size="sm" render={<Link href="/" />}>
            <ArrowLeft data-icon="inline-start" /> {t("backToStore")}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row">
        <nav
          aria-label={title}
          className="border-b border-border bg-card md:w-60 md:shrink-0 md:border-r md:border-b-0"
        >
          <ul className="scrollbar-none flex gap-1.5 overflow-x-auto px-4 py-2.5 md:flex-col md:gap-1 md:p-3">
            {items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 pressable items-center gap-2 rounded-full px-3.5 text-[13px] font-bold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none md:h-11 md:rounded-xl md:px-3 md:text-sm",
                      active
                        ? "bg-primary text-primary-foreground md:bg-accent md:text-primary"
                        : "bg-surface text-muted-foreground hover:bg-surface-strong hover:text-foreground md:bg-transparent md:hover:bg-surface",
                    )}
                  >
                    <Icon className="size-4.5" aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main id="main" className="flex-1 px-4 py-5 pb-[calc(var(--safe-bottom)+1.5rem)] md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Aviso "esqueleto" exibido no topo das páginas dos painéis. */
export function SkeletonNotice({ text }: { text: string }) {
  return (
    <p
      role="note"
      className="mb-4 rounded-xl bg-warning-soft px-3.5 py-2.5 text-xs font-semibold text-warning"
    >
      {text}
    </p>
  );
}

/** Título de página dos painéis (22 px / 800). */
export function PanelTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={cn("mb-4 text-[22px] font-extrabold tracking-tight", className)}>{children}</h1>
  );
}
