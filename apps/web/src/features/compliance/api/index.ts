"use client";

import type {
  ImportTaxBreakdownDto,
  NcmLookupDto,
  ProductReportDto,
  ProductReportRequest,
  PublicReportRequest,
  ReportReceiptDto,
  SellerPolicyInfoDto,
} from "@marketplace/contracts";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { onlyDigits } from "@/lib/validation/documents";

/**
 * Remessa Conforme no lado do comprador e do vendedor: estimativa dos tributos discriminados (mesmas regras do
 * checkout), consulta à tabela NCM oficial, denúncias (página do produto e canal público) e a Política de Vendedores.
 */
export const complianceApi = {
  taxEstimate: (amount: number, state?: string | null, freight?: number | null) =>
    api.get<ImportTaxBreakdownDto>("/taxes/estimate", {
      query: { amount, state: state || undefined, freight: freight ?? undefined },
    }),
  ncm: (code: string) => api.get<NcmLookupDto>(`/ncm/${onlyDigits(code)}`),
  ncmSearch: (q: string) => api.get<NcmLookupDto[]>("/ncm", { query: { q } }),
  reportProduct: (productId: string, body: ProductReportRequest) =>
    api.post<ProductReportDto>(`/products/${productId}/reports`, body),
  /** Canal público de denúncias (Política 6.4): qualquer pessoa, com ou sem cadastro. */
  publicReport: (body: PublicReportRequest) => api.post<ReportReceiptDto>("/reports", body),
  sellerPolicy: () => api.get<SellerPolicyInfoDto>("/policies/seller"),
};

/**
 * Tributos de um valor de produtos. Com `freight` (centavos) a conta inclui o frete cotado; com `state`, o ICMS da UF
 * de destino. Desligado para valores ≤ 0.
 */
export function useTaxEstimate(
  amount: number | null | undefined,
  options: { state?: string | null; freight?: number | null } = {},
) {
  const value = Math.max(0, Math.round(amount ?? 0));
  const state = options.state ?? null;
  const freight = options.freight == null ? null : Math.max(0, Math.round(options.freight));
  return useQuery({
    queryKey: ["taxes", "estimate", value, state, freight],
    queryFn: () => complianceApi.taxEstimate(value, state, freight),
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

export function usePublicReport() {
  return useMutation({ mutationFn: complianceApi.publicReport });
}

/** Versão, aprovação e dados da empresa que completam o texto publicado da Política de Vendedores. */
export function useSellerPolicy() {
  return useQuery({ queryKey: ["policies", "seller"], queryFn: complianceApi.sellerPolicy, staleTime: 60 * 60_000 });
}
