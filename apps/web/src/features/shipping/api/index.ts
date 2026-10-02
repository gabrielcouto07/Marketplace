"use client";

import type {
  ExchangeRateDto,
  PostalCodeLookupDto,
  ShippingQuoteDto,
  ShippingQuoteRequest,
} from "@marketplace/contracts";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/http";

/** Câmbio é público: sem Authorization o cache de saída da API vale também para quem está logado. */
const PUBLIC = { accessToken: null } as const;
import { queryKeys } from "@/lib/api/query-keys";
import { onlyDigits } from "@/lib/validation/documents";

export const shippingApi = {
  lookupPostalCode: (cep: string) =>
    api.get<PostalCodeLookupDto>(`/postal-codes/${onlyDigits(cep)}`),
  quote: (body: ShippingQuoteRequest) =>
    api.post<ShippingQuoteDto>("/shipping/quotes", {
      ...body,
      postalCode: onlyDigits(body.postalCode),
    }),
  exchangeRates: () => api.get<ExchangeRateDto[]>("/exchange-rates", PUBLIC),
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

/** Cotação de frete por CEP + vendedor, imperativa (botão "Calcular" na página do produto). */
export function useShippingQuoteMutation() {
  return useMutation({ mutationFn: shippingApi.quote });
}

export function useExchangeRates() {
  return useQuery({
    queryKey: queryKeys.shipping.exchangeRates,
    queryFn: shippingApi.exchangeRates,
    staleTime: 15 * 60 * 1000,
  });
}
