"use client";

import type {
  ImportTaxBreakdownDto,
  NcmLookupDto,
  ProductReportDto,
  ProductReportRequest,
} from "@marketplace/contracts";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { onlyDigits } from "@/lib/validation/documents";

/**
 * Remessa Conforme no lado do comprador e do vendedor: estimativa dos tributos discriminados (mesmas regras do
 * checkout), consulta à tabela NCM oficial e denúncia de produto.
 */
export const complianceApi = {
  taxEstimate: (amount: number, state?: string | null) =>
    api.get<ImportTaxBreakdownDto>("/taxes/estimate", { query: { amount, state: state || undefined } }),
  ncm: (code: string) => api.get<NcmLookupDto>(`/ncm/${onlyDigits(code)}`),
  ncmSearch: (q: string) => api.get<NcmLookupDto[]>("/ncm", { query: { q } }),
  reportProduct: (productId: string, body: ProductReportRequest) =>
    api.post<ProductReportDto>(`/products/${productId}/reports`, body),
};

/** Tributos de um valor de produtos (sem frete). Desligado para valores ≤ 0. */
export function useTaxEstimate(amount: number | null | undefined, state?: string | null) {
  const value = Math.max(0, Math.round(amount ?? 0));
  return useQuery({
    queryKey: ["taxes", "estimate", value, state ?? null],
    queryFn: () => complianceApi.taxEstimate(value, state),
    enabled: value > 0,
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Busca o NCM na tabela oficial quando tem 8 dígitos. */
export function useNcmLookup(code: string | null | undefined) {
  const digits = onlyDigits(code ?? "");
  return useQuery({
    queryKey: ["ncm", digits],
    queryFn: () => complianceApi.ncm(digits),
    enabled: digits.length === 8,
    staleTime: 60 * 60_000,
    retry: false,
  });
}

export function useReportProduct(productId: string) {
  return useMutation({ mutationFn: (body: ProductReportRequest) => complianceApi.reportProduct(productId, body) });
}
