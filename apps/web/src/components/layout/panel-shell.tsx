"use client";

import { ArrowLeft, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { TricolorStripe } from "@/components/layout/tricolor-stripe";
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
 * Casca dos painéis (vendedor/admin): topo com logo, sidebar em desktop e
 * tabs horizontais roláveis no mobile. Sem bottom nav da loja.
 */
export function PanelShell({ title, subtitle, items, children }: PanelShellProps) {
  const t = useTranslations("sellerPanel");
  const pathname = usePathname();
  const isActive = (href: string) => (href === items[0]?.href ? pathname === href : pathname.startsWith(href));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 bg-header pt-safe text-header-foreground">
        <div className="mx-auto flex h-header w-full max-w-7xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2" aria-label={t("backToStore")}>
            <Image src="/logo.svg" alt="" width={32} height={32} className="size-8" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base leading-tight font-bold">{title}</p>
            {subtitle ? <p className="truncate text-[11px] text-white/75">{subtitle}</p> : null}
          </div>
          <Link href="/" className="flex h-9 items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-medium hover:bg-white/20">
            <ArrowLeft className="size-4" aria-hidden /> {t("backToStore")}
          </Link>
        </div>
        <TricolorStripe />
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row">
        <nav aria-label={title} className="border-b border-border bg-card md:w-60 md:shrink-0 md:border-r md:border-b-0">
          <ul className="flex overflow-x-auto scrollbar-none md:flex-col md:p-3">
            {items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-12 items-center gap-2 border-b-2 px-4 text-sm font-medium whitespace-nowrap transition-colors md:rounded-lg md:border-b-0 md:px-3",
                      active
                        ? "border-primary text-primary md:bg-accent"
                        : "border-transparent text-muted-foreground hover:text-foreground md:hover:bg-muted",
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
    <p role="note" className="mb-4 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
      {text}
    </p>
  );
}
