"use client";

import type { CheckoutQuoteDto, CheckoutQuoteRequest, PlaceOrderRequest, PlaceOrderResponseDto } from "@marketplace/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { onlyDigits } from "@/lib/validation/documents";

export const checkoutApi = {
  quote: (body: CheckoutQuoteRequest) =>
    api.post<CheckoutQuoteDto>("/checkout/quotes", { ...body, postalCode: onlyDigits(body.postalCode) }),
  placeOrder: (body: PlaceOrderRequest) => api.post<PlaceOrderResponseDto>("/orders", body),
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
