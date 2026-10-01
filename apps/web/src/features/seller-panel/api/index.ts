"use client";

import type {
  OrderDto,
  OrderListQuery,
  PagedResult,
  PresignedUploadDto,
  SellerDashboardDto,
  SellerProductDto,
  SellerProductInput,
  SellerProductListItemDto,
  SellerProductListQuery,
  SellerProfileDto,
  SellerProfileInput,
  SellerRegisterRequest,
  SellerRegisterResponseDto,
  ShipOrderRequest,
  UploadRequest,
} from "@marketplace/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthStore } from "@/features/auth/store";
import { isApiError } from "@/lib/api/errors";
import { api, uploadFile } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";

export const sellerPanelApi = {
  cities: () => api.get<string[]>("/seller/cities"),
  register: (body: SellerRegisterRequest) =>
    api.post<SellerRegisterResponseDto>("/seller/register", body),
  profile: () => api.get<SellerProfileDto>("/seller/profile"),
  updateProfile: (body: SellerProfileInput) => api.put<SellerProfileDto>("/seller/profile", body),
  dashboard: () => api.get<SellerDashboardDto>("/seller/dashboard"),
  products: (query: SellerProductListQuery) =>
    api.get<PagedResult<SellerProductListItemDto>>("/seller/products", { query: { ...query } }),
  product: (id: string) => api.get<SellerProductDto>(`/seller/products/${id}`),
  createProduct: (body: SellerProductInput) => api.post<SellerProductDto>("/seller/products", body),
  updateProduct: (id: string, body: SellerProductInput) =>
    api.put<SellerProductDto>(`/seller/products/${id}`, body),
  archiveProduct: (id: string) => api.delete<void>(`/seller/products/${id}`),
  orders: (query: OrderListQuery) =>
    api.get<PagedResult<OrderDto>>("/seller/orders", { query: { ...query } }),
  prepareOrder: (id: string) => api.post<OrderDto>(`/seller/orders/${id}/prepare`),
  shipOrder: (id: string, body: ShipOrderRequest) =>
    api.post<OrderDto>(`/seller/orders/${id}/ship`, body),
  presignUpload: (body: UploadRequest) => api.post<PresignedUploadDto>("/seller/uploads", body),
};

/** 403 SELLER_REQUIRED = usuário logado que ainda não cadastrou a loja. */
export function isSellerRequiredError(error: unknown): boolean {
  return isApiError(error) && error.status === 403 && error.code === "SELLER_REQUIRED";
}

export function useSellerCities() {
  return useQuery({
    queryKey: queryKeys.sellerPanel.cities,
    queryFn: sellerPanelApi.cities,
    staleTime: Infinity,
  });
}

export function useSellerProfile(enabled = true) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: queryKeys.sellerPanel.profile,
    queryFn: sellerPanelApi.profile,
    enabled: enabled && Boolean(token),
    staleTime: 5 * 60 * 1000,
    retry: (count, error) => !isSellerRequiredError(error) && count < 2,
  });
}

export function useRegisterSeller() {
  const client = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: sellerPanelApi.register,
    onSuccess: ({ seller, session }) => {
      // O novo JWT carrega o papel Vendedor; sem isso o painel continuaria devolvendo 403.
      setSession(session);
      client.setQueryData(queryKeys.me.profile, session.user);
      client.setQueryData(queryKeys.sellerPanel.profile, seller);
    },
  });
}

export function useUpdateSellerProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: sellerPanelApi.updateProfile,
    onSuccess: (profile) => {
      client.setQueryData(queryKeys.sellerPanel.profile, profile);
      void client.invalidateQueries({ queryKey: queryKeys.sellers.all });
    },
  });
}

export function useSellerDashboard() {
  return useQuery({
    queryKey: queryKeys.sellerPanel.dashboard,
    queryFn: sellerPanelApi.dashboard,
    staleTime: 60 * 1000,
  });
}

export function useSellerProducts(query: SellerProductListQuery) {
  return useQuery({
    queryKey: queryKeys.sellerPanel.products(query),
    queryFn: () => sellerPanelApi.products(query),
    staleTime: 30 * 1000,
  });
}

export function useSellerProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sellerPanel.product(id ?? ""),
    queryFn: () => sellerPanelApi.product(id!),
    enabled: Boolean(id),
  });
}

function useInvalidateSellerProducts() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["seller", "products"] });
    void client.invalidateQueries({ queryKey: queryKeys.sellerPanel.dashboard });
    // Vitrine pública (home, busca, loja) também reflete a mudança.
    void client.invalidateQueries({ queryKey: ["products"] });
    void client.invalidateQueries({ queryKey: queryKeys.home });
  };
}

export function useCreateProduct() {
  const invalidate = useInvalidateSellerProducts();
  return useMutation({ mutationFn: sellerPanelApi.createProduct, onSuccess: invalidate });
}

export function useUpdateProduct(id: string) {
  const invalidate = useInvalidateSellerProducts();
  return useMutation({
    mutationFn: (body: SellerProductInput) => sellerPanelApi.updateProduct(id, body),
    onSuccess: invalidate,
  });
}

export function useArchiveProduct() {
  const invalidate = useInvalidateSellerProducts();
  return useMutation({ mutationFn: sellerPanelApi.archiveProduct, onSuccess: invalidate });
}

export function useSellerOrders(query: OrderListQuery) {
  return useQuery({
    queryKey: queryKeys.sellerPanel.orders(query),
    queryFn: () => sellerPanelApi.orders(query),
    staleTime: 30 * 1000,
  });
}

function useInvalidateSellerOrders() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ["seller", "orders"] });
    void client.invalidateQueries({ queryKey: queryKeys.sellerPanel.dashboard });
  };
}

export function usePrepareOrder() {
  const invalidate = useInvalidateSellerOrders();
  return useMutation({ mutationFn: sellerPanelApi.prepareOrder, onSuccess: invalidate });
}

export function useShipOrder() {
  const invalidate = useInvalidateSellerOrders();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ShipOrderRequest }) =>
      sellerPanelApi.shipOrder(id, body),
    onSuccess: invalidate,
  });
}

/** Upload em duas etapas: a API assina a URL e o navegador envia o arquivo direto (R2 ou disco local). */
export async function uploadImage(file: File): Promise<PresignedUploadDto> {
  const presigned = await sellerPanelApi.presignUpload({
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
  await uploadFile(presigned.uploadUrl, file, presigned.headers);
  return presigned;
}
