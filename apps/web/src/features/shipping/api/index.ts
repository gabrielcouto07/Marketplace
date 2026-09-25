"use client";

import type { ExchangeRateDto, PostalCodeLookupDto, ShippingQuoteDto, ShippingQuoteRequest } from "@marketplace/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { onlyDigits } from "@/lib/validation/documents";

export const shippingApi = {
  lookupPostalCode: (cep: string) => api.get<PostalCodeLookupDto>(`/postal-codes/${onlyDigits(cep)}`),
  quote: (body: ShippingQuoteRequest) => api.post<ShippingQuoteDto>("/shipping/quotes", { ...body, postalCode: onlyDigits(body.postalCode) }),
  exchangeRates: () => api.get<ExchangeRateDto[]>("/exchange-rates"),
};

export function usePostalCodeLookup(cep: string) {
  const digits = onlyDigits(cep);
  return useQuery({
    queryKey: queryKeys.shipping.postalCode(digits),
    queryFn: () => shippingApi.lookupPostalCode(digits),
    enabled: digits.length === 8,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** Cotação de frete por CEP + vendedor. Usa query (cacheável) com chave derivada dos itens. */
export function useShippingQuote(request: ShippingQuoteRequest | null) {
  const digits = request ? onlyDigits(request.postalCode) : "";
  const itemsKey = request ? request.items.map((i) => `${i.productId}:${i.variantId ?? "-"}:${i.quantity}`).join("|") : "";
  return useQuery({
    queryKey: queryKeys.shipping.quote(digits, request?.sellerId ?? "", itemsKey),
    queryFn: () => shippingApi.quote(request!),
    enabled: Boolean(request) && digits.length === 8 && (request?.items.length ?? 0) > 0,
    staleTime: 10 * 60 * 1000,
  });
}

/** Variante imperativa (ex.: botão "Calcular"). */
export function useShippingQuoteMutation() {
  return useMutation({ mutationFn: shippingApi.quote });
}

export function useExchangeRates() {
  return useQuery({ queryKey: queryKeys.shipping.exchangeRates, queryFn: shippingApi.exchangeRates, staleTime: 15 * 60 * 1000 });
}
