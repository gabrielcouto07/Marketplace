"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

import { useIsAuthenticated } from "@/features/auth/store";
import { useRouter } from "@/i18n/navigation";

const DEFAULT_NEXT = "/conta";

/**
 * Só caminhos internos: "//evil.com", "/\evil.com" e variantes com espaços/tab (que o navegador normaliza
 * para outra origem) caem no padrão. Resolve contra uma origem fixa para detectar qualquer fuga.
 */
export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\s]/.test(next)) return DEFAULT_NEXT;
  try {
    const url = new URL(next, "https://internal.local");
    if (url.origin !== "https://internal.local") return DEFAULT_NEXT;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_NEXT;
  }
}

/** Destino pós-login: ?next=/rota (apenas caminhos internos) ou /conta. */
export function useNextPath(): string {
  const params = useSearchParams();
  return sanitizeNextPath(params.get("next"));
}

/** Retorna uma função que navega para o destino pós-login. */
export function useAuthRedirect(): () => void {
  const router = useRouter();
  const next = useNextPath();
  return useCallback(() => router.replace(next), [router, next]);
}

/** Se já autenticado, sai da tela de login/cadastro. */
export function useRedirectIfAuthenticated(): void {
  const isAuthenticated = useIsAuthenticated();
  const redirect = useAuthRedirect();
  useEffect(() => {
    if (isAuthenticated) redirect();
  }, [isAuthenticated, redirect]);
}
