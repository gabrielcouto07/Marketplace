import { Suspense, type ReactNode } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { Header, type HeaderProps } from "@/components/layout/header";
import { InstallPrompt } from "@/components/layout/install-prompt";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { cn } from "@/lib/utils";

interface StoreShellProps extends HeaderProps {
  children: ReactNode;
  /** Remove a bottom nav (ex.: checkout, pagamento). */
  hideBottomNav?: boolean;
}

/**
 * Casca padrão da vitrine: header sticky com a busca, conteúdo e bottom nav.
 * O padding inferior reserva espaço para a bottom nav + safe-area no mobile.
 */
export function StoreShell({ children, hideBottomNav, ...header }: StoreShellProps) {
  return (
    <>
      <Suspense fallback={<div className="h-16 border-b border-border bg-surface" />}>
        <Header {...header} />
      </Suspense>
      <OfflineBanner />
      <main
        id="main"
        className={cn(
          "flex-1",
          hideBottomNav
            ? "pb-[calc(var(--safe-bottom)+2rem)]"
            : "pb-[calc(var(--bottom-nav-height)+var(--safe-bottom)+2rem)] md:pb-12",
        )}
      >
        {children}
      </main>
      {hideBottomNav ? null : <BottomNav />}
      <InstallPrompt />
    </>
  );
}

/** Container centralizado com gutters de 16 px (mobile) e largura máxima em desktop. */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4", className)}>{children}</div>;
}

/**
 * Barra fixa no rodapé (acima da bottom nav quando ela existe): CTA de compra, total do checkout,
 * resumo do carrinho. `light`: surface translúcida com borda · `dark`: brand-deep flutuante.
 */
export function StickyBar({
  children,
  tone = "light",
  aboveBottomNav,
  className,
}: {
  children: ReactNode;
  tone?: "light" | "dark";
  /** Em páginas com bottom nav, encosta a barra logo acima dela (ex.: página de produto). */
  aboveBottomNav?: boolean;
  className?: string;
}) {
  const dark = tone !== "light";
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 md:sticky md:bottom-4 md:mx-auto md:max-w-6xl md:rounded-lg",
        aboveBottomNav
          ? "bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom))] max-md:pb-3"
          : "bottom-0",
        dark
          ? "mx-4 mb-[calc(var(--bottom-nav-height)+var(--safe-bottom)+0.5rem)] rounded-lg bg-brand-deep px-4 py-3 text-white shadow-lg md:mb-0"
          : "border-t border-border bg-surface/95 px-4 pt-3 pb-[calc(var(--safe-bottom)+0.75rem)] backdrop-blur-md md:border md:px-4 md:pb-3 md:shadow-md",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3">{children}</div>
    </div>
  );
}
