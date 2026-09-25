"use client";

import { AlertTriangle, ArrowLeft, type LucideIcon } from "lucide-react";
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
 * Casca dos painéis (vendedor/admin): header em brand-deep com a assinatura tricolor,
 * sidebar em desktop e pílulas horizontais roláveis no mobile. Sem bottom nav da loja.
 */
export function PanelShell({ title, subtitle, items, children }: PanelShellProps) {
  const t = useTranslations("sellerPanel");
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === items[0]?.href ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 bg-brand-deep pt-safe text-white">
        <TricolorStripe />
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4">
          <BrandMark tone="dark" compact />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-sm font-semibold">{title}</p>
            {subtitle ? <p className="truncate text-caption text-white/70">{subtitle}</p> : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            render={<Link href="/" />}
          >
            <ArrowLeft data-icon="inline-start" /> {t("backToStore")}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col md:flex-row">
        <nav
          aria-label={title}
          className="border-b border-border bg-surface md:w-60 md:shrink-0 md:border-r md:border-b-0"
        >
          <ul className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-2 md:flex-col md:gap-1 md:p-4">
            {items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 pressable items-center gap-2 rounded-full px-4 text-body-sm font-medium whitespace-nowrap focus-ring transition-colors md:h-11 md:rounded-md md:px-3",
                      active
                        ? "bg-primary-soft text-primary"
                        : "text-foreground-secondary hover:bg-surface-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main id="main" className="flex-1 px-4 py-6 pb-[calc(var(--safe-bottom)+2rem)] md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Aviso "esqueleto" exibido no topo das páginas dos painéis (ícone + texto). */
export function SkeletonNotice({ text }: { text: string }) {
  return (
    <p
      role="note"
      className="mb-6 flex items-start gap-2 rounded-md bg-warning-soft px-4 py-3 text-caption font-medium text-warning"
    >
      <AlertTriangle className="mt-px size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      {text}
    </p>
  );
}

/** Título de página dos painéis. */
export function PanelTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn("mb-6 text-title-1 text-foreground", className)}>{children}</h1>;
}
