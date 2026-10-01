"use client";

import type {
  CheckoutQuoteDto,
  CheckoutQuoteRequest,
  PlaceOrderRequest,
  PlaceOrderResponseDto,
} from "@marketplace/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { onlyDigits } from "@/lib/validation/documents";

export const checkoutApi = {
  quote: (body: CheckoutQuoteRequest) =>
    api.post<CheckoutQuoteDto>("/checkout/quotes", {
      ...body,
      postalCode: onlyDigits(body.postalCode),
    }),
  // Fechar a compra inclui a ida ao gateway (autorização do cartão): merece mais tempo que o padrão de 20 s.
  placeOrder: (body: PlaceOrderRequest) =>
    api.post<PlaceOrderResponseDto>("/orders", body, { timeoutMs: 60_000 }),
};

/** Cotação do checkout: recalcula frete por vendedor, impostos estimados e trava o câmbio por 15 min. */
export function useCheckoutQuote() {
  return useMutation({ mutationFn: checkoutApi.quote });
}

export function usePlaceOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: checkoutApi.placeOrder,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
