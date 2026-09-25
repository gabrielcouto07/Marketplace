"use client";

import type { OrderDto, OrderListQuery, PagedResult, PaymentDto, TrackingEventDto } from "@marketplace/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";

export const ordersApi = {
  list: (query: OrderListQuery) => api.get<PagedResult<OrderDto>>("/orders", { query: { ...query } }),
  detail: (id: string) => api.get<OrderDto>(`/orders/${id}`),
  byPurchase: (purchaseId: string) => api.get<OrderDto[]>(`/purchases/${purchaseId}/orders`),
  tracking: (id: string) => api.get<{ trackingCode: string | null; events: TrackingEventDto[] }>(`/orders/${id}/tracking`),
  cancel: (id: string) => api.post<OrderDto>(`/orders/${id}/cancel`),
  openDispute: (id: string) => api.post<OrderDto>(`/orders/${id}/disputes`),
  payment: (id: string) => api.get<PaymentDto>(`/payments/${id}`),
  simulatePaymentApproval: (id: string) => api.post<PaymentDto>(`/payments/${id}/simulate-approval`),
};

export function useOrders(query: Omit<OrderListQuery, "page"> = {}) {
  const pageSize = query.pageSize ?? 10;
  return useInfiniteQuery({
    queryKey: queryKeys.orders.list({ ...query, pageSize }),
    queryFn: ({ pageParam }) => ordersApi.list({ ...query, pageSize, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined),
    staleTime: 30 * 1000,
  });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: queryKeys.orders.detail(id), queryFn: () => ordersApi.detail(id), enabled: Boolean(id), staleTime: 30 * 1000 });
}

export function usePurchaseOrders(purchaseId: string) {
  return useQuery({
    queryKey: queryKeys.orders.byPurchase(purchaseId),
    queryFn: () => ordersApi.byPurchase(purchaseId),
    enabled: Boolean(purchaseId),
  });
}

/** Pagamento com polling a cada 5 s enquanto estiver pendente (Pix/boleto). */
export function usePayment(id: string) {
  return useQuery({
    queryKey: queryKeys.payments.detail(id),
    queryFn: () => ordersApi.payment(id),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === "Pendente" ? 5000 : false),
    staleTime: 0,
  });
}

export function useSimulatePaymentApproval(paymentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => ordersApi.simulatePaymentApproval(paymentId),
    onSuccess: (payment) => {
      client.setQueryData(queryKeys.payments.detail(paymentId), payment);
      void client.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useCancelOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ordersApi.cancel,
    onSuccess: (order) => {
      client.setQueryData(queryKeys.orders.detail(order.id), order);
      void client.invalidateQueries({ queryKey: ["orders", "list"] });
    },
  });
}

export function useOpenDispute() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ordersApi.openDispute,
    onSuccess: (order) => {
      client.setQueryData(queryKeys.orders.detail(order.id), order);
      void client.invalidateQueries({ queryKey: ["orders", "list"] });
    },
  });
}
