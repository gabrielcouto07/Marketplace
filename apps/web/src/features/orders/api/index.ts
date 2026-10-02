"use client";

import type {
  OrderDto,
  OrderListQuery,
  OrderStatus,
  OrderTrackingDto,
  PagedResult,
  PaymentDto,
} from "@marketplace/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";

export const ordersApi = {
  list: (query: OrderListQuery) =>
    api.get<PagedResult<OrderDto>>("/orders", { query: { ...query } }),
  detail: (id: string) => api.get<OrderDto>(`/orders/${id}`),
  byPurchase: (purchaseId: string) => api.get<OrderDto[]>(`/purchases/${purchaseId}/orders`),
  tracking: (id: string) => api.get<OrderTrackingDto>(`/orders/${id}/tracking`),
  cancel: (id: string) => api.post<OrderDto>(`/orders/${id}/cancel`),
  confirmReceipt: (id: string) => api.post<OrderDto>(`/orders/${id}/confirm-receipt`),
  openDispute: (id: string) => api.post<OrderDto>(`/orders/${id}/disputes`),
  payment: (id: string) => api.get<PaymentDto>(`/payments/${id}`),
  /** Só existe no mock (botão "Simular pagamento"). */
  simulatePaymentApproval: (id: string) =>
    api.post<PaymentDto>(`/payments/${id}/simulate-approval`),
};

/** Status em que a transportadora ainda gera eventos: vale consultar o rastreio periodicamente. */
const IN_TRANSIT: readonly OrderStatus[] = ["Enviado", "EmTransitoInternacional"];

export function useOrders(query: Omit<OrderListQuery, "page"> = {}) {
  const pageSize = query.pageSize ?? 10;
  return useInfiniteQuery({
    queryKey: queryKeys.orders.list({ ...query, pageSize }),
    queryFn: ({ pageParam }) => ordersApi.list({ ...query, pageSize, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined,
    staleTime: 30 * 1000,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => ordersApi.detail(id),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

/**
 * Rastreio consultado na transportadora. Só há o que consultar quando o pedido tem código de
 * rastreio; em trânsito (Enviado / EmTransitoInternacional) refaz a consulta a cada 60 s, nos
 * demais status busca uma vez.
 */
export function useOrderTracking(
  orderId: string,
  status: OrderStatus | undefined,
  trackingCode: string | null | undefined,
) {
  const inTransit = status !== undefined && IN_TRANSIT.includes(status);
  return useQuery({
    queryKey: queryKeys.orders.tracking(orderId),
    queryFn: () => ordersApi.tracking(orderId),
    enabled: Boolean(orderId) && Boolean(trackingCode),
    refetchInterval: inTransit ? 60 * 1000 : false,
    staleTime: inTransit ? 0 : 5 * 60 * 1000,
  });
}

export function usePurchaseOrders(purchaseId: string) {
  return useQuery({
    queryKey: queryKeys.orders.byPurchase(purchaseId),
    queryFn: () => ordersApi.byPurchase(purchaseId),
    enabled: Boolean(purchaseId),
  });
}

/**
 * Pagamento com polling enquanto estiver pendente: Pix a cada 5 s (aprovação em segundos), boleto a cada 60 s
 * (compensa em horas/dias; uma aba aberta não precisa bater na API 17 mil vezes por dia). Pix vencido para.
 */
export function usePayment(id: string) {
  return useQuery({
    queryKey: queryKeys.payments.detail(id),
    queryFn: () => ordersApi.payment(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const payment = query.state.data;
      if (!payment || payment.status !== "Pendente") return false;
      if (payment.pix && new Date(payment.pix.expiresAt).getTime() <= Date.now()) return false;
      return payment.method === "Boleto" ? 60_000 : 5_000;
    },
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

function useOrderMutation(mutationFn: (id: string) => Promise<OrderDto>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (order) => {
      client.setQueryData(queryKeys.orders.detail(order.id), order);
      void client.invalidateQueries({ queryKey: ["orders", "list"] });
    },
  });
}

export function useCancelOrder() {
  return useOrderMutation(ordersApi.cancel);
}

/** Comprador confirma que recebeu: Entregue → Concluido (libera o repasse ao vendedor). */
export function useConfirmReceipt() {
  return useOrderMutation(ordersApi.confirmReceipt);
}

export function useOpenDispute() {
  return useOrderMutation(ordersApi.openDispute);
}
