import { Suspense, type ReactNode } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { Header, type HeaderProps } from "@/components/layout/header";
import { InstallPrompt } from "@/components/layout/install-prompt";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { TricolorStripe } from "@/components/layout/tricolor-stripe";
import { cn } from "@/lib/utils";

interface StoreShellProps extends HeaderProps {
  children: ReactNode;
  /** Remove a bottom nav (ex.: checkout, pagamento). */
  hideBottomNav?: boolean;
}

/**
 * Casca padrão da vitrine: faixa tricolor no topo, header (barra mobile só em páginas
 * internas; barra desktop sempre), conteúdo e bottom nav com botão de busca flutuante.
 * O padding inferior reserva espaço para a bottom nav + safe-area no mobile.
 */
export function StoreShell({ children, hideBottomNav, ...header }: StoreShellProps) {
  return (
    <>
      <TricolorStripe className="relative z-50" />
      <Suspense fallback={<div className="hidden h-16 bg-card md:block" />}>
        <Header {...header} />
      </Suspense>
      <OfflineBanner />
      <main
        id="main"
        className={cn(
          "flex-1",
          hideBottomNav
            ? "pb-[calc(var(--safe-bottom)+1.5rem)]"
            : "pb-[calc(var(--bottom-nav-height)+var(--safe-bottom)+1.5rem)] md:pb-10",
        )}
      >
        {children}
      </main>
      {hideBottomNav ? null : <BottomNav />}
      <InstallPrompt />
    </>
  );
}

/** Container centralizado com gutters de 16px (mobile) e largura máxima em desktop. */
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
 * Barra fixa no rodapé da tela (acima da bottom nav quando ela existe): CTA de compra,
 * total do checkout, resumo do carrinho. Branca com borda ou "ink" flutuante.
 */
export function StickyBar({
  children,
  tone = "light",
  className,
}: {
  children: ReactNode;
  tone?: "light" | "ink";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 md:sticky md:bottom-4 md:mx-auto md:max-w-6xl md:rounded-2xl",
        tone === "light"
          ? "border-t border-line-200 bg-card px-4 pt-3 pb-[calc(var(--safe-bottom)+1.25rem)] md:border md:px-5 md:pb-3 md:shadow-float"
          : "mx-2.5 mb-[calc(var(--bottom-nav-height)+var(--safe-bottom)+0.5rem)] rounded-2xl bg-ink px-4 py-2.5 pl-4 text-ink-foreground shadow-ink md:mb-0",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3">{children}</div>
    </div>
  );
}
