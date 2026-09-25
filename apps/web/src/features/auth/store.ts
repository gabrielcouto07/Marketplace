"use client";

import type { AuthResponseDto, UserProfileDto } from "@marketplace/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { setAccessTokenProvider } from "@/lib/api/http";

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

export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.user !== null);
}

export function useCurrentUser(): UserProfileDto | null {
  return useAuthStore((s) => s.user);
}
