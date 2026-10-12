"use client";

import type {
  AdminProductListItemDto,
  AdminSellerDetailDto,
  AdminShipmentListItemDto,
  AuditCompleteRequest,
  AuditPlanRequest,
  AuditPlanResultDto,
  ComplianceDashboardDto,
  DocumentUploadRequest,
  ComplianceIndicator,
  ComplianceOccurrenceDto,
  ComplianceOccurrenceInput,
  ComplianceProgramDto,
  ComplianceTrainingInput,
  ContestationRequest,
  EnforcementActionDto,
  EnforcementActionListQuery,
  IntegrationStatusDto,
  MonitoringAlertDto,
  MonitoringAlertListQuery,
  MonitoringAlertResolveRequest,
  MonitoringRunResultDto,
  OccurrenceStatus,
  OccurrenceStatusRequest,
  PagedResult,
  PresignedUploadDto,
  ProductModerationRequest,
  ProductReportDto,
  ProductReportResolveRequest,
  ProductReportStatus,
  RevokeMeasureRequest,
  RfInteractionCompleteRequest,
  RfInteractionDto,
  RfInteractionInput,
  RfInteractionListQuery,
  SellerAuditDto,
  SellerInfractionInput,
  SellerInfractionResultDto,
  SellerMeasureDto,
  SellerMeasureInput,
  SellerNoticeCreateRequest,
  SellerNoticeDto,
  SellerNoticeListQuery,
  SellerNoticeResolveRequest,
  SellerVerificationRequest,
  ShipmentDto,
  ShipmentStatus,
  TrainingOverviewDto,
} from "@marketplace/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, uploadFile } from "@/lib/api/http";

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

  // ----- Programa de Conformidade e Política de Vendedores -----
  presignDocument: (body: DocumentUploadRequest) => api.post<PresignedUploadDto>("/admin/documents/uploads", body),
  program: () => api.get<ComplianceProgramDto>("/admin/compliance/program"),
  runMonitor: () => api.post<MonitoringRunResultDto>("/admin/compliance/monitor/run"),
  alerts: (q: MonitoringAlertListQuery) =>
    api.get<PagedResult<MonitoringAlertDto>>("/admin/compliance/alerts", { query: { ...q } }),
  resolveAlert: (id: string, body: MonitoringAlertResolveRequest) =>
    api.post<MonitoringAlertDto>(`/admin/compliance/alerts/${id}/resolve`, body),
  rfInteractions: (q: RfInteractionListQuery) =>
    api.get<PagedResult<RfInteractionDto>>("/admin/compliance/rf", { query: { ...q } }),
  createRfInteraction: (body: RfInteractionInput) => api.post<RfInteractionDto>("/admin/compliance/rf", body),
  completeRfInteraction: (id: string, body: RfInteractionCompleteRequest) =>
    api.post<RfInteractionDto>(`/admin/compliance/rf/${id}/complete`, body),
  contest: (body: ContestationRequest) => api.post<RfInteractionDto>("/admin/compliance/contestations", body),
  trainings: () => api.get<TrainingOverviewDto>("/admin/compliance/trainings"),
  registerTraining: (body: ComplianceTrainingInput) => api.post<TrainingOverviewDto>("/admin/compliance/trainings", body),
  actions: (q: EnforcementActionListQuery) =>
    api.get<PagedResult<EnforcementActionDto>>("/admin/compliance/actions", { query: { ...q } }),
  audits: (year?: number) => api.get<SellerAuditDto[]>("/admin/compliance/audits", { query: { year } }),
  planAudits: (body: AuditPlanRequest) => api.post<AuditPlanResultDto>("/admin/compliance/audits/plan", body),
  completeAudit: (id: string, body: AuditCompleteRequest) =>
    api.post<SellerAuditDto>(`/admin/compliance/audits/${id}/complete`, body),
  notices: (q: SellerNoticeListQuery) =>
    api.get<PagedResult<SellerNoticeDto>>("/admin/compliance/notices", { query: { ...q } }),
  resolveNotice: (id: string, body: SellerNoticeResolveRequest) =>
    api.post<SellerNoticeDto>(`/admin/notices/${id}/resolve`, body),
  createNotice: (sellerId: string, body: SellerNoticeCreateRequest) =>
    api.post<SellerNoticeDto>(`/admin/sellers/${sellerId}/notices`, body),
  registerInfraction: (sellerId: string, body: SellerInfractionInput) =>
    api.post<SellerInfractionResultDto>(`/admin/sellers/${sellerId}/infractions`, body),
  applyMeasure: (sellerId: string, body: SellerMeasureInput) =>
    api.post<SellerMeasureDto>(`/admin/sellers/${sellerId}/measures`, body),
  revokeMeasure: (sellerId: string, measureId: string, body: RevokeMeasureRequest) =>
    api.post<SellerMeasureDto>(`/admin/sellers/${sellerId}/measures/${measureId}/revoke`, body),
};

/** Anexo do admin (resposta à Receita, evidência de contestação): documento privado, guardado pela chave. */
export async function uploadAdminDocument(file: File): Promise<PresignedUploadDto> {
  const presigned = await complianceAdminApi.presignDocument({ fileName: file.name, contentType: file.type, sizeBytes: file.size });
  await uploadFile(presigned.uploadUrl, file, presigned.headers);
  return presigned;
}

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

export const useComplianceProgram = () =>
  useQuery({ queryKey: ["admin", "program", "overview"], queryFn: complianceAdminApi.program, staleTime: STALE });

export const useMonitoringAlerts = (q: MonitoringAlertListQuery) =>
  useQuery({ queryKey: ["admin", "program", "alerts", q], queryFn: () => complianceAdminApi.alerts(q), staleTime: STALE });

export const useRfInteractions = (q: RfInteractionListQuery) =>
  useQuery({ queryKey: ["admin", "program", "rf", q], queryFn: () => complianceAdminApi.rfInteractions(q), staleTime: STALE });

export const useTrainings = () =>
  useQuery({ queryKey: ["admin", "program", "trainings"], queryFn: complianceAdminApi.trainings, staleTime: STALE });

export const useEnforcementActions = (q: EnforcementActionListQuery) =>
  useQuery({ queryKey: ["admin", "program", "actions", q], queryFn: () => complianceAdminApi.actions(q), staleTime: STALE });

export const useSellerAudits = (year?: number) =>
  useQuery({ queryKey: ["admin", "program", "audits", year ?? null], queryFn: () => complianceAdminApi.audits(year), staleTime: STALE });

export const useSellerNotices = (q: SellerNoticeListQuery) =>
  useQuery({ queryKey: ["admin", "program", "notices", q], queryFn: () => complianceAdminApi.notices(q), staleTime: STALE });

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

/** Ações do Programa: invalidam o painel, as listas do Programa e a loja afetada. */
export function useProgramMutations() {
  const invalidate = useInvalidate();
  const client = useQueryClient();
  const afterSeller = () => {
    invalidate("program", "sellers", "compliance", "products", "shipments");
    void client.invalidateQueries({ queryKey: ["products"] });
  };
  const afterProgram = () => invalidate("program", "compliance", "settings");
  return {
    runMonitor: useMutation({ mutationFn: complianceAdminApi.runMonitor, onSuccess: afterSeller }),
    resolveAlert: useMutation({
      mutationFn: ({ id, body }: { id: string; body: MonitoringAlertResolveRequest }) => complianceAdminApi.resolveAlert(id, body),
      onSuccess: afterSeller,
    }),
    createRfInteraction: useMutation({ mutationFn: complianceAdminApi.createRfInteraction, onSuccess: afterProgram }),
    completeRfInteraction: useMutation({
      mutationFn: ({ id, body }: { id: string; body: RfInteractionCompleteRequest }) => complianceAdminApi.completeRfInteraction(id, body),
      onSuccess: afterProgram,
    }),
    contest: useMutation({ mutationFn: complianceAdminApi.contest, onSuccess: afterProgram }),
    registerTraining: useMutation({ mutationFn: complianceAdminApi.registerTraining, onSuccess: afterProgram }),
    planAudits: useMutation({ mutationFn: complianceAdminApi.planAudits, onSuccess: afterSeller }),
    completeAudit: useMutation({
      mutationFn: ({ id, body }: { id: string; body: AuditCompleteRequest }) => complianceAdminApi.completeAudit(id, body),
      onSuccess: afterSeller,
    }),
    resolveNotice: useMutation({
      mutationFn: ({ id, body }: { id: string; body: SellerNoticeResolveRequest }) => complianceAdminApi.resolveNotice(id, body),
      onSuccess: afterSeller,
    }),
    createNotice: useMutation({
      mutationFn: ({ sellerId, body }: { sellerId: string; body: SellerNoticeCreateRequest }) =>
        complianceAdminApi.createNotice(sellerId, body),
      onSuccess: afterSeller,
    }),
    registerInfraction: useMutation({
      mutationFn: ({ sellerId, body }: { sellerId: string; body: SellerInfractionInput }) =>
        complianceAdminApi.registerInfraction(sellerId, body),
      onSuccess: afterSeller,
    }),
    applyMeasure: useMutation({
      mutationFn: ({ sellerId, body }: { sellerId: string; body: SellerMeasureInput }) => complianceAdminApi.applyMeasure(sellerId, body),
      onSuccess: afterSeller,
    }),
    revokeMeasure: useMutation({
      mutationFn: ({ sellerId, measureId, body }: { sellerId: string; measureId: string; body: RevokeMeasureRequest }) =>
        complianceAdminApi.revokeMeasure(sellerId, measureId, body),
      onSuccess: afterSeller,
    }),
  };
}
