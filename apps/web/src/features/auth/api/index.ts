"use client";

import type {
  AuthResponseDto,
  ForgotPasswordRequest,
  GoogleAuthRequest,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  UserProfileDto,
} from "@marketplace/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";

import { useAuthStore } from "../store";

export const authApi = {
  login: (body: LoginRequest) => api.post<AuthResponseDto>("/auth/login", body),
  register: (body: RegisterRequest) => api.post<AuthResponseDto>("/auth/register", body),
  google: (body: GoogleAuthRequest) => api.post<AuthResponseDto>("/auth/google", body),
  forgotPassword: (body: ForgotPasswordRequest) => api.post<void>("/auth/forgot-password", body),
  logout: () => api.post<void>("/auth/logout"),
  me: () => api.get<UserProfileDto>("/me"),
  updateProfile: (body: UpdateProfileRequest) => api.put<UserProfileDto>("/me", body),
};

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

/** Login com Google (mock): na integração real, obter o idToken via Google Identity Services. */
export function useGoogleLogin() {
  const set = useSessionSetter();
  return useMutation({ mutationFn: () => authApi.google({ idToken: `mock-google-${Date.now()}` }), onSuccess: set });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword });
}

export function useLogout() {
  const signOut = useAuthStore((s) => s.signOut);
  const client = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      signOut();
      client.removeQueries({ queryKey: queryKeys.me.profile });
      client.removeQueries({ queryKey: ["orders"] });
      client.removeQueries({ queryKey: queryKeys.me.addresses });
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
