"use client";

import type {
  AdminProductListItemDto,
  AdminSellerDetailDto,
  AdminShipmentListItemDto,
  ComplianceDashboardDto,
  ComplianceIndicator,
  ComplianceOccurrenceDto,
  ComplianceOccurrenceInput,
  IntegrationStatusDto,
  OccurrenceStatus,
  OccurrenceStatusRequest,
  PagedResult,
  ProductModerationRequest,
  ProductReportDto,
  ProductReportResolveRequest,
  ProductReportStatus,
  SellerVerificationRequest,
  ShipmentDto,
  ShipmentStatus,
} from "@marketplace/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/http";

export interface OccurrenceListQuery {
  indicator?: ComplianceIndicator;
  sellerId?: string;
  status?: OccurrenceStatus;
  page?: number;
  pageSize?: number;
}

export interface ReportListQuery {
  status?: ProductReportStatus;
  page?: number;
  pageSize?: number;
}

export interface ShipmentListQuery {
  status?: ShipmentStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

/** Remessa Conforme no admin: conformidade, denúncias, moderação, verificação, remessas e integrações. */
export const complianceAdminApi = {
  dashboard: (cycle?: number) => api.get<ComplianceDashboardDto>("/admin/compliance", { query: { cycle } }),
  occurrences: (q: OccurrenceListQuery) =>
    api.get<PagedResult<ComplianceOccurrenceDto>>("/admin/compliance/occurrences", { query: { ...q } }),
  createOccurrence: (body: ComplianceOccurrenceInput) =>
    api.post<ComplianceOccurrenceDto>("/admin/compliance/occurrences", body),
  setOccurrenceStatus: (id: string, body: OccurrenceStatusRequest) =>
    api.post<ComplianceOccurrenceDto>(`/admin/compliance/occurrences/${id}/status`, body),
  reports: (q: ReportListQuery) => api.get<PagedResult<ProductReportDto>>("/admin/reports", { query: { ...q } }),
  resolveReport: (id: string, body: ProductReportResolveRequest) =>
    api.post<ProductReportDto>(`/admin/reports/${id}/resolve`, body),
  moderateProduct: (id: string, body: ProductModerationRequest) =>
    api.post<AdminProductListItemDto>(`/admin/products/${id}/moderate`, body),
  verifySeller: (id: string, body: SellerVerificationRequest) =>
    api.post<AdminSellerDetailDto>(`/admin/sellers/${id}/verify`, body),
  shipments: (q: ShipmentListQuery) =>
    api.get<PagedResult<AdminShipmentListItemDto>>("/admin/shipments", { query: { ...q } }),
  retryShipment: (id: string) => api.post<ShipmentDto>(`/admin/shipments/${id}/retry`),
  integrations: () => api.get<IntegrationStatusDto[]>("/admin/integrations"),
};

const STALE = 30_000;

export const useComplianceDashboard = (cycle?: number) =>
  useQuery({ queryKey: ["admin", "compliance", "dashboard", cycle ?? null], queryFn: () => complianceAdminApi.dashboard(cycle), staleTime: STALE });

export const useOccurrences = (q: OccurrenceListQuery) =>
  useQuery({ queryKey: ["admin", "compliance", "occurrences", q], queryFn: () => complianceAdminApi.occurrences(q), staleTime: STALE });

export const useReports = (q: ReportListQuery) =>
  useQuery({ queryKey: ["admin", "reports", q], queryFn: () => complianceAdminApi.reports(q), staleTime: STALE });

export const useShipments = (q: ShipmentListQuery) =>
  useQuery({ queryKey: ["admin", "shipments", q], queryFn: () => complianceAdminApi.shipments(q), staleTime: STALE });

export const useIntegrations = () =>
  useQuery({ queryKey: ["admin", "integrations"], queryFn: complianceAdminApi.integrations, staleTime: STALE });

function useInvalidate() {
  const client = useQueryClient();
  return (...areas: string[]) => {
    for (const area of areas) void client.invalidateQueries({ queryKey: ["admin", area] });
    void client.invalidateQueries({ queryKey: ["admin", "audit"] });
  };
}

export function useComplianceMutations() {
  const invalidate = useInvalidate();
  const client = useQueryClient();
  const afterCatalog = () => {
    invalidate("compliance", "reports", "products", "sellers");
    void client.invalidateQueries({ queryKey: ["products"] });
  };
  return {
    createOccurrence: useMutation({ mutationFn: complianceAdminApi.createOccurrence, onSuccess: () => invalidate("compliance", "sellers") }),
    setOccurrenceStatus: useMutation({
      mutationFn: ({ id, body }: { id: string; body: OccurrenceStatusRequest }) => complianceAdminApi.setOccurrenceStatus(id, body),
      onSuccess: () => invalidate("compliance"),
    }),
    resolveReport: useMutation({
      mutationFn: ({ id, body }: { id: string; body: ProductReportResolveRequest }) => complianceAdminApi.resolveReport(id, body),
      onSuccess: afterCatalog,
    }),
    moderateProduct: useMutation({
      mutationFn: ({ id, body }: { id: string; body: ProductModerationRequest }) => complianceAdminApi.moderateProduct(id, body),
      onSuccess: afterCatalog,
    }),
    verifySeller: useMutation({
      mutationFn: ({ id, body }: { id: string; body: SellerVerificationRequest }) => complianceAdminApi.verifySeller(id, body),
      onSuccess: afterCatalog,
    }),
    retryShipment: useMutation({ mutationFn: complianceAdminApi.retryShipment, onSuccess: () => invalidate("shipments") }),
  };
}
