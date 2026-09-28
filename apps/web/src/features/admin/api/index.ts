"use client";

import type {
  AdminAuditListQuery,
  AdminAuditLogDto,
  AdminDisputeResolveRequest,
  AdminOrderDetailDto,
  AdminOrderListItemDto,
  AdminOrderListQuery,
  AdminOrderTransitionRequest,
  AdminOverviewDto,
  AdminPaymentListItemDto,
  AdminPaymentListQuery,
  AdminPayoutListQuery,
  AdminProductListItemDto,
  AdminProductListQuery,
  AdminProductUpdateRequest,
  AdminSellerDetailDto,
  AdminSellerListItemDto,
  AdminSellerListQuery,
  AdminSellerUpdateRequest,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUserListQuery,
  AdminUserUpdateRequest,
  CouponDto,
  CouponInput,
  ExchangeRateDto,
  ExchangeRateInput,
  OrderDto,
  PagedResult,
  PaymentDto,
  PayoutDto,
  PlatformSettingsDto,
} from "@marketplace/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";

export const adminApi = {
  overview: () => api.get<AdminOverviewDto>("/admin/overview"),
  users: (q: AdminUserListQuery) =>
    api.get<PagedResult<AdminUserListItemDto>>("/admin/users", { query: { ...q } }),
  user: (id: string) => api.get<AdminUserDetailDto>(`/admin/users/${id}`),
  updateUser: (id: string, body: AdminUserUpdateRequest) =>
    api.put<AdminUserDetailDto>(`/admin/users/${id}`, body),
  blockUser: (id: string, reason: string | null) =>
    api.post<AdminUserDetailDto>(`/admin/users/${id}/block`, { reason }),
  unblockUser: (id: string) => api.post<AdminUserDetailDto>(`/admin/users/${id}/unblock`),
  anonymizeUser: (id: string) => api.delete<void>(`/admin/users/${id}`),
  sellers: (q: AdminSellerListQuery) =>
    api.get<PagedResult<AdminSellerListItemDto>>("/admin/sellers", { query: { ...q } }),
  seller: (id: string) => api.get<AdminSellerDetailDto>(`/admin/sellers/${id}`),
  updateSeller: (id: string, body: AdminSellerUpdateRequest) =>
    api.put<AdminSellerDetailDto>(`/admin/sellers/${id}`, body),
  products: (q: AdminProductListQuery) =>
    api.get<PagedResult<AdminProductListItemDto>>("/admin/products", { query: { ...q } }),
  updateProduct: (id: string, body: AdminProductUpdateRequest) =>
    api.put<AdminProductListItemDto>(`/admin/products/${id}`, body),
  orders: (q: AdminOrderListQuery) =>
    api.get<PagedResult<AdminOrderListItemDto>>("/admin/orders", { query: { ...q } }),
  order: (id: string) => api.get<AdminOrderDetailDto>(`/admin/orders/${id}`),
  transitionOrder: (id: string, body: AdminOrderTransitionRequest) =>
    api.post<OrderDto>(`/admin/orders/${id}/transition`, body),
  resolveDispute: (id: string, body: AdminDisputeResolveRequest) =>
    api.post<OrderDto>(`/admin/orders/${id}/disputes/resolve`, body),
  payments: (q: AdminPaymentListQuery) =>
    api.get<PagedResult<AdminPaymentListItemDto>>("/admin/payments", { query: { ...q } }),
  refundPayment: (id: string) => api.post<PaymentDto>(`/admin/payments/${id}/refund`),
  payouts: (q: AdminPayoutListQuery) =>
    api.get<PagedResult<PayoutDto>>("/admin/payouts", { query: { ...q } }),
  payoutAction: (id: string, action: "mark-paid" | "retry" | "processing") =>
    api.post<PayoutDto>(`/admin/payouts/${id}/${action}`),
  coupons: () => api.get<CouponDto[]>("/admin/coupons"),
  createCoupon: (body: CouponInput) => api.post<CouponDto>("/admin/coupons", body),
  updateCoupon: (id: string, body: CouponInput) => api.put<CouponDto>(`/admin/coupons/${id}`, body),
  deleteCoupon: (id: string) => api.delete<void>(`/admin/coupons/${id}`),
  rates: () => api.get<ExchangeRateDto[]>("/admin/exchange-rates"),
  createRate: (body: ExchangeRateInput) => api.post<ExchangeRateDto>("/admin/exchange-rates", body),
  settings: () => api.get<PlatformSettingsDto>("/admin/settings"),
  updateSettings: (body: PlatformSettingsDto) =>
    api.put<PlatformSettingsDto>("/admin/settings", body),
  audit: (q: AdminAuditListQuery) =>
    api.get<PagedResult<AdminAuditLogDto>>("/admin/audit", { query: { ...q } }),
};

const STALE = 30 * 1000;

export const useAdminOverview = () =>
  useQuery({ queryKey: queryKeys.admin.overview, queryFn: adminApi.overview, staleTime: STALE });

export const useAdminUsers = (q: AdminUserListQuery) =>
  useQuery({
    queryKey: queryKeys.admin.users(q),
    queryFn: () => adminApi.users(q),
    staleTime: STALE,
  });
export const useAdminUser = (id: string | null) =>
  useQuery({
    queryKey: queryKeys.admin.user(id ?? ""),
    queryFn: () => adminApi.user(id!),
    enabled: Boolean(id),
  });

export const useAdminSellers = (q: AdminSellerListQuery) =>
  useQuery({
    queryKey: queryKeys.admin.sellers(q),
    queryFn: () => adminApi.sellers(q),
    staleTime: STALE,
  });
export const useAdminSeller = (id: string | null) =>
  useQuery({
    queryKey: queryKeys.admin.seller(id ?? ""),
    queryFn: () => adminApi.seller(id!),
    enabled: Boolean(id),
  });

export const useAdminProducts = (q: AdminProductListQuery) =>
  useQuery({
    queryKey: queryKeys.admin.products(q),
    queryFn: () => adminApi.products(q),
    staleTime: STALE,
  });

export const useAdminOrders = (q: AdminOrderListQuery) =>
  useQuery({
    queryKey: queryKeys.admin.orders(q),
    queryFn: () => adminApi.orders(q),
    staleTime: STALE,
  });
export const useAdminOrder = (id: string | null) =>
  useQuery({
    queryKey: queryKeys.admin.order(id ?? ""),
    queryFn: () => adminApi.order(id!),
    enabled: Boolean(id),
  });

export const useAdminPayments = (q: AdminPaymentListQuery) =>
  useQuery({
    queryKey: queryKeys.admin.payments(q),
    queryFn: () => adminApi.payments(q),
    staleTime: STALE,
  });
export const useAdminPayouts = (q: AdminPayoutListQuery) =>
  useQuery({
    queryKey: queryKeys.admin.payouts(q),
    queryFn: () => adminApi.payouts(q),
    staleTime: STALE,
  });
export const useAdminCoupons = () =>
  useQuery({ queryKey: queryKeys.admin.coupons, queryFn: adminApi.coupons, staleTime: STALE });
export const useAdminRates = () =>
  useQuery({ queryKey: queryKeys.admin.rates, queryFn: adminApi.rates, staleTime: STALE });
export const useAdminSettings = () =>
  useQuery({ queryKey: queryKeys.admin.settings, queryFn: adminApi.settings, staleTime: STALE });
export const useAdminAudit = (q: AdminAuditListQuery) =>
  useQuery({
    queryKey: queryKeys.admin.audit(q),
    queryFn: () => adminApi.audit(q),
    staleTime: STALE,
  });

/** Toda mutação do admin invalida a área tocada + visão geral + auditoria. */
function useAdminInvalidate() {
  const client = useQueryClient();
  return (...areas: string[]) => {
    for (const area of areas) void client.invalidateQueries({ queryKey: ["admin", area] });
    void client.invalidateQueries({ queryKey: queryKeys.admin.overview });
    void client.invalidateQueries({ queryKey: ["admin", "audit"] });
  };
}

export function useAdminUserMutations() {
  const invalidate = useAdminInvalidate();
  const done = () => invalidate("users");
  return {
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: AdminUserUpdateRequest }) =>
        adminApi.updateUser(id, body),
      onSuccess: done,
    }),
    block: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string | null }) =>
        adminApi.blockUser(id, reason),
      onSuccess: done,
    }),
    unblock: useMutation({ mutationFn: adminApi.unblockUser, onSuccess: done }),
    anonymize: useMutation({ mutationFn: adminApi.anonymizeUser, onSuccess: done }),
  };
}

export function useAdminSellerUpdate() {
  const invalidate = useAdminInvalidate();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminSellerUpdateRequest }) =>
      adminApi.updateSeller(id, body),
    onSuccess: () => {
      invalidate("sellers", "products");
      void client.invalidateQueries({ queryKey: ["sellers"] });
      void client.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useAdminProductUpdate() {
  const invalidate = useAdminInvalidate();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AdminProductUpdateRequest }) =>
      adminApi.updateProduct(id, body),
    onSuccess: () => {
      invalidate("products");
      void client.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useAdminOrderMutations() {
  const invalidate = useAdminInvalidate();
  const done = () => invalidate("orders", "payments", "payouts");
  return {
    transition: useMutation({
      mutationFn: ({ id, body }: { id: string; body: AdminOrderTransitionRequest }) =>
        adminApi.transitionOrder(id, body),
      onSuccess: done,
    }),
    resolve: useMutation({
      mutationFn: ({ id, body }: { id: string; body: AdminDisputeResolveRequest }) =>
        adminApi.resolveDispute(id, body),
      onSuccess: done,
    }),
  };
}

export function useAdminRefund() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: adminApi.refundPayment,
    onSuccess: () => invalidate("payments", "orders", "payouts"),
  });
}

export function useAdminPayoutAction() {
  const invalidate = useAdminInvalidate();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "mark-paid" | "retry" | "processing" }) =>
      adminApi.payoutAction(id, action),
    onSuccess: () => invalidate("payouts"),
  });
}

export function useAdminCouponMutations() {
  const invalidate = useAdminInvalidate();
  const done = () => invalidate("coupons");
  return {
    save: useMutation({
      mutationFn: ({ id, body }: { id: string | null; body: CouponInput }) =>
        id ? adminApi.updateCoupon(id, body) : adminApi.createCoupon(body),
      onSuccess: done,
    }),
    remove: useMutation({ mutationFn: adminApi.deleteCoupon, onSuccess: done }),
  };
}

export function useAdminRateCreate() {
  const invalidate = useAdminInvalidate();
  const client = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createRate,
    onSuccess: () => {
      invalidate("rates");
      void client.invalidateQueries({ queryKey: queryKeys.shipping.exchangeRates });
    },
  });
}

export function useAdminSettingsUpdate() {
  const invalidate = useAdminInvalidate();
  const client = useQueryClient();
  return useMutation({
    mutationFn: adminApi.updateSettings,
    onSuccess: (data) => {
      client.setQueryData(queryKeys.admin.settings, data);
      invalidate("settings");
    },
  });
}
