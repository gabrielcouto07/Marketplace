"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

import { useIsAuthenticated } from "@/features/auth/store";
import { useRouter } from "@/i18n/navigation";

/** Destino pós-login: ?next=/rota (apenas caminhos internos) ou /conta. */
export function useNextPath(): string {
  const params = useSearchParams();
  const next = params.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/conta";
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
