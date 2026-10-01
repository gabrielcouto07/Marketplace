"use client";

import { useLocale } from "next-intl";
import { ThemeProvider } from "next-themes";
import { useEffect, type ReactNode } from "react";

import { PwaProvider } from "@/components/layout/pwa-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { registerAuthHttpBridge } from "@/features/auth/store";
import { setLocaleProvider } from "@/lib/api/http";
import { QueryProvider, getQueryClient } from "@/lib/api/query-client";
import { MockProvider } from "@/mocks/mock-provider";

// Token de acesso e renovação de sessão no client HTTP: registro explícito, independente de quem
// importa a store de auth.
registerAuthHttpBridge(getQueryClient);

/**
 * Mantém o `Accept-Language` do client HTTP igual ao locale ativo do next-intl. Renderizado antes
 * dos demais providers para o efeito rodar antes das primeiras queries dos filhos.
 */
function LocaleBridge() {
  const locale = useLocale();
  useEffect(() => {
    setLocaleProvider(() => locale);
  }, [locale]);
  return null;
}

/**
 * Ordem: tema → PWA (registro do SW) → mock (MSW precisa estar pronto antes das queries) → React Query.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <LocaleBridge />
      <PwaProvider>
        <MockProvider>
          <QueryProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster closeButton />
          </QueryProvider>
        </MockProvider>
      </PwaProvider>
    </ThemeProvider>
  );
}
