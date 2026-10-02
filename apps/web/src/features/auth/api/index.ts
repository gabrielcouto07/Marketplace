"use client";

import type {
  AuthResponseDto,
  ForgotPasswordRequest,
  GoogleAuthRequest,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  UserProfileDto,
} from "@marketplace/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestGoogleCredential } from "@/lib/auth/google-identity";
import { api } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { env } from "@/lib/env";

import { useAuthStore } from "../store";

export const authApi = {
  login: (body: LoginRequest) => api.post<AuthResponseDto>("/auth/login", body),
  register: (body: RegisterRequest) => api.post<AuthResponseDto>("/auth/register", body),
  google: (body: GoogleAuthRequest) => api.post<AuthResponseDto>("/auth/google", body),
  forgotPassword: (body: ForgotPasswordRequest) => api.post<void>("/auth/forgot-password", body),
  resetPassword: (body: ResetPasswordRequest) => api.post<void>("/auth/reset-password", body),
  /** O corpo leva o refresh token salvo; o backend também revoga o cookie httpOnly. */
  logout: (body: RefreshRequest) => api.post<void>("/auth/logout", body),
  me: () => api.get<UserProfileDto>("/me"),
  updateProfile: (body: UpdateProfileRequest) => api.put<UserProfileDto>("/me", body),
};

/**
 * Login com Google disponível? No mock sempre; fora dele só com NEXT_PUBLIC_GOOGLE_CLIENT_ID,
 * caso contrário o botão fica oculto (não há como obter um ID token real).
 */
export const GOOGLE_LOGIN_ENABLED = env.apiMocking || Boolean(env.googleClientId);

function useSessionSetter() {
  const setSession = useAuthStore((s) => s.setSession);
  const client = useQueryClient();
  return (session: AuthResponseDto) => {
    setSession(session);
    client.setQueryData(queryKeys.me.profile, session.user);
  };
}

export function useLogin() {
  const set = useSessionSetter();
  return useMutation({ mutationFn: authApi.login, onSuccess: set });
}

export function useRegister() {
  const set = useSessionSetter();
  return useMutation({ mutationFn: authApi.register, onSuccess: set });
}

/**
 * Login com Google: no mock envia um token fictício; fora dele obtém o `credential` real pelo
 * Google Identity Services (prompt One Tap / FedCM) antes de chamar a API.
 */
export function useGoogleLogin() {
  const set = useSessionSetter();
  return useMutation({
    mutationFn: async () => {
      const idToken = env.apiMocking
        ? `mock-google-${Date.now()}`
        : await requestGoogleCredential(env.googleClientId ?? "");
      return authApi.google({ idToken });
    },
    onSuccess: set,
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword });
}

/** Redefinição pelo link do e-mail (`/redefinir-senha?token=`): o backend revoga todas as sessões antigas. */
export function useResetPassword() {
  return useMutation({ mutationFn: authApi.resetPassword });
}

/** Sair: revoga o refresh token na API e limpa sessão + TODO o cache de queries (dados pessoais). */
export function useLogout() {
  const signOut = useAuthStore((s) => s.signOut);
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout({ refreshToken: useAuthStore.getState().refreshToken }),
    onSettled: () => {
      signOut();
      client.clear();
      // O service worker guarda respostas da API para uso offline: esquece tudo antes que outra pessoa use o aparelho.
      navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_API_CACHES" });
    },
  });
}

export function useMe() {
  const token = useAuthStore((s) => s.accessToken);
  const updateUser = useAuthStore((s) => s.updateUser);
  return useQuery({
    queryKey: queryKeys.me.profile,
    queryFn: async () => {
      const user = await authApi.me();
      updateUser(user);
      return user;
    },
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  return useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (user) => {
      updateUser(user);
      client.setQueryData(queryKeys.me.profile, user);
    },
  });
}
