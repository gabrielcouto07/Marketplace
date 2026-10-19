import {
  SELLER_VERIFICATION_ITEMS,
  type AuditPlanResultDto,
  type ComplianceProgramDto,
  type ContestationRequest,
  type DocumentRefDto,
  type DocumentRequestKind,
  type EnforcementActionDto,
  type EnforcementActionKind,
  type InfractionSeverity,
  type MeasureRecommendationDto,
  type MonitoringAlertDto,
  type MonitoringRunResultDto,
  type OrderDto,
  type ProductDetailDto,
  type ProductReportDto,
  type ProductReportReason,
  type ProgramTaskDto,
  type ReportChannel,
  type RfInteractionDto,
  type SellerAuditDto,
  type SellerComplianceStatusDto,
  type SellerGovernanceDto,
  type SellerMeasureDto,
  type SellerMeasureType,
  type SellerNoticeDto,
  type SellerNoticeType,
  type TrainingOverviewDto,
  type TrainingStatusDto,
} from "@marketplace/contracts";

import { formatMoney } from "@/lib/money";

import {
  allSellers,
  documentLink,
  findProduct,
  findSellerById,
  missingAdmissionData,
  productDeclaration,
  productNcm,
  sellerKyc,
  sellerStatus,
} from "./catalog-state";
import { db, type StoredFile, type StoredInfraction, type StoredMeasure, type StoredNotice, type StoredRfInteraction } from "./db";
import { ADMIN_USER } from "./fixtures/account";
import { getRate } from "./fixtures/base";
import { addBusinessDays } from "./fixtures/compliance";
import { formatNcm, maskDocument } from "./fixtures/remessa";
import { buildTextPdf, type TextPdfLine } from "./pdf";

/**
 * Programa de Conformidade e Política de Vendedores no mock, com as mesmas regras da API (SellerGovernanceService,
 * MonitoringService, ReceitaRelationsService e ComplianceProgramService): comunicações com prazo de 10 dias,
 * infrações e reincidência, medidas graduadas, aceite da Política, monitoramento, capacitação, auditoria e o painel.
 */

export const SELLER_RESPONSE_DAYS = 10;
const DAY_MS = 86_400_000;
const RECIDIVISM_MONTHS = 12;

const now = () => new Date();
const nowIso = () => now().toISOString();
const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
const addMonths = (iso: string, months: number) => {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString();
};

// ---------------------------------------------------------------------------
// Arquivos e registro de ações
// ---------------------------------------------------------------------------

export function fileRef(file: StoredFile): DocumentRefDto {
  return { key: file.key, url: documentLink(file.key) ?? file.key, name: file.name };
}

/** Chaves `doc/…` enviadas → anexos com o nome original guardado no upload. */
export function storedFiles(keys: string[] | null | undefined): StoredFile[] {
  return (keys ?? [])
    .map((k) => k.trim())
    .filter(Boolean)
    .map((raw) => {
      const key = raw.startsWith("/api/documents/") ? raw.slice("/api/documents/".length).split("?")[0] : raw;
      return { key, name: db.uploads[key]?.fileName ?? key.split("/").pop() ?? key };
    });
}

/** Programa 8.9 e Política 6.8: cada ação contra produtos ilegais fica registrada com o resultado. */
export function logAction(
  kind: EnforcementActionKind,
  reason: string,
  result: string,
  opts: { sellerId?: string | null; productId?: string | null; reportId?: string | null; automatic?: boolean } = {},
): void {
  const seller = opts.sellerId ? findSellerById(opts.sellerId) : null;
  const product = opts.productId ? findProduct(opts.productId) : null;
  const entry: EnforcementActionDto = {
    id: (db.actions.reduce((max, a) => Math.max(max, a.id), 0) ?? 0) + 1,
    kind,
    occurredAt: nowIso(),
    automatic: opts.automatic ?? false,
    actorEmail: opts.automatic ? null : db.user.email,
    sellerId: seller?.id ?? null,
    sellerName: seller?.name ?? null,
    productId: product?.id ?? null,
    productName: product?.name ?? null,
    reportId: opts.reportId ?? null,
    reason: reason.slice(0, 500),
    result: result.slice(0, 500),
  };
  db.actions.unshift(entry);
}

// ---------------------------------------------------------------------------
// Comunicações (Política 4.6, 6.2, 8.4 a 8.6, 10.3)
// ---------------------------------------------------------------------------

export function noticeDto(n: StoredNotice): SellerNoticeDto {
  return {
    ...n,
    overdue: n.status === "Aberta" && Boolean(n.dueAt) && new Date(n.dueAt!).getTime() < Date.now(),
    responseFiles: n.responseFiles.map(fileRef),
  };
}

const DOCUMENT_KIND_TEXT: Record<DocumentRequestKind, string> = {
  Autenticidade: "autenticidade do produto",
  ValorDaOperacao: "valor da operação",
  Registros: "registros das operações",
};

const DEFAULT_TITLE: Record<SellerNoticeType, string> = {
  Medida: "Medida aplicada",
  SolicitacaoDocumentos: "Pedido de documentos",
  AtualizacaoCadastral: "Correção de dados cadastrais",
  AlteracaoPolitica: "Alteração da Política de Vendedores",
  Aviso: "Aviso da plataforma",
};

/** Prazo de resposta: 10 dias para documentos, correção de dados e medidas; avisos e mudança de Política não têm. */
const hasDeadline = (type: SellerNoticeType) =>
  type === "SolicitacaoDocumentos" || type === "AtualizacaoCadastral" || type === "Medida";

export function addNotice(input: {
  sellerId: string;
  type: SellerNoticeType;
  message: string;
  title?: string | null;
  documentKind?: DocumentRequestKind | null;
  productId?: string | null;
  order?: OrderDto | null;
  measureId?: string | null;
}): StoredNotice {
  const seller = findSellerById(input.sellerId);
  const product = input.productId ? findProduct(input.productId) : null;
  const createdAt = nowIso();
  const title =
    input.title?.trim() ||
    (input.type === "SolicitacaoDocumentos" && input.documentKind
      ? `Pedido de documentos — ${DOCUMENT_KIND_TEXT[input.documentKind]}`
      : DEFAULT_TITLE[input.type]);
  const notice: StoredNotice = {
    id: crypto.randomUUID(),
    sellerId: input.sellerId,
    sellerName: seller?.name ?? "",
    type: input.type,
    status: "Aberta",
    documentKind: input.documentKind ?? null,
    title: title.slice(0, 160),
    message: input.message,
    productId: product?.id ?? null,
    productName: product?.name ?? null,
    productSlug: product?.slug ?? null,
    orderId: input.order?.id ?? null,
    orderNumber: input.order?.number ?? null,
    measureId: input.measureId ?? null,
    createdAt,
    dueAt: hasDeadline(input.type) ? addDays(createdAt, SELLER_RESPONSE_DAYS) : null,
    readAt: null,
    responseText: null,
    responseFiles: [],
    respondedAt: null,
    resolution: null,
    resolvedAt: null,
  };
  db.notices.unshift(notice);
  return notice;
}

// ---------------------------------------------------------------------------
// Infrações e medidas (Política 8.1 a 8.3)
// ---------------------------------------------------------------------------

/** Infrações da loja nos últimos 12 meses (reincidência). */
export function infractionsIn12Months(sellerId: string, exceptId?: string): StoredInfraction[] {
  const since = addMonths(nowIso(), -RECIDIVISM_MONTHS);
  return db.infractions.filter((i) => i.sellerId === sellerId && i.id !== exceptId && i.occurredAt >= since);
}

export function addInfraction(
  sellerId: string,
  input: {
    code: string;
    description: string;
    severity: InfractionSeverity;
    intentional: boolean;
    productId?: string | null;
    orderNumber?: string | null;
    occurredAt?: string | null;
  },
): StoredInfraction {
  const occurredAt = input.occurredAt ?? nowIso();
  const product = input.productId ? findProduct(input.productId) : null;
  const prior = db.infractions.filter(
    (i) => i.sellerId === sellerId && i.occurredAt <= occurredAt && i.occurredAt >= addMonths(occurredAt, -RECIDIVISM_MONTHS),
  );
  const infraction: StoredInfraction = {
    id: crypto.randomUUID(),
    sellerId,
    code: input.code,
    description: input.description,
    severity: input.severity,
    intentional: input.intentional,
    productId: product?.id ?? null,
    productName: product?.name ?? null,
    orderNumber: input.orderNumber ?? null,
    occurredAt,
    registeredAt: nowIso(),
    recidivist: prior.length > 0,
  };
  db.infractions.unshift(infraction);
  logAction("InfracaoRegistrada", `${input.code}: ${input.description}`, prior.length > 0 ? "Reincidente (12 meses)." : "Registrada.", {
    sellerId,
    productId: product?.id,
  });
  return infraction;
}

const MEASURE_TEXT: Record<SellerMeasureType, string> = {
  RemocaoAnuncio: "remoção do anúncio",
  SuspensaoTemporaria: "suspensão temporária",
  Exclusao: "exclusão da plataforma",
};

/** Graduação da Política 8.2 (mesma tabela de MeasureGuide.Recommend). */
export function recommendMeasure(
  severity: InfractionSeverity,
  priorInfractions: number,
  intentional: boolean,
  hasProduct: boolean,
): MeasureRecommendationDto {
  let type: SellerMeasureType;
  let days: number | null = null;
  if (severity === "Grave" && (intentional || priorInfractions >= 1)) type = "Exclusao";
  else if (priorInfractions >= 3) type = "Exclusao";
  else if (severity === "Grave") [type, days] = ["SuspensaoTemporaria", 90];
  else if (priorInfractions >= 1 || intentional) [type, days] = ["SuspensaoTemporaria", severity === "Media" ? 30 : 15];
  else if (hasProduct) type = "RemocaoAnuncio";
  else [type, days] = ["SuspensaoTemporaria", severity === "Media" ? 15 : 7];
  const reasons = [
    `gravidade ${severity === "Media" ? "média" : severity.toLowerCase()}`,
    priorInfractions > 0 ? `${priorInfractions} infração(ões) nos 12 meses anteriores` : "primeira infração em 12 meses",
    intentional ? "com intenção" : "sem intenção comprovada",
  ];
  return {
    type,
    suspensionDays: days,
    priorInfractions,
    recidivist: priorInfractions > 0,
    rationale: `Sugestão: ${MEASURE_TEXT[type]}${days ? ` por ${days} dias` : ""} (${reasons.join(", ")}; Política 8.2 e 8.3).`,
  };
}

export function measureDto(m: StoredMeasure): SellerMeasureDto {
  const { sellerId: _seller, ...rest } = m;
  const ended = Boolean(m.endsAt) && new Date(m.endsAt!).getTime() <= Date.now();
  return { ...rest, active: !m.revokedAt && !ended };
}

/**
 * Aplica a medida (Política 8.1): remove o anúncio, suspende (com ou sem prazo) ou exclui a loja, e comunica o motivo
 * ao vendedor com prazo de 10 dias para responder (8.5 e 8.6).
 */
export function applyMeasure(
  sellerId: string,
  input: { type: SellerMeasureType; reason: string; infractionId?: string | null; productId?: string | null; suspensionDays?: number | null },
  automatic = false,
  moderationReason = "MEDIDA",
): StoredMeasure {
  const appliedAt = nowIso();
  const product = input.productId ? findProduct(input.productId) : null;
  const measure: StoredMeasure = {
    id: crypto.randomUUID(),
    sellerId,
    type: input.type,
    reason: input.reason,
    infractionId: input.infractionId ?? null,
    productId: product?.id ?? null,
    productName: product?.name ?? null,
    appliedAt,
    automatic,
    endsAt: input.type === "SuspensaoTemporaria" && input.suspensionDays ? addDays(appliedAt, input.suspensionDays) : null,
    revokedAt: null,
    revocationReason: null,
    active: true,
    noticeId: null,
  };
  const kyc = sellerKyc(sellerId);
  if (input.type === "RemocaoAnuncio" && product) {
    db.productOverrides[product.id] = {
      ...db.productOverrides[product.id],
      status: "Bloqueado",
      moderationReason,
      moderationNote: input.reason.slice(0, 500),
      updatedAt: appliedAt,
    };
    logAction("AnuncioRemovido", input.reason, "Anúncio fora da vitrine; vendedor comunicado.", { sellerId, productId: product.id, automatic });
  } else if (input.type === "SuspensaoTemporaria") {
    db.sellerOverrides[sellerId] = { ...db.sellerOverrides[sellerId], status: "Suspenso" };
    db.sellerKyc[sellerId] = { ...kyc, suspensionReason: input.reason, suspendedUntil: measure.endsAt };
  } else if (input.type === "Exclusao") {
    db.sellerOverrides[sellerId] = { ...db.sellerOverrides[sellerId], status: "Excluido" };
    db.sellerKyc[sellerId] = { ...kyc, suspensionReason: input.reason, suspendedUntil: null };
  }
  const notice = addNotice({
    sellerId,
    type: "Medida",
    productId: product?.id,
    measureId: measure.id,
    title: product ? `Remoção do anúncio "${product.name}"` : `Medida aplicada: ${MEASURE_TEXT[input.type]}`,
    message:
      `${MEASURE_TEXT[input.type][0].toUpperCase()}${MEASURE_TEXT[input.type].slice(1)}${measure.endsAt ? ` até ${new Date(measure.endsAt).toLocaleDateString("pt-BR")}` : ""}.\n\n` +
      `Motivo: ${input.reason}\n\nVocê pode responder em até ${SELLER_RESPONSE_DAYS} dias, com os documentos que tiver (Política de Vendedores, item 8.6).`,
  });
  measure.noticeId = notice.id;
  db.measures.unshift(measure);
  logAction("MedidaAplicada", input.reason, `${MEASURE_TEXT[input.type]}${measure.endsAt ? ` até ${measure.endsAt.slice(0, 10)}` : ""}.`, {
    sellerId,
    productId: product?.id,
    automatic,
  });
  return measure;
}

export function revokeMeasure(measure: StoredMeasure, reason: string): void {
  measure.revokedAt = nowIso();
  measure.revocationReason = reason;
  measure.active = false;
  const sellerId = measure.sellerId;
  if (measure.type === "RemocaoAnuncio" && measure.productId) {
    const o = db.productOverrides[measure.productId];
    if (o?.status === "Bloqueado")
      db.productOverrides[measure.productId] = { ...o, status: "Ativo", moderationReason: null, moderationNote: null, updatedAt: nowIso() };
    logAction("AnuncioLiberado", reason, "Anúncio de volta à vitrine.", { sellerId, productId: measure.productId });
  } else if (sellerStatus(sellerId) === "Suspenso" || sellerStatus(sellerId) === "Excluido") {
    const kyc = sellerKyc(sellerId);
    db.sellerOverrides[sellerId] = { ...db.sellerOverrides[sellerId], status: kyc.verifiedAt ? "Aprovado" : "Pendente" };
    db.sellerKyc[sellerId] = { ...kyc, suspensionReason: null, suspendedUntil: null };
  }
  logAction("MedidaRevogada", reason, "Medida revogada.", { sellerId, productId: measure.productId });
}

const DATA_NOT_UPDATED_REASON =
  "Dados cadastrais não corrigidos em 10 dias contados da solicitação (Política de Vendedores, item 8.4). A suspensão termina quando o cadastro for atualizado.";

/** Suspensão automática por dados não corrigidos em 10 dias (Política 8.4); a atualização do cadastro a levanta. */
export function suspendForDataNotUpdated(sellerId: string): void {
  const infraction = addInfraction(sellerId, {
    code: "DADOS_CADASTRAIS",
    description: "Dados cadastrais não corrigidos ou confirmados no prazo de 10 dias contados da solicitação.",
    severity: "Leve",
    intentional: false,
  });
  applyMeasure(sellerId, { type: "SuspensaoTemporaria", reason: DATA_NOT_UPDATED_REASON, infractionId: infraction.id }, true);
}

/**
 * Dados confirmados ou atualizados pelo vendedor (Política 4.2 e 4.3), como `MarkDataConfirmedAsync`: encerra os pedidos
 * de correção em aberto e levanta a suspensão automática do item 8.4.
 */
export function markDataConfirmed(sellerId: string, how: string): void {
  const at = nowIso();
  db.sellerKyc[sellerId] = { ...sellerKyc(sellerId), dataConfirmedAt: at };
  for (const n of db.notices) {
    if (n.sellerId !== sellerId || n.type !== "AtualizacaoCadastral" || n.status !== "Aberta") continue;
    const line = `${how} em ${new Date(at).toLocaleString("pt-BR", { timeZone: "UTC" })} (UTC).`;
    n.status = "Respondida";
    n.responseText = n.responseText ? `${n.responseText}\n\n${line}` : line;
    n.respondedAt = at;
  }
  for (const m of db.measures)
    if (m.sellerId === sellerId && m.automatic && !m.revokedAt && m.reason === DATA_NOT_UPDATED_REASON)
      revokeMeasure(m, "Dados cadastrais atualizados pelo vendedor.");
}

// ---------------------------------------------------------------------------
// Situação da loja
// ---------------------------------------------------------------------------

export const dataConfirmationDueAt = (sellerId: string) => {
  const k = sellerKyc(sellerId);
  const seller = findSellerById(sellerId);
  return addMonths(k.dataConfirmedAt ?? k.verifiedAt ?? seller?.memberSince ?? nowIso(), 12);
};

export function complianceStatus(sellerId: string): SellerComplianceStatusDto {
  const k = sellerKyc(sellerId);
  const status = sellerStatus(sellerId);
  const open = db.notices.filter((n) => n.sellerId === sellerId && n.status === "Aberta");
  const due = dataConfirmationDueAt(sellerId);
  const missing = missingAdmissionData(sellerId);
  return {
    status,
    suspensionReason: k.suspensionReason,
    suspendedUntil: k.suspendedUntil,
    policyVersion: db.settings.sellerPolicyVersion,
    policyVersionAccepted: k.policyVersionAccepted,
    policyAcceptanceRequired: status !== "Excluido" && k.policyVersionAccepted !== db.settings.sellerPolicyVersion,
    dataConfirmedAt: k.dataConfirmedAt,
    dataConfirmationDueAt: due,
    dataConfirmationDue: new Date(due).getTime() <= Date.now() + 30 * DAY_MS,
    admissionDataComplete: missing.length === 0,
    missingAdmissionData: missing,
    openNotices: open.length,
    overdueNotices: open.filter((n) => n.dueAt && new Date(n.dueAt).getTime() < Date.now()).length,
    infractions12Months: infractionsIn12Months(sellerId).length,
    activeMeasures: db.measures.filter((m) => m.sellerId === sellerId).map(measureDto).filter((m) => m.active),
  };
}

/** Lojas excluídas com RUC, documento do representante, conta, e-mail ou denominação em comum (Política 3.5). */
export function reRegistrationMatches(sellerId: string): string[] {
  const k = sellerKyc(sellerId);
  const self = findSellerById(sellerId);
  const matches: string[] = [];
  for (const other of allSellers()) {
    if (other.id === sellerId || sellerStatus(other.id) !== "Excluido") continue;
    const o = sellerKyc(other.id);
    const common: string[] = [];
    if (self && other.ruc === self.ruc) common.push("RUC");
    if (k.responsibleDocument && k.responsibleDocument === o.responsibleDocument) common.push("documento do representante");
    if (k.payoutAccount && k.payoutAccount === o.payoutAccount) common.push("conta de recebimento");
    if (k.email && k.email.toLowerCase() === o.email?.toLowerCase()) common.push("e-mail");
    if (k.legalName && k.legalName.toLowerCase() === o.legalName?.toLowerCase()) common.push("denominação social");
    if (common.length) matches.push(`${other.name}: ${common.join(", ")}`);
  }
  return matches;
}

/** O mesmo teste para quem tenta se cadastrar (antes de a loja existir). */
export function excludedMatchFor(input: { ruc?: string | null; document?: string | null; payoutAccount?: string | null }): string | null {
  for (const other of allSellers()) {
    if (sellerStatus(other.id) !== "Excluido") continue;
    const o = sellerKyc(other.id);
    if (
      (input.ruc && other.ruc === input.ruc) ||
      (input.document && o.responsibleDocument === input.document) ||
      (input.payoutAccount && o.payoutAccount === input.payoutAccount)
    )
      return other.name;
  }
  return null;
}

export function governanceDto(sellerId: string): SellerGovernanceDto {
  const infractions = db.infractions.filter((i) => i.sellerId === sellerId);
  return {
    notices: db.notices.filter((n) => n.sellerId === sellerId).slice(0, 50).map(noticeDto),
    infractions: infractions.map(({ sellerId: _s, ...rest }) => rest),
    measures: db.measures.filter((m) => m.sellerId === sellerId).map(measureDto),
    acceptances: db.acceptances.filter((a) => a.sellerId === sellerId).map(({ sellerId: _s, ...rest }) => rest),
    audits: db.audits.filter((a) => a.sellerId === sellerId),
    reRegistrationMatches: reRegistrationMatches(sellerId),
    infractions12Months: infractionsIn12Months(sellerId).length,
    recidivist: infractionsIn12Months(sellerId).length > 1,
  };
}

// ---------------------------------------------------------------------------
// Monitoramento (Programa 6; Política 7.3 e 8.4)
// ---------------------------------------------------------------------------

const usdCents = (brlCents: number) => {
  const usd = getRate("USD", "BRL");
  return Math.round((brlCents * usd.denominator) / usd.numerator);
};

/** Programa 6.4: a soma muda a faixa de US$ 50 ou passa de US$ 3.000. */
function isFractioning(values: number[]): boolean {
  if (values.length < 2) return false;
  const total = values.reduce((a, b) => a + b, 0);
  const crossesLow = values.every((v) => v <= 50_00) && total > 50_00;
  const crossesHigh = values.every((v) => v <= 3_000_00) && total > 3_000_00;
  return crossesLow || crossesHigh;
}

export function runMonitor(): MonitoringRunResultDto {
  const result: MonitoringRunResultDto = { newAlerts: 0, listingsFlagged: 0, noticesCreated: 0, sellersSuspended: 0, suspensionsLifted: 0 };
  const nowMs = Date.now();

  // Suspensões temporárias vencidas voltam a vender.
  for (const seller of allSellers()) {
    const k = sellerKyc(seller.id);
    if (sellerStatus(seller.id) === "Suspenso" && k.suspendedUntil && new Date(k.suspendedUntil).getTime() <= nowMs) {
      db.sellerOverrides[seller.id] = { ...db.sellerOverrides[seller.id], status: "Aprovado" };
      db.sellerKyc[seller.id] = { ...k, suspensionReason: null, suspendedUntil: null };
      result.suspensionsLifted++;
    }
  }

  // Política 8.4: dado cadastral não corrigido em 10 dias suspende a loja.
  // Cópia: a suspensão grava a comunicação da medida em db.notices durante o laço.
  for (const notice of [...db.notices]) {
    if (notice.type !== "AtualizacaoCadastral" || notice.status !== "Aberta" || !notice.dueAt) continue;
    if (new Date(notice.dueAt).getTime() >= nowMs) continue;
    notice.status = "Encerrada";
    notice.resolution = "Prazo de 10 dias vencido sem a correção dos dados: loja suspensa (Política 8.4).";
    notice.resolvedAt = nowIso();
    if (sellerStatus(notice.sellerId) !== "Aprovado") continue;
    suspendForDataNotUpdated(notice.sellerId);
    result.sellersSuspended++;
  }

  // Programa 6.4: pedidos do mesmo comprador e endereço em 7 dias cuja soma muda a faixa de tributação.
  const recent = db.orders.filter(
    (o) => nowMs - new Date(o.createdAt).getTime() <= 7 * DAY_MS && !["Cancelado", "AguardandoPagamento"].includes(o.status),
  );
  const groups = new Map<string, OrderDto[]>();
  for (const o of recent) {
    const key = `${o.shippingAddress.postalCode}|${o.shippingAddress.number}`;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  for (const orders of groups.values()) {
    const purchases = new Set(orders.map((o) => o.purchaseId));
    if (purchases.size < 2) continue;
    const values = orders.map((o) => usdCents(o.totals.taxes?.customsValue.amount ?? o.totals.subtotal.amount));
    if (!isFractioning(values)) continue;
    const numbers = orders.map((o) => o.number).sort();
    if (db.alerts.some((a) => a.type === "Fracionamento" && a.orderNumbers.join() === numbers.join())) continue;
    const bySeller = new Map<string, number>();
    for (const o of orders) bySeller.set(o.seller.id, (bySeller.get(o.seller.id) ?? 0) + 1);
    const [sellerId, count] = [...bySeller.entries()].sort((a, b) => b[1] - a[1])[0];
    const seller = findSellerById(sellerId);
    const alert: MonitoringAlertDto = {
      id: crypto.randomUUID(),
      type: "Fracionamento",
      status: "Aberto",
      sellerId: count >= 2 ? sellerId : null,
      sellerName: count >= 2 ? (seller?.name ?? null) : null,
      buyerUserId: db.user.id,
      buyerEmail: db.user.email,
      summary: `${orders.length} pedidos para o mesmo endereço em 7 dias somam ${formatMoney({ amount: values.reduce((a, b) => a + b, 0), currency: "USD" }, { locale: "pt-BR" })} e mudam a faixa de tributação.`,
      orderNumbers: numbers,
      holdsShipments: count >= 2,
      detectedAt: nowIso(),
      attribution: null,
      resolutionNote: null,
      resolvedAt: null,
    };
    db.alerts.unshift(alert);
    logAction("AlertaMonitoramento", alert.summary, alert.holdsShipments ? "Etiquetas retidas até a análise." : "Em análise.", {
      sellerId: alert.sellerId,
      automatic: true,
    });
    result.newAlerts++;
  }
  return result;
}

/** Alerta aberto que retém a etiqueta do pedido (fracionamento da mesma loja). */
export const holdingAlertFor = (orderNumber: string) =>
  db.alerts.find((a) => a.status === "Aberto" && a.holdsShipments && a.orderNumbers.includes(orderNumber)) ?? null;

// ---------------------------------------------------------------------------
// Receita Federal, capacitação, auditoria e painel
// ---------------------------------------------------------------------------

export function rfDto(r: StoredRfInteraction): RfInteractionDto {
  return {
    ...r,
    overdue: r.status === "Pendente" && Boolean(r.dueAt) && new Date(r.dueAt!).getTime() < Date.now(),
    attachments: r.attachments.map(fileRef),
  };
}

export function trainingsDto(): TrainingOverviewDto {
  const people = new Map<string, TrainingStatusDto>();
  const admin = ADMIN_USER;
  people.set(admin.email.toLowerCase(), {
    personName: admin.fullName,
    email: admin.email,
    userId: admin.id,
    role: "Administração",
    lastTrainedAt: null,
    nextDueAt: null,
    due: true,
  });
  const records = [...db.trainings].sort((a, b) => b.trainedAt.localeCompare(a.trainedAt));
  for (const r of [...records].reverse()) {
    const key = (r.personEmail ?? r.personName).toLowerCase();
    const next = addMonths(r.trainedAt, 12);
    people.set(key, {
      personName: r.personName,
      email: r.personEmail,
      userId: r.userId,
      role: r.role,
      lastTrainedAt: r.trainedAt,
      nextDueAt: next,
      due: new Date(next).getTime() <= Date.now(),
    });
  }
  return { people: [...people.values()], records };
}

/** Política 7.4: lojas com infração nos últimos 12 meses e amostra das demais; cada uma recebe o pedido dos registros. */
export function planAudits(year: number): AuditPlanResultDto {
  const sellers = allSellers().filter((s) => ["Aprovado", "Suspenso"].includes(sellerStatus(s.id)));
  const already = new Set(db.audits.filter((a) => a.year === year).map((a) => a.sellerId));
  const withInfractions = sellers.filter((s) => infractionsIn12Months(s.id).length > 0 && !already.has(s.id));
  const others = sellers.filter((s) => !withInfractions.includes(s) && !already.has(s.id));
  const sampleSize = Math.max(1, Math.ceil((others.length * db.settings.auditSamplePercent) / 100));
  const sample = [...others].sort((a, b) => a.id.localeCompare(b.id)).slice(0, sampleSize);
  const planned: SellerAuditDto[] = [];
  for (const [list, reason] of [
    [withInfractions, "Infracao"],
    [sample, "Amostra"],
  ] as const) {
    for (const seller of list) {
      const notice = addNotice({
        sellerId: seller.id,
        type: "SolicitacaoDocumentos",
        documentKind: "Registros",
        title: `Auditoria anual ${year}`,
        message:
          "Envie os registros das suas operações na plataforma (notas de compra, controles de estoque e de envio) para a auditoria anual da Política de Vendedores (itens 4.7, 4.8 e 7.4).",
      });
      const audit: SellerAuditDto = {
        id: crypto.randomUUID(),
        sellerId: seller.id,
        sellerName: seller.name,
        year,
        reason,
        status: "Planejada",
        plannedAt: nowIso(),
        noticeId: notice.id,
        outcome: null,
        findings: null,
        completedAt: null,
      };
      db.audits.push(audit);
      planned.push(audit);
    }
  }
  return { year, withInfractions: withInfractions.length, sample: sample.length, audits: planned };
}

export function programDto(): ComplianceProgramDto {
  const s = db.settings;
  const nowDate = now();
  const year = nowDate.getUTCFullYear();
  const month = nowDate.getUTCMonth() + 1;
  const review = db.rfInteractions.find((r) => r.type === "ConsultaMensal" && r.year === year && r.month === month);
  const cycle = nowDate.getUTCMonth() >= 6 ? year - 1 : year - 2;
  const windowStart = new Date(Date.UTC(year, 9, 1)).toISOString();
  const windowEnd = new Date(Date.UTC(year, 10, 1) - 1).toISOString();
  const windowOpen = nowDate.getTime() >= Date.parse(windowStart) && nowDate.getTime() <= Date.parse(windowEnd);
  const submitted = db.rfInteractions.some((r) => r.type === "ManifestacaoCiclo" && r.year === cycle);
  const nowMs = nowDate.getTime();
  const openReports = db.reports.filter((r) => r.status === "Aberta");
  const overdueReports = openReports.filter((r) => r.dueAt && Date.parse(r.dueAt) < nowMs).length;
  const openAlerts = db.alerts.filter((a) => a.status === "Aberto");
  const pendingRf = db.rfInteractions.filter((r) => r.status === "Pendente");
  const openNotices = db.notices.filter((n) => n.status === "Aberta");
  const answered = db.notices.filter((n) => n.status === "Respondida").length;
  const approved = allSellers().filter((x) => sellerStatus(x.id) === "Aprovado");
  const training = trainingsDto();
  const trainingsDue = training.people.filter((p) => p.due).length;
  const auditsPlanned = db.audits.filter((a) => a.year === year).length;

  const tasks: ProgramTaskDto[] = [];
  const task = (key: string, title: string, detail: string, dueAt: string | null, href: string) =>
    tasks.push({ key, title, detail, dueAt, overdue: Boolean(dueAt) && Date.parse(dueAt!) < nowMs, href });
  if (!s.programOwnerName)
    task("responsavel", "Definir o Responsável pelo Programa", "Nome e e-mail de quem coordena o Programa e fala com a Receita (item 3).", null, "/admin/configuracoes");
  if (!s.complianceProgramApprovedAt || !s.sellerPolicyApprovedAt)
    task("aprovacao", "Registrar a aprovação do Programa e da Política", "Data em que a Diretoria ou o sócio administrador aprovou (Programa 14.1; Política 10.1).", null, "/admin/configuracoes");
  task("empresa", "Configurar razão social e CNPJ/TIN da empresa", "Vão na etiqueta, na declaração e na Política publicada.", null, "/admin/integracoes");
  task("cpf", "Contratar a Consulta CPF (Serpro)", "Em demonstração só o dígito verificador é conferido; em produção o CPF e o nome precisam ser conferidos na Receita (7.2).", null, "/admin/integracoes");
  if (!review)
    task(
      "consulta-mensal",
      `Consulta mensal dos indicadores — ${String(month).padStart(2, "0")}/${year}`,
      "Consultar os indicadores disponibilizados pela Receita e registrar (11.2).",
      new Date(Date.UTC(year, month, 1) - 1).toISOString(),
      "/admin/conformidade/receita",
    );
  if (windowOpen && !submitted)
    task("manifestacao", `Manifestação sobre o ciclo ${cycle}/${cycle + 1}`, "Apresentar de 1º a 31 de outubro (11.8).", windowEnd, "/admin/conformidade/receita");
  for (const r of pendingRf.slice(0, 8)) task(`rf:${r.id}`, r.title, "Pendente.", r.dueAt, "/admin/conformidade/receita");
  if (overdueReports > 0)
    task("denuncias", `${overdueReports} denúncia(s) fora do prazo`, "Decidir em até 2 dias úteis do recebimento (Política 6.5).", new Date(nowMs - 1).toISOString(), "/admin/denuncias");
  if (openAlerts.length > 0)
    task("alertas", `${openAlerts.length} alerta(s) de monitoramento`, "Indícios para julgar.", null, "/admin/conformidade/monitoramento");
  if (answered > 0)
    task("respostas", `${answered} resposta(s) de vendedores`, "Analisar documentos e respostas enviados.", null, "/admin/conformidade/comunicacoes");
  if (trainingsDue > 0)
    task("capacitacao", `${trainingsDue} pessoa(s) com capacitação pendente`, "No início da função e a cada 12 meses (13.1).", null, "/admin/conformidade/capacitacao");
  if (auditsPlanned === 0)
    task("auditoria", `Planejar a auditoria anual de ${year}`, "Vendedores com infração nos últimos 12 meses e amostra dos demais (Política 7.4).", null, "/admin/conformidade/auditorias");

  return {
    ownerName: s.programOwnerName || null,
    ownerEmail: s.programOwnerEmail || null,
    programApprovedAt: s.complianceProgramApprovedAt,
    policyVersion: s.sellerPolicyVersion,
    policyApprovedAt: s.sellerPolicyApprovedAt,
    operationStarted: false,
    // Mock = demonstração: só o dígito verificador do CPF é conferido.
    cpfVerificationActive: true,
    currentMonthReview: {
      year,
      month,
      done: Boolean(review),
      doneAt: review?.completedAt ?? null,
      doneBy: review?.completedBy ?? null,
    },
    manifestation: { cycleStartYear: cycle, windowStart, windowEnd, windowOpen, submitted },
    openReports: openReports.length,
    overdueReports,
    openAlerts: openAlerts.length,
    heldShipments: openAlerts.filter((a) => a.holdsShipments).length,
    pendingRfInteractions: pendingRf.length,
    overdueRfInteractions: pendingRf.filter((r) => r.dueAt && Date.parse(r.dueAt) < nowMs).length,
    openSellerNotices: openNotices.length,
    overdueSellerNotices: openNotices.filter((n) => n.dueAt && Date.parse(n.dueAt) < nowMs).length,
    sellersDataConfirmationDue: approved.filter((x) => Date.parse(dataConfirmationDueAt(x.id)) <= nowMs).length,
    sellersMissingAdmissionData: approved.filter((x) => missingAdmissionData(x.id).length > 0).length,
    sellersPolicyPending: approved.filter((x) => sellerKyc(x.id).policyVersionAccepted !== s.sellerPolicyVersion).length,
    trainingsDue,
    auditsPlanned,
    tasks,
  };
}

/** Prazo da decisão da denúncia: 2 dias úteis do recebimento (Política 6.5). */
export const reportDueAt = (createdAt: string) => addBusinessDays(createdAt, 2);

/** Próximo protocolo de denúncia (DEN-AAAA-NNNNNN). */
export function nextReportProtocol(): string {
  const year = now().getUTCFullYear();
  const prefix = `DEN-${year}-`;
  const last = db.reports
    .map((r) => r.protocol ?? "")
    .filter((p) => p.startsWith(prefix))
    .map((p) => Number(p.slice(prefix.length)))
    .reduce((max, n) => Math.max(max, Number.isFinite(n) ? n : 0), 0);
  return `${prefix}${String(last + 1).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Comprovante do pedido (Programa 10.3) e dossiê (8.8; Política 9.1)
// ---------------------------------------------------------------------------

const brl = (amount: number) => formatMoney({ amount, currency: "BRL" }, { locale: "pt-BR" });

export function receiptPdf(order: OrderDto): Uint8Array {
  const seller = findSellerById(order.seller.id);
  const kyc = sellerKyc(order.seller.id);
  const payment = db.payments.find((p) => p.id === order.payment.id);
  const t = order.totals.taxes;
  const a = order.shippingAddress;
  const lines: TextPdfLine[] = [
    { text: "Mania Paraguai", bold: true, size: 16, gap: 2 },
    { text: `Comprovante do pedido ${order.number}`, bold: true, size: 13, gap: 8 },
    { text: `Data da compra: ${new Date(order.createdAt).toLocaleString("pt-BR")}` },
    { text: `Comprador e destinatário: ${a.recipientName} (CPF ${maskDocument(a.recipientCpf) ?? "-"})` },
    { text: `Entrega: ${a.street}, ${a.number} - ${a.neighborhood} - ${a.city}/${a.state} - CEP ${a.postalCode}`, gap: 6 },
    { text: "Vendedor (remetente)", bold: true },
    { text: `${kyc.legalName ?? seller?.name ?? order.seller.name} - RUC ${seller?.ruc ?? "-"}` },
    { text: `${kyc.legalAddress ?? ""} - ${seller?.city ?? order.seller.city}, Paraguai`, gap: 6 },
    { text: "Mercadorias", bold: true },
    ...order.items.map((item) => {
      const d = productDeclaration(item.productId);
      const ncm = productNcm(item.productId);
      return {
        text: `${item.quantity} x ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ""} - ${brl(item.unitPrice.amount)} = ${brl(item.lineTotal.amount)}${ncm ? ` - NCM ${formatNcm(ncm)}` : ""}${d?.originCountry ? ` - origem ${d.originCountry}` : ""}`,
      };
    }),
    { text: "", gap: 4 },
    { text: "Valores (Programa de Conformidade 4.2)", bold: true },
    { text: `Produtos: ${brl(order.totals.subtotal.amount)}` },
    { text: `Frete: ${brl(order.totals.shipping.amount)}` },
    ...(t
      ? [
          { text: `Seguro: ${brl(t.insurance.amount)} - Outras despesas: ${brl(t.otherExpenses.amount)}` },
          { text: `Desconto: ${brl(t.discount.amount)}` },
          { text: `Valor aduaneiro (declarado): ${brl(t.customsValue.amount)}` },
          { text: `II: ${brl(t.importDuty.amount)} - ICMS: ${brl(t.icms.amount)} - IBS: ${brl(t.ibs.amount)} - CBS: ${brl(t.cbs.amount)}` },
          { text: `Total de tributos: ${brl(t.totalTaxes.amount)}` },
          ...(t.usdRate ? [{ text: `Câmbio: ${t.usdRate.displayRate} (${t.usdRate.source})` }] : []),
        ]
      : [{ text: `Desconto: ${brl(order.totals.discount.amount)}` }, { text: `Tributos estimados: ${brl(order.totals.importTax.amount)}` }]),
    { text: `Total pago: ${brl(order.totals.total.amount)}`, bold: true, gap: 6 },
    { text: "Pagamento", bold: true },
    {
      text: `${order.payment.method} - ${order.payment.status}${payment?.paidAt ? ` em ${new Date(payment.paidAt).toLocaleString("pt-BR")}` : ""} - pagamento ${order.payment.id}`,
      gap: 10,
    },
    { text: "Registro guardado por 5 anos a partir da data do pedido (Programa de Conformidade 10.4).", size: 8 },
    { text: "Documento gerado pelo mock (MSW) para demonstração.", size: 8 },
  ];
  return buildTextPdf(lines);
}

export function dossier(sellerId: string, purpose: string): unknown {
  const seller = findSellerById(sellerId);
  const k = sellerKyc(sellerId);
  return {
    geradoEm: nowIso(),
    finalidade: purpose,
    loja: {
      ...seller,
      status: sellerStatus(sellerId),
      cadastro: { ...k, payoutAccount: k.payoutAccount, responsibleDocument: k.responsibleDocument },
    },
    aceites: db.acceptances.filter((a) => a.sellerId === sellerId),
    pedidos: db.orders.filter((o) => o.seller.id === sellerId).map((o) => ({
      numero: o.number,
      data: o.createdAt,
      status: o.status,
      total: o.totals.total,
      rastreio: o.trackingCode,
      declaracao: o.shipment?.declarationNumber ?? null,
      itens: o.items.map((i) => ({ produto: i.name, quantidade: i.quantity, valor: i.lineTotal })),
    })),
    ocorrencias: db.occurrences.filter((o) => o.sellerId === sellerId),
    infracoes: db.infractions.filter((i) => i.sellerId === sellerId),
    medidas: db.measures.filter((m) => m.sellerId === sellerId),
    comunicacoes: db.notices.filter((n) => n.sellerId === sellerId),
  };
}

// ---------------------------------------------------------------------------
// Denúncias (Política 6.4 e 6.5)
// ---------------------------------------------------------------------------

export interface ReportInput {
  reason: ProductReportReason;
  details?: string | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
  isRightsHolder?: boolean;
  rightsHolderName?: string | null;
  evidenceUrls?: string[] | null;
  website?: string | null;
}

export const REPORT_REASONS: ProductReportReason[] = [
  "Falsificado",
  "PrecoSuspeito",
  "DescricaoIncorreta",
  "ProdutoProibido",
  "Outro",
  "PropriedadeIntelectual",
  "OrigemIlicita",
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mesmas regras de CreateReportAsync: campo isca, detalhes, e-mail, titular, evidências e denúncia repetida. */
export function createReport(
  product: ProductDetailDto,
  body: ReportInput,
  channel: ReportChannel,
  signedIn: boolean,
): ProductReportDto | { errors: Record<string, string[]> } | { conflict: string } {
  if (body.website?.trim()) return { errors: { details: ["Não foi possível registrar a denúncia."] } };
  const details = body.details?.trim() ?? "";
  const email = signedIn ? db.user.email : body.reporterEmail?.trim().toLowerCase() || null;
  const name = signedIn ? db.user.fullName : body.reporterName?.trim() || null;
  const evidence = [...new Set((body.evidenceUrls ?? []).map((e) => e.trim()).filter(Boolean))];
  const minDetails = channel === "CanalPublico" || body.reason === "Outro" ? 10 : 0;
  const errors: Record<string, string[]> = {};
  if (!REPORT_REASONS.includes(body.reason)) errors.reason = ["Escolha o motivo da denúncia."];
  if (details.length > 2000) errors.details = ["Conte em até 2.000 caracteres."];
  else if (details.length < minDetails) errors.details = ["Explique o problema em pelo menos 10 caracteres."];
  if (email && !EMAIL.test(email)) errors.reporterEmail = ["E-mail inválido."];
  if (name && name.length > 160) errors.reporterName = ["Nome muito longo."];
  if (body.isRightsHolder && !body.rightsHolderName?.trim())
    errors.rightsHolderName = ["Informe o titular do direito (marca ou obra)."];
  if (evidence.length > 10) errors.evidenceUrls = ["Máximo de 10 links."];
  else if (evidence.some((e) => e.length > 1024 || !e.toLowerCase().startsWith("http")))
    errors.evidenceUrls = ["Use links completos (https://…)."];
  if (Object.keys(errors).length) return { errors };
  if (email && db.reports.some((r) => r.productId === product.id && r.reporterEmail === email && r.status === "Aberta"))
    return { conflict: "Você já denunciou este produto. A equipe está analisando." };

  const createdAt = nowIso();
  const report: ProductReportDto = {
    id: crypto.randomUUID(),
    productId: product.id,
    productName: product.name,
    productSlug: product.slug,
    productStatus: db.productOverrides[product.id]?.status ?? "Ativo",
    sellerId: product.seller.id,
    sellerName: product.seller.name,
    reason: body.reason,
    details,
    status: "Aberta",
    createdAt,
    reporterEmail: email,
    resolvedAt: null,
    resolutionNote: null,
    occurrenceId: null,
    protocol: nextReportProtocol(),
    channel,
    reporterName: name,
    isRightsHolder: Boolean(body.isRightsHolder),
    rightsHolderName: body.isRightsHolder ? body.rightsHolderName?.trim() || null : null,
    evidenceUrls: evidence,
    dueAt: reportDueAt(createdAt),
    overdue: false,
  };
  db.reports.unshift(report);
  logAction(
    "DenunciaRecebida",
    `${body.reason}: ${details}`,
    `Protocolo ${report.protocol}; decisão até ${new Date(report.dueAt!).toLocaleDateString("pt-BR")}.`,
    { sellerId: product.seller.id, productId: product.id, reportId: report.id, automatic: true },
  );
  return report;
}

/** Denúncia com o prazo vencido calculado na leitura. */
export const withOverdue = (report: ProductReportDto): ProductReportDto => ({
  ...report,
  overdue: report.status === "Aberta" && Boolean(report.dueAt) && Date.parse(report.dueAt!) < Date.now(),
});

/** Contestação de indicador (Programa 11.6 e 11.7): as ocorrências seguem contando até a decisão da Receita. */
export function contest(body: ContestationRequest, adminEmail: string): StoredRfInteraction | { errors: Record<string, string[]> } {
  const grounds = body.grounds?.trim() ?? "";
  const ids = [...new Set(body.occurrenceIds ?? [])];
  const errors: Record<string, string[]> = {};
  if (ids.length === 0) errors.occurrenceIds = ["Escolha as remessas contestadas."];
  if (grounds.length < 20) errors.grounds = ["Fundamente a contestação (mínimo 20 caracteres)."];
  if (grounds.length > 2000) errors.grounds = ["Máximo de 2.000 caracteres."];
  if (Object.keys(errors).length) return { errors };
  const occurrences = db.occurrences.filter((o) => ids.includes(o.id));
  if (occurrences.length !== ids.length) return { errors: { occurrenceIds: ["Ocorrência não encontrada."] } };
  if (occurrences.some((o) => o.indicator !== body.indicator))
    return { errors: { occurrenceIds: ["Todas as remessas contestadas precisam ser do indicador escolhido."] } };
  if (occurrences.some((o) => o.status !== "Confirmada"))
    return { errors: { occurrenceIds: ["Só ocorrências confirmadas podem ser contestadas."] } };
  const reasonText = {
    ErroMaterial: "erro material",
    InconsistenciaSistemica: "inconsistência sistêmica",
    ImpropriedadeMetodologia: "impropriedade na aplicação da metodologia de cálculo",
  }[body.reason];
  const at = nowIso();
  const files = storedFiles(body.evidence);
  const rf: StoredRfInteraction = {
    id: crypto.randomUUID(),
    type: "Contestacao",
    status: "Pendente",
    title: `Contestação do indicador ${body.indicator} (${occurrences.length} remessa(s))`,
    description: `Fundamento: ${reasonText}.\n\n${grounds}`,
    reference: body.reference?.trim() || null,
    openedAt: at,
    dueAt: null,
    indicator: body.indicator,
    contestationReason: body.reason,
    occurrenceIds: ids,
    year: null,
    month: null,
    officialCounterfeitPermyriad: null,
    officialUndervaluationPermyriad: null,
    officialDeclarationQualityPermyriad: null,
    response: null,
    attachments: files,
    completedAt: null,
    completedBy: null,
    createdAt: at,
    createdBy: adminEmail,
  };
  db.rfInteractions.unshift(rf);
  for (const o of occurrences) {
    o.status = "Contestada";
    o.contestationReason = body.reason;
    o.contestationGrounds = grounds;
    o.contestedAt = at;
    o.rfInteractionId = rf.id;
    o.statusReason = `Contestada por ${reasonText}.`;
  }
  return rf;
}

export { SELLER_VERIFICATION_ITEMS };
