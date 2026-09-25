"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { PwaProvider } from "@/components/layout/pwa-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/lib/api/query-client";
import { MockProvider } from "@/mocks/mock-provider";

/**
 * Ordem: tema → PWA (registro do SW) → mock (MSW precisa estar pronto antes das queries) → React Query.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
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
