import { Suspense, type ReactNode } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { Header, type HeaderProps } from "@/components/layout/header";
import { InstallPrompt } from "@/components/layout/install-prompt";
import { OfflineBanner } from "@/components/layout/offline-banner";

interface StoreShellProps extends HeaderProps {
  children: ReactNode;
  /** Remove a bottom nav (ex.: checkout, pagamento). */
  hideBottomNav?: boolean;
}

/**
 * Casca padrão das páginas da vitrine: header sticky + conteúdo + bottom nav.
 * O padding inferior reserva espaço para a bottom nav + safe-area no mobile.
 */
export function StoreShell({ children, hideBottomNav, ...header }: StoreShellProps) {
  return (
    <>
      <Suspense fallback={<div className="h-header bg-header" />}>
        <Header {...header} />
      </Suspense>
      <OfflineBanner />
      <main
        id="main"
        className={
          hideBottomNav
            ? "flex-1 pb-[calc(var(--safe-bottom)+1rem)]"
            : "flex-1 pb-[calc(var(--bottom-nav-height)+var(--safe-bottom)+1rem)] md:pb-8"
        }
      >
        {children}
      </main>
      {hideBottomNav ? null : <BottomNav />}
      <InstallPrompt />
    </>
  );
}

/** Container centralizado com gutters de 16px (mobile) e largura máxima em desktop. */
export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 ${className}`}>{children}</div>;
}
