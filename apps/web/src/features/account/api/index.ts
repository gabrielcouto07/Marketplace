"use client";

import type { AddressDto, AddressInput } from "@marketplace/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store";
import { api } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";

export const accountApi = {
  addresses: () => api.get<AddressDto[]>("/me/addresses"),
  createAddress: (body: AddressInput) => api.post<AddressDto>("/me/addresses", body),
  updateAddress: (id: string, body: AddressInput) => api.put<AddressDto>(`/me/addresses/${id}`, body),
  deleteAddress: (id: string) => api.delete<void>(`/me/addresses/${id}`),
};

export function useAddresses() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({ queryKey: queryKeys.me.addresses, queryFn: accountApi.addresses, enabled: Boolean(token) });
}

export function useCreateAddress() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: accountApi.createAddress,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.me.addresses }),
  });
}

export function useUpdateAddress() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AddressInput }) => accountApi.updateAddress(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.me.addresses }),
  });
}

export function useDeleteAddress() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: accountApi.deleteAddress,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.me.addresses }),
  });
}
