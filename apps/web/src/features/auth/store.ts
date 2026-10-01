"use client";

import type { AuthResponseDto, RefreshRequest, UserProfileDto } from "@marketplace/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { http, setAccessTokenProvider, setSessionRefresher } from "@/lib/api/http";

/**
 * Sessão do usuário. O access token curto vive aqui (persistido) e o refresh token também — o backend
 * .NET aceita o refresh tanto no corpo quanto no cookie httpOnly enviado com `credentials: "include"`.
 */
interface AuthState {
  user: UserProfileDto | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  setSession: (session: AuthResponseDto) => void;
  updateUser: (user: UserProfileDto) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      setSession: (session) =>
        set({
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
        }),
      updateUser: (user) => set({ user }),
      signOut: () => set({ user: null, accessToken: null, refreshToken: null, expiresAt: null }),
    }),
    {
      name: "mktpy.session.v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

let bridgeInstalled = false;

/**
 * Liga a store ao client HTTP: injeta o token nas requisições e registra a renovação de sessão.
 * Chamado explicitamente pelos Providers (não depende de importações incidentais desta store).
 *
 * 401 → tenta `POST /auth/refresh` com o refresh token salvo (o backend .NET também aceita o cookie
 * httpOnly) e atualiza a sessão; se não der, encerra a sessão E limpa todo o cache do TanStack Query,
 * para nenhuma tela autenticada ficar com dados de outra pessoa ou de uma sessão expirada.
 */
export function registerAuthHttpBridge(getQueryClient: () => QueryClient): void {
  if (bridgeInstalled) return;
  bridgeInstalled = true;

  setAccessTokenProvider(() => useAuthStore.getState().accessToken);

  const endSession = () => {
    useAuthStore.getState().signOut();
    getQueryClient().clear();
  };

  setSessionRefresher(async () => {
    const { refreshToken, setSession } = useAuthStore.getState();
    if (!refreshToken) {
      endSession();
      return null;
    }
    try {
      const body: RefreshRequest = { refreshToken };
      const session = await http<AuthResponseDto>("/auth/refresh", {
        method: "POST",
        body,
        accessToken: null,
        skipRefresh: true,
      });
      setSession(session);
      return session.accessToken;
    } catch {
      endSession();
      return null;
    }
  });
}

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.user !== null);
}

export function useCurrentUser(): UserProfileDto | null {
  return useAuthStore((s) => s.user);
}
