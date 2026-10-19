import type {
  AuditCompleteRequest,
  AuditPlanRequest,
  ComplianceTrainingInput,
  ContestationRequest,
  DocumentUploadRequest,
  MonitoringAlertResolveRequest,
  PresignedUploadDto,
  PublicReportRequest,
  ReportReceiptDto,
  RevokeMeasureRequest,
  RfInteractionCompleteRequest,
  RfInteractionInput,
  SellerInfractionInput,
  SellerMeasureInput,
  SellerNoticeCreateRequest,
  SellerNoticeResolveRequest,
  SellerNoticeResponseRequest,
  SellerPolicyAcceptRequest,
  SellerPolicyInfoDto,
} from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { findProduct, findSellerById, missingAdmissionData, productStatus, sellerKyc, sellerStatus } from "../catalog-state";
import { db, persistDb, type StoredRfInteraction } from "../db";
import { addBusinessDays } from "../fixtures/compliance";
import { ANNEX_ITEMS } from "../fixtures/remessa";
import {
  addInfraction,
  addNotice,
  applyMeasure,
  complianceStatus,
  contest,
  createReport,
  dossier,
  infractionsIn12Months,
  logAction,
  markDataConfirmed,
  noticeDto,
  planAudits,
  programDto,
  receiptPdf,
  recommendMeasure,
  revokeMeasure,
  rfDto,
  runMonitor,
  storedFiles,
  suspendForDataNotUpdated,
  trainingsDto,
} from "../governance";
import { audit, isResponse, requireAdmin, requireSeller } from "./guards";
import { toProfile } from "./seller-panel";
import { API, isAuthorized, notFound, nowIso, num, paginate, problem, simulateLatency, validation } from "./utils";

/**
 * Programa de Conformidade e Política de Vendedores no mock: Política publicada, canal público de denúncias,
 * documentos privados, situação e comunicações da loja, e o painel do Programa no admin (mesmas rotas da API).
 */

const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
/** Orçamento dos documentos guardados em base64 no localStorage do mock. */
const DOCUMENT_BUDGET_BYTES = 1.5 * 1024 * 1024;
const DAY_MS = 86_400_000;

const pdf = (bytes: Uint8Array, fileName: string) =>
  new HttpResponse(bytes, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}"` },
  });

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Documentos mais antigos saem primeiro quando o localStorage aperta. */
function trimDocuments(): void {
  const docs = Object.entries(db.uploads)
    .filter(([key]) => key.startsWith("doc/"))
    .sort(([, a], [, b]) => a.createdAt.localeCompare(b.createdAt));
  let total = docs.reduce((acc, [, u]) => acc + u.base64.length, 0);
  for (const [key, upload] of docs) {
    if (total <= DOCUMENT_BUDGET_BYTES) break;
    total -= upload.base64.length;
    delete db.uploads[key];
  }
}

function createDocumentUpload(body: DocumentUploadRequest): PresignedUploadDto | Response {
  if (!body.fileName?.trim()) return validation({ fileName: ["Informe o nome do arquivo."] });
  if (!DOCUMENT_TYPES.includes(body.contentType ?? "")) return validation({ contentType: ["Envie PDF, JPEG, PNG ou WebP."] });
  if (!body.sizeBytes || body.sizeBytes <= 0 || body.sizeBytes > MAX_DOCUMENT_BYTES)
    return validation({ sizeBytes: ["Tamanho máximo: 10 MB."] });
  const ext = body.contentType === "application/pdf" ? "pdf" : body.contentType.split("/")[1].replace("jpeg", "jpg");
  const d = new Date();
  const key = `doc/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
  // Registra o nome original antes do envio (o PUT só traz os bytes).
  db.uploads[key] = { contentType: body.contentType, base64: "", createdAt: nowIso(), fileName: body.fileName.trim() };
  return {
    uploadUrl: `/api/documents/${key}?token=mock`,
    publicUrl: `/api/documents/${key}?t=mock`,
    storageKey: key,
    headers: { "Content-Type": body.contentType },
  };
}

const sellerNotice = (sellerId: string, id: string) => db.notices.find((n) => n.id === id && n.sellerId === sellerId);

export const governanceHandlers = [
  // ----- Público -----
  http.get(`${API}/policies/seller`, async () => {
    await simulateLatency();
    const body: SellerPolicyInfoDto = {
      version: db.settings.sellerPolicyVersion,
      approvedAt: db.settings.sellerPolicyApprovedAt,
      brand: "Mania Paraguai",
      // No mock a identidade da empresa não está configurada: o texto mostra o aviso de pendência.
      companyLegalName: null,
      companyDocumentType: null,
      companyDocument: null,
      companyAddress: null,
      platformUrl: typeof window === "undefined" ? "https://maniaparaguai.com.br" : window.location.origin,
      annex: ANNEX_ITEMS,
    };
    return HttpResponse.json(body);
  }),

  http.post(`${API}/reports`, async ({ request }) => {
    await simulateLatency();
    const body = (await request.json()) as PublicReportRequest;
    const reference = body.product?.trim() ?? "";
    if (!reference) return validation({ product: ["Informe o link do anúncio denunciado."] });
    const marker = reference.toLowerCase().indexOf("/produto/");
    const slug = (marker >= 0 ? reference.slice(marker + "/produto/".length) : reference).split(/[?#]/)[0].replace(/^\/+|\/+$/g, "").toLowerCase();
    const product = findProduct(slug) ?? findProduct(reference);
    if (!product) return validation({ product: ["Anúncio não encontrado. Confira o link."] });
    const result = createReport(product, body, "CanalPublico", isAuthorized(request));
    if ("errors" in result) return validation(result.errors);
    if ("conflict" in result) return problem(409, "REPORT_ALREADY_OPEN", result.conflict);
    audit("product.report", product.slug);
    persistDb();
    const receipt: ReportReceiptDto = {
      id: result.id,
      protocol: result.protocol!,
      dueAt: result.dueAt!,
      productId: product.id,
      productName: product.name,
    };
    return HttpResponse.json(receipt, { status: 201 });
  }),

  // ----- Documentos privados -----
  http.post(`${API}/seller/documents/uploads`, async ({ request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return problem(401, "UNAUTHORIZED", "Sessão inválida ou expirada.");
    const result = createDocumentUpload((await request.json()) as DocumentUploadRequest);
    if (isResponse(result)) return result;
    persistDb();
    return HttpResponse.json(result, { status: 201 });
  }),

  http.post(`${API}/admin/documents/uploads`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const result = createDocumentUpload((await request.json()) as DocumentUploadRequest);
    if (isResponse(result)) return result;
    persistDb();
    return HttpResponse.json(result, { status: 201 });
  }),

  http.put(`${API}/documents/*`, async ({ request }) => {
    const key = decodeURIComponent(new URL(request.url).pathname.split("/documents/")[1] ?? "");
    const pending = db.uploads[key];
    if (!pending) return problem(401, "UNAUTHORIZED", "Token de upload inválido ou expirado.");
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) return validation({ sizeBytes: ["Arquivo maior que o declarado."] });
    db.uploads[key] = { ...pending, base64: base64FromBytes(bytes), createdAt: nowIso() };
    trimDocuments();
    persistDb();
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${API}/documents/*`, async ({ request }) => {
    const key = decodeURIComponent(new URL(request.url).pathname.split("/documents/")[1] ?? "");
    const upload = db.uploads[key];
    if (!upload?.base64) return notFound("Documento");
    return new HttpResponse(bytesFromBase64(upload.base64), {
      headers: {
        "Content-Type": upload.contentType,
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="${upload.fileName ?? key.split("/").pop()}"`,
      },
    });
  }),

  // ----- Vendedor: situação, aceite e comunicações -----
  http.get(`${API}/seller/compliance`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    return HttpResponse.json(complianceStatus(seller.id));
  }),

  http.post(`${API}/seller/profile/confirm`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const missing = missingAdmissionData(seller.id);
    if (missing.length) return validation({ profile: [`Complete o cadastro antes de confirmar: ${missing.join(", ")}.`] });
    markDataConfirmed(seller.id, "Dados confirmados pelo vendedor");
    audit("seller.profile.confirm", seller.slug);
    persistDb();
    return HttpResponse.json(toProfile(seller));
  }),

  http.post(`${API}/seller/policy/accept`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const body = (await request.json()) as SellerPolicyAcceptRequest;
    const name = body.representativeName?.trim() ?? "";
    const errors: Record<string, string[]> = {};
    if (!body.accept) errors.accept = ["Marque que leu e aceita a Política."];
    if (name.length < 5) errors.representativeName = ["Informe o nome do representante legal que aceita."];
    if (Object.keys(errors).length) return validation(errors);
    const kyc = sellerKyc(seller.id);
    const at = nowIso();
    db.sellerKyc[seller.id] = { ...kyc, policyVersionAccepted: db.settings.sellerPolicyVersion, policyAcceptedAt: at };
    db.acceptances.unshift({
      sellerId: seller.id,
      policyVersion: db.settings.sellerPolicyVersion,
      acceptedAt: at,
      representativeName: name,
      representativeDocumentMasked: null,
      ipAddress: "181.120.44.9",
    });
    // A comunicação da alteração da Política se encerra com o aceite.
    for (const n of db.notices)
      if (n.sellerId === seller.id && n.type === "AlteracaoPolitica" && n.status !== "Encerrada") {
        n.status = "Encerrada";
        n.resolution = `Versão ${db.settings.sellerPolicyVersion} aceita por ${name}.`;
        n.resolvedAt = at;
      }
    audit("seller.policy.accept", seller.slug);
    persistDb();
    return HttpResponse.json(toProfile(seller));
  }),

  http.get(`${API}/seller/notices`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const items = db.notices
      .filter((n) => n.sellerId === seller.id && (!status || n.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(noticeDto);
    return HttpResponse.json(paginate(items, num(url.searchParams.get("page"), 1)!, num(url.searchParams.get("pageSize"), 20)!));
  }),

  http.get(`${API}/seller/notices/:id`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const notice = sellerNotice(seller.id, String(params.id));
    if (!notice) return notFound("Comunicação");
    if (!notice.readAt) {
      notice.readAt = nowIso();
      persistDb();
    }
    return HttpResponse.json(noticeDto(notice));
  }),

  http.post(`${API}/seller/notices/:id/respond`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const notice = sellerNotice(seller.id, String(params.id));
    if (!notice) return notFound("Comunicação");
    if (notice.status === "Encerrada") return problem(409, "NOTICE_CLOSED", "Comunicação já encerrada.");
    if (notice.type === "Aviso" || notice.type === "AlteracaoPolitica")
      return problem(409, "NOTICE_NO_RESPONSE", "Esta comunicação não pede resposta.");
    const body = (await request.json()) as SellerNoticeResponseRequest;
    const text = body.text?.trim() ?? "";
    const files = storedFiles(body.files);
    const errors: Record<string, string[]> = {};
    if (text.length < 10) errors.text = ["Explique a resposta em pelo menos 10 caracteres."];
    if (text.length > 4000) errors.text = ["Máximo de 4.000 caracteres."];
    if (files.length > 10) errors.files = ["Máximo de 10 arquivos."];
    if (notice.type === "SolicitacaoDocumentos" && files.length === 0 && notice.responseFiles.length === 0)
      errors.files = ["Envie os documentos pedidos."];
    if (Object.keys(errors).length) return validation(errors);
    notice.responseText = notice.responseText ? `${notice.responseText}\n\n${text}` : text;
    notice.responseFiles = [...notice.responseFiles, ...files];
    notice.respondedAt = nowIso();
    // Política 8.4: o pedido de correção só se encerra com os dados corrigidos ou confirmados em Configurações.
    if (notice.type !== "AtualizacaoCadastral") notice.status = "Respondida";
    audit("seller.notice.respond", notice.id);
    persistDb();
    return HttpResponse.json(noticeDto(notice));
  }),

  http.get(`${API}/seller/orders/:id/receipt`, async ({ request, params }) => {
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const order = db.orders.find((o) => o.id === params.id && o.seller.id === seller.id);
    if (!order) return notFound("Pedido");
    if (order.payment.status !== "Aprovado" && order.payment.status !== "Estornado")
      return notFound("Comprovante (o pagamento ainda não foi aprovado)");
    return pdf(receiptPdf(order), `comprovante-${order.number}.pdf`);
  }),

  // ----- Comprador e admin: comprovante -----
  http.get(`${API}/orders/:id/receipt`, async ({ request, params }) => {
    if (!isAuthorized(request)) return problem(401, "UNAUTHORIZED", "Sessão inválida ou expirada.");
    const order = db.orders.find((o) => o.id === params.id || o.number === params.id);
    if (!order) return notFound("Pedido");
    if (order.payment.status !== "Aprovado" && order.payment.status !== "Estornado")
      return notFound("Comprovante (o pagamento ainda não foi aprovado)");
    return pdf(receiptPdf(order), `comprovante-${order.number}.pdf`);
  }),

  http.get(`${API}/admin/orders/:id/receipt`, async ({ request, params }) => {
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const order = db.orders.find((o) => o.id === params.id || o.number === params.id);
    if (!order) return notFound("Pedido");
    if (order.payment.status !== "Aprovado" && order.payment.status !== "Estornado")
      return notFound("Comprovante (o pagamento ainda não foi aprovado)");
    return pdf(receiptPdf(order), `comprovante-${order.number}.pdf`);
  }),

  // ----- Admin: painel do Programa -----
  http.get(`${API}/admin/compliance/program`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    return HttpResponse.json(programDto());
  }),

  http.post(`${API}/admin/compliance/monitor/run`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const result = runMonitor();
    audit("admin.monitor.run", null);
    persistDb();
    return HttpResponse.json(result);
  }),

  http.get(`${API}/admin/compliance/alerts`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const items = db.alerts
      .filter((a) => (!status || a.status === status) && (!type || a.type === type))
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
    return HttpResponse.json(paginate(items, num(url.searchParams.get("page"), 1)!, num(url.searchParams.get("pageSize"), 20)!));
  }),

  http.post(`${API}/admin/compliance/alerts/:id/resolve`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const alert = db.alerts.find((a) => a.id === params.id);
    if (!alert) return notFound("Alerta");
    if (alert.status !== "Aberto") return problem(409, "ALERT_RESOLVED", "Este alerta já foi julgado.");
    const body = (await request.json()) as MonitoringAlertResolveRequest;
    if (body.upheld && !body.attribution) return validation({ attribution: ["Informe a quem o indício é atribuído."] });
    alert.status = body.upheld ? "Procedente" : "Improcedente";
    alert.attribution = body.upheld ? (body.attribution ?? null) : null;
    alert.resolutionNote = body.note?.trim() || null;
    alert.resolvedAt = nowIso();
    if (body.upheld && body.attribution === "Vendedor" && body.registerInfraction && alert.sellerId)
      addInfraction(alert.sellerId, {
        code:
          alert.type === "Fracionamento"
            ? "FRACIONAMENTO"
            : alert.type === "OcorrenciasReceita"
              ? "OCORRENCIAS_RECEITA"
              : "MONITORAMENTO",
        description: alert.resolutionNote ?? alert.summary,
        severity: body.severity ?? "Media",
        intentional: false,
      });
    logAction("AlertaMonitoramento", alert.summary, body.upheld ? `Procedente (${body.attribution}).` : "Improcedente; etiquetas liberadas.", {
      sellerId: alert.sellerId,
    });
    audit("admin.alert.resolve", alert.id);
    persistDb();
    return HttpResponse.json(alert);
  }),

  // ----- Admin: Receita Federal -----
  http.get(`${API}/admin/compliance/rf`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const items = db.rfInteractions
      .filter((r) => (!type || r.type === type) && (!status || r.status === status))
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
      .map(rfDto);
    return HttpResponse.json(paginate(items, num(url.searchParams.get("page"), 1)!, num(url.searchParams.get("pageSize"), 20)!));
  }),

  http.post(`${API}/admin/compliance/rf`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const input = (await request.json()) as RfInteractionInput;
    if (input.type === "Contestacao")
      return validation({ type: ["Contestação é registrada a partir das ocorrências (indicador, remessas e fundamento)."] });
    const description = input.description?.trim() ?? "";
    const openedAt = input.openedAt ?? nowIso();
    const errors: Record<string, string[]> = {};
    if (Date.parse(openedAt) > Date.now() + DAY_MS) errors.openedAt = ["A data não pode estar no futuro."];
    const official = [input.officialCounterfeitPermyriad, input.officialUndervaluationPermyriad, input.officialDeclarationQualityPermyriad];
    if (official.some((v) => v != null && (v < 0 || v > 10_000))) errors.official = ["Indicador entre 0% e 100%."];
    const rf: StoredRfInteraction = {
      id: crypto.randomUUID(),
      type: input.type,
      status: "Pendente",
      title: "",
      description,
      reference: input.reference?.trim() || null,
      openedAt,
      dueAt: null,
      indicator: input.indicator ?? null,
      contestationReason: null,
      occurrenceIds: [],
      year: null,
      month: null,
      officialCounterfeitPermyriad: null,
      officialUndervaluationPermyriad: null,
      officialDeclarationQualityPermyriad: null,
      response: null,
      attachments: storedFiles(input.attachments),
      completedAt: null,
      completedBy: null,
      createdAt: nowIso(),
      createdBy: admin.email,
    };
    const opened = new Date(openedAt);
    switch (input.type) {
      case "ConsultaMensal": {
        const year = input.year ?? opened.getUTCFullYear();
        const month = input.month ?? opened.getUTCMonth() + 1;
        if (month < 1 || month > 12) errors.month = ["Mês inválido."];
        if (db.rfInteractions.some((r) => r.type === "ConsultaMensal" && r.year === year && r.month === month))
          errors.month = ["A consulta deste mês já foi registrada."];
        Object.assign(rf, {
          year,
          month,
          title: `Consulta mensal dos indicadores — ${String(month).padStart(2, "0")}/${year}`,
          officialCounterfeitPermyriad: input.officialCounterfeitPermyriad ?? null,
          officialUndervaluationPermyriad: input.officialUndervaluationPermyriad ?? null,
          officialDeclarationQualityPermyriad: input.officialDeclarationQualityPermyriad ?? null,
          status: "Concluida",
          completedAt: nowIso(),
          completedBy: admin.email,
        });
        break;
      }
      case "PlanoDeAcao":
        if (!input.indicator) errors.indicator = ["Informe o indicador do plano de ação."];
        rf.title = `Plano de ação corretivo${input.indicator ? ` — ${input.indicator}` : ""}`;
        rf.dueAt = new Date(opened.getTime() + 30 * DAY_MS).toISOString();
        break;
      case "NotificacaoCorretiva":
        if (description.length < 10) errors.description = ["Descreva as inconformidades apontadas na notificação."];
        rf.title = "Notificação para adotar medidas corretivas";
        rf.dueAt = new Date(opened.getTime() + 30 * DAY_MS).toISOString();
        break;
      case "Ouvidoria":
        if (description.length < 10) errors.description = ["Resuma a reclamação recebida."];
        rf.title = "Reclamação da ouvidoria da Receita Federal";
        rf.dueAt = input.dueAt ?? addBusinessDays(openedAt, 5);
        break;
      case "ManifestacaoCiclo": {
        const year = opened.getUTCFullYear();
        const start = Date.UTC(year, 9, 1);
        const end = Date.UTC(year, 10, 1);
        if (opened.getTime() < start || opened.getTime() >= end)
          errors.openedAt = ["A manifestação sobre o ciclo anual é apresentada de 1º a 31 de outubro (Programa 11.8)."];
        const cycle = input.year ?? (opened.getUTCMonth() >= 6 ? year - 1 : year - 2);
        rf.year = cycle;
        rf.title = `Manifestação sobre o ciclo ${cycle}/${cycle + 1}`;
        rf.dueAt = new Date(end - 1).toISOString();
        break;
      }
      case "ComunicacaoDeFato":
        if (description.length < 10) errors.description = ["Descreva o fato comunicado à Receita."];
        Object.assign(rf, {
          title: "Comunicação de fato que compromete o cumprimento do PRC",
          status: "Concluida",
          completedAt: nowIso(),
          completedBy: admin.email,
        });
        break;
      default:
        if (!input.title?.trim()) errors.title = ["Informe o assunto."];
        rf.dueAt = input.dueAt ?? null;
    }
    if (input.title?.trim()) rf.title = input.title.trim().slice(0, 200);
    if (Object.keys(errors).length) return validation(errors);
    db.rfInteractions.unshift(rf);
    audit("admin.rf.create", rf.type);
    persistDb();
    return HttpResponse.json(rfDto(rf), { status: 201 });
  }),

  http.post(`${API}/admin/compliance/rf/:id/complete`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const rf = db.rfInteractions.find((r) => r.id === params.id);
    if (!rf) return notFound("Registro");
    if (rf.status === "Concluida") return problem(409, "RF_DONE", "Este registro já foi concluído.");
    const body = (await request.json()) as RfInteractionCompleteRequest;
    const response = body.response?.trim() ?? "";
    const errors: Record<string, string[]> = {};
    if (response.length < 5) errors.response = ["Registre o que foi feito ou respondido."];
    if (rf.type === "Contestacao" && body.contestationAccepted == null)
      errors.contestationAccepted = ["Informe se a Receita acolheu a contestação."];
    if (Object.keys(errors).length) return validation(errors);
    rf.response = response;
    rf.attachments = [...rf.attachments, ...storedFiles(body.attachments)];
    rf.status = "Concluida";
    rf.completedAt = nowIso();
    rf.completedBy = admin.email;
    if (rf.type === "Contestacao") {
      const accepted = body.contestationAccepted === true;
      for (const o of db.occurrences.filter((x) => rf.occurrenceIds.includes(x.id))) {
        o.status = accepted ? "Anulada" : "Confirmada";
        o.statusReason = (accepted ? `Contestação acolhida pela Receita: ${response}` : `Contestação não acolhida: ${response}`).slice(0, 500);
      }
    }
    audit("admin.rf.complete", rf.id);
    persistDb();
    return HttpResponse.json(rfDto(rf));
  }),

  http.post(`${API}/admin/compliance/contestations`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const body = (await request.json()) as ContestationRequest;
    const result = contest(body, admin.email);
    if ("errors" in result) return validation(result.errors);
    audit("admin.rf.contest", result.id);
    persistDb();
    return HttpResponse.json(rfDto(result), { status: 201 });
  }),

  // ----- Admin: capacitação, ações e auditorias -----
  http.get(`${API}/admin/compliance/trainings`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    return HttpResponse.json(trainingsDto());
  }),

  http.post(`${API}/admin/compliance/trainings`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const input = (await request.json()) as ComplianceTrainingInput;
    const errors: Record<string, string[]> = {};
    if ((input.personName?.trim().length ?? 0) < 3) errors.personName = ["Informe o nome de quem foi capacitado."];
    if ((input.role?.trim().length ?? 0) < 2) errors.role = ["Informe a função."];
    if ((input.topic?.trim().length ?? 0) < 3) errors.topic = ["Informe o tema da capacitação."];
    if (input.trainedAt && Date.parse(input.trainedAt) > Date.now() + DAY_MS) errors.trainedAt = ["A data não pode estar no futuro."];
    if (Object.keys(errors).length) return validation(errors);
    db.trainings.unshift({
      id: crypto.randomUUID(),
      personName: input.personName.trim(),
      personEmail: input.personEmail?.trim().toLowerCase() || null,
      userId: input.userId ?? null,
      role: input.role.trim(),
      topic: input.topic.trim(),
      initial: input.initial,
      trainedAt: input.trainedAt ?? nowIso(),
      notes: input.notes?.trim() || null,
    });
    audit("admin.training.create", input.personName);
    persistDb();
    return HttpResponse.json(trainingsDto());
  }),

  http.get(`${API}/admin/compliance/actions`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const sellerId = url.searchParams.get("sellerId");
    const items = db.actions
      .filter((a) => (!kind || a.kind === kind) && (!sellerId || a.sellerId === sellerId))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return HttpResponse.json(paginate(items, num(url.searchParams.get("page"), 1)!, num(url.searchParams.get("pageSize"), 30)!));
  }),

  http.get(`${API}/admin/compliance/audits`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const year = num(new URL(request.url).searchParams.get("year"));
    return HttpResponse.json(db.audits.filter((a) => !year || a.year === year).sort((a, b) => b.plannedAt.localeCompare(a.plannedAt)));
  }),

  http.post(`${API}/admin/compliance/audits/plan`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const body = (await request.json()) as AuditPlanRequest;
    const result = planAudits(body.year ?? new Date().getUTCFullYear());
    audit("admin.audit.plan", String(result.year));
    persistDb();
    return HttpResponse.json(result);
  }),

  http.post(`${API}/admin/compliance/audits/:id/complete`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const item = db.audits.find((a) => a.id === params.id);
    if (!item) return notFound("Auditoria");
    if (item.status === "Concluida") return problem(409, "AUDIT_DONE", "Auditoria já concluída.");
    const body = (await request.json()) as AuditCompleteRequest;
    const findings = body.findings?.trim() ?? "";
    if (findings.length < 10) return validation({ findings: ["Registre as constatações (mínimo 10 caracteres)."] });
    item.status = "Concluida";
    item.outcome = body.outcome;
    item.findings = findings;
    item.completedAt = nowIso();
    if (body.outcome === "NaoConforme")
      addInfraction(item.sellerId, { code: "AUDITORIA", description: findings, severity: "Media", intentional: false });
    audit("admin.audit.complete", item.id);
    persistDb();
    return HttpResponse.json(item);
  }),

  // ----- Admin: comunicações, infrações, medidas e dossiê -----
  http.get(`${API}/admin/compliance/notices`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const sellerId = url.searchParams.get("sellerId");
    const items = db.notices
      .filter((n) => (!status || n.status === status) && (!type || n.type === type) && (!sellerId || n.sellerId === sellerId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(noticeDto);
    return HttpResponse.json(paginate(items, num(url.searchParams.get("page"), 1)!, num(url.searchParams.get("pageSize"), 20)!));
  }),

  http.post(`${API}/admin/notices/:id/resolve`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const notice = db.notices.find((n) => n.id === params.id);
    if (!notice) return notFound("Comunicação");
    if (notice.status === "Encerrada") return problem(409, "NOTICE_CLOSED", "Comunicação já encerrada.");
    const body = (await request.json()) as SellerNoticeResolveRequest;
    const resolution = body.resolution?.trim() ?? "";
    if (resolution.length < 5) return validation({ resolution: ["Registre a conclusão (o vendedor vê este texto)."] });
    notice.status = "Encerrada";
    notice.resolution = resolution.slice(0, 1000);
    notice.resolvedAt = nowIso();
    if (notice.documentKind === "Autenticidade" && notice.productId) {
      if (body.accepted) {
        if (productStatus(notice.productId) === "EmAnalise")
          db.productOverrides[notice.productId] = {
            ...db.productOverrides[notice.productId],
            status: "Ativo",
            moderationReason: null,
            moderationNote: null,
            updatedAt: nowIso(),
          };
        logAction("AutenticidadeComprovada", resolution, "Anúncio mantido.", { sellerId: notice.sellerId, productId: notice.productId });
      } else {
        logAction("AutenticidadeNaoComprovada", resolution, "Anúncio removido.", { sellerId: notice.sellerId, productId: notice.productId });
        applyMeasure(notice.sellerId, { type: "RemocaoAnuncio", reason: resolution, productId: notice.productId }, false, "CONTRAFACAO");
      }
    }
    // Correção cadastral recusada (Política 8.4): vencido o prazo original, a loja é suspensa; senão, novo pedido com o
    // mesmo prazo.
    if (notice.type === "AtualizacaoCadastral" && !body.accepted && notice.dueAt) {
      if (new Date(notice.dueAt).getTime() <= Date.now()) {
        if (sellerStatus(notice.sellerId) === "Aprovado") suspendForDataNotUpdated(notice.sellerId);
        notice.resolution = `${notice.resolution}\n\nPrazo de 10 dias vencido sem a correção: loja suspensa (Política 8.4).`;
      } else {
        const reissued = addNotice({
          sellerId: notice.sellerId,
          type: "AtualizacaoCadastral",
          title: notice.title,
          message:
            `A correção enviada não foi aceita. Motivo: ${resolution}\n\n${notice.message}\n\nO prazo continua o da solicitação original. ` +
            "Sem a correção, a loja é suspensa (Política de Vendedores, item 8.4).",
        });
        reissued.dueAt = notice.dueAt;
      }
    }
    audit("admin.notice.resolve", notice.id);
    persistDb();
    return HttpResponse.json(noticeDto(notice));
  }),

  http.post(`${API}/admin/sellers/:id/notices`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const seller = findSellerById(String(params.id));
    if (!seller) return notFound("Loja");
    const body = (await request.json()) as SellerNoticeCreateRequest;
    const message = body.message?.trim() ?? "";
    const errors: Record<string, string[]> = {};
    if (body.type === "Medida" || body.type === "AlteracaoPolitica") errors.type = ["Medidas e mudanças da Política têm fluxo próprio."];
    if (message.length < 10) errors.message = ["Escreva a comunicação (mínimo 10 caracteres)."];
    if (body.type === "SolicitacaoDocumentos" && !body.documentKind) errors.documentKind = ["Escolha o que os documentos devem comprovar."];
    const order = body.orderNumber?.trim() ? db.orders.find((o) => o.number === body.orderNumber!.trim().toUpperCase()) : null;
    if (body.orderNumber?.trim() && !order) errors.orderNumber = ["Pedido não encontrado."];
    if (Object.keys(errors).length) return validation(errors);
    const notice = addNotice({
      sellerId: seller.id,
      type: body.type,
      documentKind: body.documentKind,
      productId: body.productId,
      order,
      title: body.title,
      message,
    });
    if (body.type === "SolicitacaoDocumentos" && body.documentKind === "Autenticidade" && body.productId)
      logAction("AutenticidadeSolicitada", message, "Prazo de 10 dias para comprovar.", { sellerId: seller.id, productId: body.productId });
    audit("admin.notice.create", seller.slug);
    persistDb();
    return HttpResponse.json(noticeDto(notice), { status: 201 });
  }),

  http.post(`${API}/admin/sellers/:id/infractions`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const seller = findSellerById(String(params.id));
    if (!seller) return notFound("Loja");
    const input = (await request.json()) as SellerInfractionInput;
    const code = (input.code ?? "").trim().toUpperCase().replace(/ /g, "_");
    const description = input.description?.trim() ?? "";
    const errors: Record<string, string[]> = {};
    if (code.length < 3 || code.length > 40) errors.code = ["Informe o tipo da infração (ex.: CONTRAFACAO)."];
    if (description.length < 10) errors.description = ["Descreva a infração (mínimo 10 caracteres)."];
    if (input.occurredAt && Date.parse(input.occurredAt) > Date.now() + DAY_MS) errors.occurredAt = ["A data não pode estar no futuro."];
    if (Object.keys(errors).length) return validation(errors);
    const prior = infractionsIn12Months(seller.id).length;
    const infraction = addInfraction(seller.id, {
      code,
      description,
      severity: input.severity,
      intentional: input.intentional,
      productId: input.productId,
      orderNumber: input.orderNumber?.trim().toUpperCase() || null,
      occurredAt: input.occurredAt,
    });
    audit("admin.infraction.create", seller.slug);
    persistDb();
    const { sellerId: _s, ...dto } = infraction;
    return HttpResponse.json(
      { infraction: dto, recommendation: recommendMeasure(input.severity, prior, input.intentional, Boolean(input.productId)) },
      { status: 201 },
    );
  }),

  http.post(`${API}/admin/sellers/:id/measures`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const seller = findSellerById(String(params.id));
    if (!seller) return notFound("Loja");
    const input = (await request.json()) as SellerMeasureInput;
    const reason = input.reason?.trim() ?? "";
    const errors: Record<string, string[]> = {};
    if (reason.length < 10) errors.reason = ["Explique o motivo da medida (o vendedor recebe este texto)."];
    if (input.type === "RemocaoAnuncio" && !input.productId) errors.productId = ["Escolha o anúncio a remover."];
    if (input.suspensionDays != null && (input.suspensionDays < 1 || input.suspensionDays > 365))
      errors.suspensionDays = ["Suspensão entre 1 e 365 dias (vazio = até a revisão da equipe)."];
    if (sellerStatus(seller.id) === "Excluido" && input.type !== "RemocaoAnuncio") errors.type = ["A loja já foi excluída."];
    if (input.type === "Exclusao" && !input.infractionId)
      errors.infractionId = [
        "A exclusão segue uma infração registrada, com a medida graduada pela gravidade, pelo número de infrações e pela intenção (Política 8.1 c e 8.2). Escolha a infração.",
      ];
    if (Object.keys(errors).length) return validation(errors);
    const measure = applyMeasure(seller.id, { ...input, reason });
    audit("admin.measure.apply", `${seller.slug}/${input.type}`);
    persistDb();
    const { sellerId: _s, ...dto } = measure;
    return HttpResponse.json(dto, { status: 201 });
  }),

  http.post(`${API}/admin/sellers/:id/measures/:measureId/revoke`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const measure = db.measures.find((m) => m.id === params.measureId && m.sellerId === params.id);
    if (!measure) return notFound("Medida");
    if (measure.revokedAt) return problem(409, "MEASURE_REVOKED", "Medida já revogada.");
    const body = (await request.json()) as RevokeMeasureRequest;
    const reason = body.reason?.trim() ?? "";
    if (reason.length < 5) return validation({ reason: ["Informe o motivo da revogação."] });
    revokeMeasure(measure, reason);
    audit("admin.measure.revoke", measure.id);
    persistDb();
    const { sellerId: _s, ...dto } = measure;
    return HttpResponse.json(dto);
  }),

  http.post(`${API}/admin/sellers/:id/dossier`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const seller = findSellerById(String(params.id));
    if (!seller) return notFound("Loja");
    const body = (await request.json()) as { purpose?: string | null };
    const purpose = body.purpose?.trim() ?? "";
    if (purpose.length < 5) return validation({ purpose: ["Informe a autoridade e o motivo do pedido (fica registrado)."] });
    logAction("InformacoesAutoridades", purpose, "Dossiê exportado (cadastro, anúncios, pedidos e medidas).", { sellerId: seller.id });
    audit("admin.seller.dossier", seller.slug);
    persistDb();
    const json = JSON.stringify(dossier(seller.id, purpose), null, 2);
    return new HttpResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="dossie-${seller.slug}.json"`,
      },
    });
  }),
];
