"use client";

import type { AuthResponseDto, UserProfileDto } from "@marketplace/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { http, setAccessTokenProvider, setSessionRefresher } from "@/lib/api/http";

/**
 * Sessão do usuário (mock). Na integração real:
 *  - accessToken curto em memória + refreshToken em cookie httpOnly (recomendado), ou
 *  - manter este store e trocar apenas os hooks em features/auth/api.
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

// Injeta o token no client HTTP sem acoplar lib/api à store.
setAccessTokenProvider(() => useAuthStore.getState().accessToken);

/**
 * 401 → tenta `POST /auth/refresh` com o refresh token salvo (o backend .NET também aceita o cookie
 * httpOnly) e atualiza a sessão; se não der, encerra a sessão para as telas mostrarem "Entre para
 * continuar" em vez de um erro genérico. Sessões antigas do mock se recuperam sozinhas.
 */
setSessionRefresher(async () => {
  const { refreshToken, setSession, signOut } = useAuthStore.getState();
  if (!refreshToken) {
    signOut();
    return null;
  }
  try {
    const session = await http<AuthResponseDto>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      accessToken: null,
      skipRefresh: true,
    });
    setSession(session);
    return session.accessToken;
  } catch {
    signOut();
    return null;
  }
});

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.user !== null);
}

export function useCurrentUser(): UserProfileDto | null {
  return useAuthStore((s) => s.user);
}
