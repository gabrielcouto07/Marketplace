import type {
  AdminShipmentListItemDto,
  ComplianceDashboardDto,
  ComplianceIndicator,
  ComplianceIndicatorDto,
  MonitoringAlertDto,
  ComplianceMonthDto,
  ComplianceOccurrenceDto,
  ComplianceOccurrenceInput,
  IntegrationStatusDto,
  Money,
  OccurrenceStatusRequest,
  OrderDto,
  ProductReportDto,
  ProductReportReason,
  ProductReportRequest,
  ProductReportResolveRequest,
  SellerDto,
  SellerRiskDto,
  SellerShippingPolicyDto,
  ShipmentCheckDto,
  ShipmentDto,
  ShipmentStatus,
} from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { buildDeclaration, isGenericNature } from "@/lib/compliance/declaration";
import { isCountryCode } from "@/lib/countries";
import { formatMoney } from "@/lib/money";
import { isValidCpf } from "@/lib/validation/documents";

import {
  allProducts,
  allSellers,
  findProduct,
  findSellerById,
  productDeclaration,
  productNcm,
  productStatus,
  sellerKyc,
  sellerStatus,
} from "../catalog-state";
import { db, persistDb } from "../db";
import { hashString } from "../fixtures/base";
import {
  BAND_CONSEQUENCE,
  NCM_TABLE,
  checkNcmRestriction,
  SEAL_MINIMUM_SHIPMENTS,
  bandOf,
  calculateImportTax,
  compliancePermyriad,
  cycleStartYear,
  formatNcm,
  lookupNcm,
  maskDocument,
  remittanceFromTaxes,
  s10,
  searchNcm,
} from "../fixtures/remessa";
import {
  addInfraction,
  applyMeasure,
  contest,
  createReport,
  holdingAlertFor,
  infractionsIn12Months,
  logAction,
  withOverdue,
} from "../governance";
import { buildShipmentLabelPdf } from "../pdf";
import { audit, isResponse, requireAdmin, requireSeller } from "./guards";
import { advanceOrder } from "./orders";
import {
  API,
  isAuthorized,
  notFound,
  nowIso,
  num,
  paginate,
  problem,
  simulateLatency,
  validation,
} from "./utils";

/**
 * Remessa Conforme no mock (mesmas regras e mensagens da API): tributos, NCM, denúncias, remessas com etiqueta da
 * plataforma, indicadores da Portaria Coana 193/2026, ocorrências e o painel de integrações.
 */

const INDICATORS: ComplianceIndicator[] = ["Contrafacao", "Subvaloracao", "QualidadeDeclaracao"];
const DAY_MS = 86_400_000;
const DOCS = "docs/REMESSA_CONFORME.md";

// ---------------------------------------------------------------------------
// Remessas (etiqueta da plataforma)
// ---------------------------------------------------------------------------

/** A etiqueta é baixada por rota autenticada: do vendedor (pelo pedido) ou do admin (pela remessa). */
export function shipmentFor(
  order: OrderDto,
  audience: "buyer" | "seller" | "admin",
): ShipmentDto | null {
  const shipment = order.shipment;
  if (!shipment) return null;
  const labelUrl = !shipment.hasLabel
    ? null
    : audience === "seller"
      ? `/api/seller/orders/${order.id}/shipment/label`
      : audience === "admin"
        ? `/api/admin/shipments/${shipment.id}/label`
        : null;
  return { ...shipment, labelUrl };
}

export const withShipment = (order: OrderDto, audience: "buyer" | "seller" | "admin"): OrderDto => ({
  ...order,
  shipment: shipmentFor(order, audience),
});

/**
 * Registra a remessa no operador de testes (sandbox): confere os dados da declaração, gera rastreio S10 e número de
 * declaração, guarda a etiqueta e passa o pedido para Em preparação. O repasse dos tributos é confirmado na hora.
 */
function issueShipment(order: OrderDto, seller: SellerDto): ShipmentDto | Response {
  if (order.status !== "Pago" && order.status !== "EmPreparacao")
    return problem(409, "ORDER_INVALID_TRANSITION", "Só pedidos pagos ou em preparação recebem etiqueta.");
  const existing = order.shipment;
  if (existing && (existing.status === "EtiquetaEmitida" || existing.status === "Postada"))
    return problem(409, "SHIPMENT_EXISTS", "Este pedido já tem etiqueta. Baixe a etiqueta emitida.");

  // Indício de fracionamento da mesma loja em análise: a etiqueta espera o julgamento (Programa 6.4 e 6.5).
  const hold = holdingAlertFor(order.number);
  if (hold)
    return problem(
      409,
      "MONITORING_HOLD",
      `Este pedido está em análise de conformidade (${hold.summary}). A etiqueta é liberada depois da análise da equipe.`,
    );

  const errors: Record<string, string[]> = {};
  const checks: ShipmentCheckDto[] = [];
  const kyc = sellerKyc(seller.id);
  // Remetente (7.1 e 7.3).
  const senderProblems: string[] = [];
  if (sellerStatus(seller.id) === "Excluido") senderProblems.push("loja excluída");
  if (!kyc.verifiedAt) senderProblems.push("cadastro ainda não verificado pela equipe");
  if (!kyc.legalName) senderProblems.push("denominação social");
  if (!/^\d{6,8}-\d$/.test(seller.ruc)) senderProblems.push("RUC válido");
  if (!kyc.legalAddress) senderProblems.push("endereço de origem");
  checks.push({
    check: "remetente",
    ok: senderProblems.length === 0,
    detail: senderProblems.length === 0 ? `${kyc.legalName} · RUC ${seller.ruc} · ${seller.city}, PY` : `Falta: ${senderProblems.join(", ")}`,
  });
  if (senderProblems.length)
    errors.sender = [`Dados do remetente incompletos (${senderProblems.join(", ")}). Complete o cadastro da loja em Configurações.`];
  // Destinatário (7.1 e 7.2): no mock só o dígito verificador é conferido (sandbox).
  const cpfOk = isValidCpf(order.shippingAddress.recipientCpf ?? "");
  checks.push({
    check: "destinatario",
    ok: cpfOk,
    detail: cpfOk ? "CPF com dígito válido (demonstração: consulta à Receita simulada)" : "CPF do destinatário ausente ou inválido",
  });
  if (!cpfOk) errors.recipient = ["O pedido está sem CPF do destinatário. Fale com o suporte para corrigir antes de enviar."];
  // Mercadorias (7.4 a 7.6).
  order.items.forEach((item, i) => {
    const ncm = productNcm(item.productId);
    const d = productDeclaration(item.productId);
    const problems: string[] = [];
    if (!ncm) problems.push("NCM");
    else if (checkNcmRestriction(ncm)?.level === "Bloqueio") problems.push("oferta vedada (Anexo I)");
    if (!d || !isCountryCode(d.originCountry)) problems.push("país de origem");
    if (!d || d.nature.trim().length < 3 || isGenericNature(d.nature) || d.material.trim().length < 2)
      problems.push("descrição da declaração (natureza, marca, material, quantidade)");
    const description =
      d && problems.length === 0
        ? buildDeclaration({ nature: d.nature, brand: d.brand, unbranded: d.unbranded, model: d.model, material: d.material, quantity: d.packageQuantity })
        : null;
    checks.push({
      check: `mercadoria:${i + 1}`,
      ok: problems.length === 0,
      detail: problems.length === 0 ? `NCM ${formatNcm(ncm!)} · origem ${d!.originCountry} · ${description}` : `"${item.name}": falta ${problems.join(", ")}`,
    });
    if (problems.length) errors.items = [`"${item.name}": ${problems.join(", ")}. Complete o cadastro do produto.`];
  });
  if (Object.keys(errors).length) return validation(errors);

  const now = nowIso();
  const id = existing?.id ?? crypto.randomUUID();
  const serial = hashString(id) % 100_000_000;
  const taxes =
    order.totals.taxes ??
    calculateImportTax(
      {
        products: order.totals.subtotal.amount,
        freight: order.totals.shipping.amount,
        discount: order.totals.discount.amount,
        state: order.shippingAddress.state,
      },
      db.settings,
    );
  // Regime (7.6) e valor (6.2 e 6.3): o declarado é o cobrado do comprador.
  const charged = order.totals.subtotal.amount + order.totals.shipping.amount + taxes.insurance.amount + taxes.otherExpenses.amount - order.totals.discount.amount;
  checks.push({
    check: "regime",
    ok: taxes.regime === "RemessaConforme" && !taxes.exceedsSimplifiedLimit,
    detail: taxes.exceedsSimplifiedLimit
      ? "Acima de US$ 3.000: fora do regime de tributação simplificada"
      : taxes.regime === "RemessaConforme"
        ? "Remessa Conforme (tributos recolhidos na compra)"
        : "Tributos estimados (modo Flat)",
  });
  checks.push({
    check: "valor",
    ok: taxes.customsValue.amount === charged,
    detail: `Declarado ${brl(taxes.customsValue)} · cobrado ${brl({ amount: charged, currency: "BRL" })} · total do pedido ${brl(order.totals.total)}`,
  });
  if (taxes.exceedsSimplifiedLimit)
    return validation({ regime: ["A remessa passa de US$ 3.000 e não cabe no regime de tributação simplificada."] });
  if (taxes.customsValue.amount !== charged)
    return problem(409, "DECLARED_VALUE_MISMATCH", "O valor declarado não coincide com o valor cobrado do comprador. Fale com o suporte.");
  db.shipmentChecks[id] = checks;

  const shipment: ShipmentDto = {
    id,
    orderId: order.id,
    status: "EtiquetaEmitida",
    provider: "sandbox",
    sandbox: true,
    carrier: order.shippingOption.carrier || "Operador logístico",
    trackingCode: s10("SB", serial, "PY"),
    declarationNumber: `SBX-${now.slice(0, 10).replace(/-/g, "")}-${String(serial % 1_000_000).padStart(6, "0")}`,
    hasLabel: true,
    labelUrl: null,
    createdAt: existing?.createdAt ?? now,
    labelIssuedAt: now,
    postedAt: null,
    lastError: null,
    dirNumber: null,
    customsStatus: null,
    customsCheckedAt: null,
    remittance: remittanceFromTaxes(taxes, now, `SBX-REP-${id.replace(/-/g, "").slice(0, 10).toUpperCase()}`),
  };
  order.shipment = shipment;
  order.trackingCode = shipment.trackingCode;
  order.carrier = shipment.carrier;
  if (order.status === "Pago") advanceOrder(order, "EmPreparacao", "Etiqueta emitida pela plataforma.");
  audit("shipment.create", order.number);
  persistDb();
  return shipmentFor(order, "seller")!;
}

/** Postagem confirmada pelo vendedor (a etiqueta já levou a declaração). */
export function markShipmentPosted(order: OrderDto): void {
  if (!order.shipment) return;
  order.shipment = { ...order.shipment, status: "Postada", postedAt: nowIso() };
}

const brl = (m: Money) => formatMoney(m, { locale: "pt-BR" });

function labelPdf(order: OrderDto): Uint8Array {
  const shipment = order.shipment!;
  const seller = findSellerById(order.seller.id);
  const kyc = sellerKyc(order.seller.id);
  const taxes = order.totals.taxes;
  const a = order.shippingAddress;
  const ncms = [
    ...new Set(
      order.items
        .map((i) => productNcm(i.productId))
        .filter((code): code is string => Boolean(code))
        .map(formatNcm),
    ),
  ].slice(0, 3);
  return buildShipmentLabelPdf({
    brand: "Mercado Paraguai",
    tradeName: "Mercado Paraguai",
    documentLabel: "CNPJ nao configurado (sandbox)",
    sandbox: shipment.sandbox,
    carrier: shipment.carrier ?? "Operador logistico",
    orderNumber: order.number,
    trackingCode: shipment.trackingCode ?? "",
    declarationNumber: shipment.declarationNumber,
    recipientName: a.recipientName,
    recipientCpf: maskDocument(a.recipientCpf) ?? "-",
    recipientAddress: `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""} - ${a.neighborhood}`,
    recipientCityLine: `CEP ${a.postalCode.slice(0, 5)}-${a.postalCode.slice(5)} - ${a.city}/${a.state}`,
    senderName: `${kyc.legalName ?? seller?.name ?? order.seller.name} - RUC ${seller?.ruc ?? ""}`,
    senderAddress: `${kyc.legalAddress ?? ""} - ${seller?.city ?? order.seller.city}, PY`,
    itemsLine: `${order.items.length === 1 ? "1 item" : `${order.items.length} itens`} - NCM ${ncms.join(", ")}`,
    customsLine: taxes
      ? `Valor aduaneiro ${brl(taxes.customsValue)}${taxes.customsValueUsd ? ` (${formatMoney(taxes.customsValueUsd, { locale: "pt-BR" })})` : ""}`
      : "",
    taxesLine: taxes
      ? `II ${brl(taxes.importDuty)} - ICMS ${brl(taxes.icms)} - IBS ${brl(taxes.ibs)} - CBS ${brl(taxes.cbs)}`
      : "",
    totalTaxesLine: `Tributos recolhidos pela plataforma: ${brl(taxes?.totalTaxes ?? order.totals.importTax)}`,
    footerLine: `Compra em ${new Date(order.createdAt).toLocaleDateString("pt-BR")} - etiqueta gerada pelo mock (MSW)`,
  });
}

const pdfResponse = (bytes: Uint8Array, fileName: string) =>
  new HttpResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });

// ---------------------------------------------------------------------------
// Conformidade (Portaria Coana 193/2026)
// ---------------------------------------------------------------------------

/** Remessas movimentadas = pedidos que saíram para o operador (evento Enviado). */
const shippedAtOf = (order: OrderDto) => order.timeline.find((e) => e.status === "Enviado")?.occurredAt ?? null;

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};

function indicatorDto(indicator: ComplianceIndicator, shipments: number, occurrences: number): ComplianceIndicatorDto {
  const permyriad = compliancePermyriad(shipments, occurrences);
  const band = bandOf(permyriad);
  return { indicator, occurrences, compliancePermyriad: permyriad, band, consequence: BAND_CONSEQUENCE[band] };
}

function dashboard(cycle: number | undefined): ComplianceDashboardDto {
  const now = new Date();
  const year = cycle ?? cycleStartYear(now);
  const start = Date.UTC(year, 6, 1);
  const end = Date.UTC(year + 1, 6, 1);
  const inCycle = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start && t < end;
  };
  const shipped = db.orders.map(shippedAtOf).filter((d): d is string => d !== null && inCycle(d));
  const occurrences = receitaOccurrences().filter((o) => o.status !== "Anulada" && inCycle(o.occurredAt));

  const firstMonth = year * 12 + 6;
  const lastMonth = Math.min(now.getUTCFullYear() * 12 + now.getUTCMonth(), (year + 1) * 12 + 5);
  const months: ComplianceMonthDto[] = [];
  for (let key = firstMonth; key <= lastMonth; key++) {
    const count = shipped.filter((d) => monthKey(d) === key).length;
    const ofMonth = occurrences.filter((o) => monthKey(o.occurredAt) === key);
    months.push({
      year: Math.floor(key / 12),
      month: (key % 12) + 1,
      shipments: count,
      indicators: INDICATORS.map((i) => indicatorDto(i, count, ofMonth.filter((o) => o.indicator === i).length)),
    });
  }

  // Acompanhamento por loja: ocorrências da Receita na janela e infrações apuradas pela equipe em 12 meses.
  const counts = new Map<string, number>();
  for (const o of receitaOccurrences()) {
    if (!o.sellerId || !inWindow(o)) continue;
    counts.set(o.sellerId, (counts.get(o.sellerId) ?? 0) + 1);
  }
  const ids = new Set([...counts.keys(), ...db.infractions.map((i) => i.sellerId)]);
  const sellersAtRisk: SellerRiskDto[] = [...ids]
    .map((sellerId) => ({ sellerId, infractions: infractionsIn12Months(sellerId) }))
    .filter((r) => counts.has(r.sellerId) || r.infractions.length > 0)
    .sort((a, b) => (counts.get(b.sellerId) ?? 0) + b.infractions.length - (counts.get(a.sellerId) ?? 0) - a.infractions.length)
    .slice(0, 10)
    .flatMap(({ sellerId, infractions }) => {
      const seller = findSellerById(sellerId);
      return seller
        ? [
            {
              sellerId,
              sellerName: seller.name,
              status: sellerStatus(sellerId),
              occurrences: counts.get(sellerId) ?? 0,
              openReports: db.reports.filter((r) => r.sellerId === sellerId && r.status === "Aberta").length,
              infractions: infractions.length,
              recidivist: infractions.some((i) => i.recidivist),
              openAlert: db.alerts.some((a) => a.sellerId === sellerId && a.status === "Aberto"),
            },
          ]
        : [];
    });

  return {
    cycleStartYear: year,
    cycle: { min: new Date(start).toISOString(), max: new Date(end - 1).toISOString() },
    cycleShipments: shipped.length,
    sealEligible: shipped.length >= SEAL_MINIMUM_SHIPMENTS,
    sealMinimumShipments: SEAL_MINIMUM_SHIPMENTS,
    cycleIndicators: INDICATORS.map((i) =>
      indicatorDto(i, shipped.length, occurrences.filter((o) => o.indicator === i).length),
    ),
    months,
    sellersAtRisk,
    openReports: db.reports.filter((r) => r.status === "Aberta").length,
    productsInReview: allProducts().filter((p) => productStatus(p.id) === "EmAnalise").length,
    pendingSellerVerifications: allSellers().filter((s) => sellerStatus(s.id) === "Pendente").length,
    strikeLimit: db.settings.sellerStrikeLimit,
    strikeWindowDays: db.settings.strikeWindowDays,
  };
}

/** Só as ocorrências que vêm da Receita entram nos indicadores (registros antigos de denúncia ficam de fora). */
const receitaOccurrences = () => db.occurrences.filter((o) => o.source !== "Denuncia");

const inWindow = (o: ComplianceOccurrenceDto) =>
  o.status !== "Anulada" && new Date(o.occurredAt).getTime() >= Date.now() - db.settings.strikeWindowDays * DAY_MS;

/** Ocorrências da Receita da loja na janela de acompanhamento (as anuladas não contam). */
export function sellerOccurrences(sellerId: string): ComplianceOccurrenceDto[] {
  return receitaOccurrences().filter((o) => o.sellerId === sellerId && inWindow(o));
}

export const openReportsFor = (productId: string) =>
  db.reports.filter((r) => r.productId === productId && r.status === "Aberta").length;

/**
 * Loja no limite de acompanhamento ganha alerta para a equipe (ReviewSellerOccurrencesAsync da API). Nada é aplicado
 * sozinho: a medida é graduada pela equipe e comunicada com prazo de resposta (Política 8.2, 8.5 e 8.6).
 */
function reviewSellerOccurrences(sellerId: string | null): void {
  if (!sellerId || db.settings.sellerStrikeLimit <= 0 || sellerStatus(sellerId) === "Excluido") return;
  const occurrences = sellerOccurrences(sellerId);
  if (occurrences.length < db.settings.sellerStrikeLimit) return;
  const summary =
    `${occurrences.length} ocorrências da Receita nas remessas da loja em ${db.settings.strikeWindowDays} dias. ` +
    "Avaliar a infração e a medida pela Política (8.2); a loja é comunicada e pode responder em 10 dias (8.5 e 8.6).";
  const orderNumbers = occurrences.flatMap((o) => (o.orderNumber ? [o.orderNumber] : []));
  const open = db.alerts.find((a) => a.type === "OcorrenciasReceita" && a.sellerId === sellerId && a.status === "Aberto");
  if (open) {
    Object.assign(open, { summary, orderNumbers });
    return;
  }
  const alert: MonitoringAlertDto = {
    id: crypto.randomUUID(),
    type: "OcorrenciasReceita",
    status: "Aberto",
    sellerId,
    sellerName: findSellerById(sellerId)?.name ?? null,
    buyerUserId: null,
    buyerEmail: null,
    summary,
    orderNumbers,
    holdsShipments: false,
    detectedAt: nowIso(),
    attribution: null,
    resolutionNote: null,
    resolvedAt: null,
  };
  db.alerts.unshift(alert);
  logAction("AlertaMonitoramento", summary, "Alerta aberto para análise da equipe.", { sellerId, automatic: true });
}

function newOccurrence(
  fields: Pick<ComplianceOccurrenceDto, "indicator" | "source" | "code" | "description" | "occurredAt"> &
    Partial<ComplianceOccurrenceDto>,
): ComplianceOccurrenceDto {
  const seller = fields.sellerId ? findSellerById(fields.sellerId) : null;
  const product = fields.productId ? findProduct(fields.productId) : null;
  return {
    id: crypto.randomUUID(),
    status: "Confirmada",
    sellerId: seller?.id ?? null,
    sellerName: seller?.name ?? null,
    productId: product?.id ?? null,
    productName: product?.name ?? null,
    orderId: null,
    orderNumber: null,
    externalId: null,
    registeredAt: nowIso(),
    statusReason: null,
    ...fields,
  };
}

/** Infração do vendedor por motivo da denúncia procedente (InfractionFor da API). */
const INFRACTION_FOR: Record<ProductReportReason, [code: string, severity: "Leve" | "Media" | "Grave", moderation: string]> = {
  Falsificado: ["CONTRAFACAO", "Grave", "CONTRAFACAO"],
  PropriedadeIntelectual: ["PROPRIEDADE_INTELECTUAL", "Grave", "CONTRAFACAO"],
  OrigemIlicita: ["ORIGEM_ILICITA", "Grave", "ORIGEM_ILICITA"],
  ProdutoProibido: ["PRODUTO_PROIBIDO", "Grave", "PRODUTO_PROIBIDO"],
  PrecoSuspeito: ["SUBFATURAMENTO", "Media", "DENUNCIA"],
  DescricaoIncorreta: ["DIVERGENCIA", "Leve", "DENUNCIA"],
  Outro: ["OUTRO", "Leve", "DENUNCIA"],
};

/** Denúncia com nome e status atuais do produto e o prazo vencido calculado. */
function liveReport(report: ProductReportDto): ProductReportDto {
  const product = findProduct(report.productId);
  return withOverdue(product ? { ...report, productName: product.name, productStatus: productStatus(product.id) } : report);
}

function shipmentItem(order: OrderDto): AdminShipmentListItemDto {
  const s = order.shipment!;
  return {
    id: s.id,
    orderId: order.id,
    orderNumber: order.number,
    sellerName: order.seller.name,
    status: s.status,
    provider: s.provider,
    sandbox: s.sandbox,
    trackingCode: s.trackingCode,
    declarationNumber: s.declarationNumber,
    dirNumber: s.dirNumber,
    customsStatus: s.customsStatus,
    remittanceStatus: s.remittance?.status ?? null,
    taxes: order.totals.taxes?.totalTaxes ?? order.totals.importTax,
    createdAt: s.createdAt,
    lastError: s.lastError,
    checks: db.shipmentChecks[s.id] ?? [],
  };
}

/** O mesmo painel que a API monta com a configuração padrão (sem credenciais: sandbox e APIs públicas). */
function integrations(): IntegrationStatusDto[] {
  return [
    {
      key: "platform",
      name: "Identidade da empresa (ECE)",
      purpose:
        "Marca, nome comercial e CNPJ/TIN na etiqueta e no bloco remessaConforme da DIR (critério iii).",
      provider: "CNPJ",
      configured: false,
      requiresCredential: true,
      mode: "Incompleto",
      missing: [
        "RemessaConforme__Platform__LegalName",
        "RemessaConforme__Platform__Document",
        "RemessaConforme__Platform__AdeNumber",
      ],
      detail: "Mercado Paraguai · Mercado Paraguai",
      docsUrl: DOCS,
    },
    {
      key: "carrier",
      name: "Operador logístico (Correios/courier)",
      purpose:
        "Recebe os dados da declaração antecipada, devolve a etiqueta e recebe o repasse dos tributos (critério i).",
      provider: "sandbox",
      configured: false,
      requiresCredential: true,
      mode: "Sandbox",
      missing: [
        "RemessaConforme__Carrier__BaseUrl",
        "RemessaConforme__Carrier__ApiKey",
        "RemessaConforme__Carrier__Provider=Http",
      ],
      detail: 'Etiquetas de teste, marcadas "SANDBOX · NÃO POSTAR".',
      docsUrl: DOCS,
    },
    {
      key: "siscomex",
      name: "Portal Único Siscomex — Remessas Internacionais",
      purpose:
        "Consulta de remessas da ECE (perfil EMPRCOMEL): DIR, situação, ocorrências e divergências que alimentam os indicadores.",
      provider: "portal-unico",
      configured: false,
      requiresCredential: true,
      mode: "Desligado",
      missing: ["Siscomex__ClientId", "Siscomex__ClientSecret", "Siscomex__Cnpj"],
      detail: "https://val.portalunico.siscomex.gov.br",
      docsUrl: DOCS,
    },
    {
      key: "serpro",
      name: "Serpro — Consulta CPF",
      purpose:
        "CPF e nome do destinatário conferidos na base da Receita antes de concluir a venda (Programa de Conformidade 7.2).",
      provider: "serpro",
      configured: false,
      requiresCredential: true,
      mode: "Só dígito verificador (demonstração)",
      missing: ["Serpro__ConsumerKey", "Serpro__ConsumerSecret"],
      detail: "Demonstração: só o dígito verificador é conferido. Em produção, sem a chave nenhuma venda conclui.",
      docsUrl: DOCS,
    },
    {
      key: "ncm",
      name: "Tabela NCM oficial (Siscomex)",
      purpose: "Confere se o NCM de cada produto existe na nomenclatura vigente. Pública, sem chave.",
      provider: "siscomex-classif",
      configured: true,
      requiresCredential: false,
      mode: "Ativo",
      missing: [],
      detail: `${Object.keys(NCM_TABLE).length} códigos (recorte da tabela no mock)`,
      docsUrl: DOCS,
    },
    {
      key: "ptax",
      name: "Banco Central — PTAX",
      purpose:
        "Câmbio oficial USD→BRL para a faixa de US$ 50 e o valor em dólar da declaração. Pública, sem chave.",
      provider: "bcb-ptax",
      configured: true,
      requiresCredential: false,
      mode: "Ativo",
      missing: [],
      detail: "US$ 1,00 = R$ 5,40 (cotação simulada no mock)",
      docsUrl: DOCS,
    },
  ];
}

export const remessaHandlers = [
  // ----- Público: tributos e NCM -----
  http.get(`${API}/taxes/estimate`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const amount = num(url.searchParams.get("amount"), 0)!;
    const freight = num(url.searchParams.get("freight"), 0)!;
    const state = url.searchParams.get("state")?.trim().toUpperCase() || null;
    const errors: Record<string, string[]> = {};
    if (!Number.isInteger(amount) || amount < 1 || amount > 100_000_000) errors.amount = ["Valor inválido."];
    if (!Number.isInteger(freight) || freight < 0 || freight > 10_000_000) errors.freight = ["Frete inválido."];
    if (state && state.length !== 2) errors.state = ["UF inválida."];
    if (Object.keys(errors).length) return validation(errors);
    // Programa 4.2: com o frete cotado para o CEP, a conta inteira (produto, frete, seguro, tributos e total).
    return HttpResponse.json(calculateImportTax({ products: amount, freight, discount: 0, state }, db.settings));
  }),

  http.get(`${API}/ncm`, async ({ request }) => {
    await simulateLatency();
    return HttpResponse.json(searchNcm(new URL(request.url).searchParams.get("q") ?? ""));
  }),

  http.get(`${API}/ncm/:code`, async ({ params }) => {
    await simulateLatency();
    const result = lookupNcm(String(params.code));
    if (result === "invalid") return validation({ code: ["O NCM tem 8 dígitos, ex.: 8517.13.00."] });
    if (result === "not-found") return notFound("NCM na tabela vigente");
    return HttpResponse.json(result);
  }),

  // ----- Denúncia pela página do produto: aberta a qualquer pessoa, com ou sem login (Política 6.4) -----
  http.post(`${API}/products/:id/reports`, async ({ request, params }) => {
    await simulateLatency();
    const body = (await request.json()) as ProductReportRequest;
    const product = findProduct(String(params.id));
    if (!product) return notFound("Produto");
    const result = createReport(product, body, "PaginaDoProduto", isAuthorized(request));
    if ("errors" in result) return validation(result.errors);
    if ("conflict" in result) return problem(409, "REPORT_ALREADY_OPEN", result.conflict);
    audit("product.report", product.slug);
    persistDb();
    return HttpResponse.json(result, { status: 201 });
  }),

  // ----- Vendedor: etiqueta da plataforma -----
  http.get(`${API}/seller/shipping-policy`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const policy: SellerShippingPolicyDto = {
      requirePlatformLabel: db.settings.requirePlatformLabel,
      carrierConfigured: true,
      sandbox: true,
      carrier: "sandbox",
    };
    return HttpResponse.json(policy);
  }),

  http.post(`${API}/seller/orders/:id/shipment`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const order = db.orders.find((o) => o.id === params.id && o.seller.id === seller.id);
    if (!order) return notFound("Pedido");
    const result = issueShipment(order, seller);
    return isResponse(result) ? result : HttpResponse.json(result, { status: 201 });
  }),

  http.get(`${API}/seller/orders/:id/shipment`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const order = db.orders.find((o) => o.id === params.id && o.seller.id === seller.id);
    const shipment = order ? shipmentFor(order, "seller") : null;
    return shipment ? HttpResponse.json(shipment) : notFound("Remessa");
  }),

  http.get(`${API}/seller/orders/:id/shipment/label`, async ({ request, params }) => {
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const order = db.orders.find((o) => o.id === params.id && o.seller.id === seller.id);
    if (!order?.shipment?.hasLabel) return notFound("Etiqueta");
    return pdfResponse(labelPdf(order), `etiqueta-${order.number}.pdf`);
  }),

  // ----- Admin: conformidade -----
  http.get(`${API}/admin/compliance`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const cycle = num(new URL(request.url).searchParams.get("cycle"));
    return HttpResponse.json(dashboard(cycle));
  }),

  http.get(`${API}/admin/compliance/occurrences`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const indicator = url.searchParams.get("indicator");
    const sellerId = url.searchParams.get("sellerId");
    const status = url.searchParams.get("status");
    const items = receitaOccurrences()
      .filter(
        (o) =>
          (!indicator || o.indicator === indicator) &&
          (!sellerId || o.sellerId === sellerId) &&
          (!status || o.status === status),
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return HttpResponse.json(
      paginate(items, num(url.searchParams.get("page"), 1)!, num(url.searchParams.get("pageSize"), 20)!),
    );
  }),

  http.post(`${API}/admin/compliance/occurrences`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const body = (await request.json()) as ComplianceOccurrenceInput;
    const code = (body.code ?? "").trim().toUpperCase().replace(/ /g, "_");
    const description = body.description?.trim() ?? "";
    const errors: Record<string, string[]> = {};
    if (body.source === "Denuncia")
      errors.source = [
        "Denúncia julgada procedente é infração da loja (Política 6.7), registrada no julgamento, e não entra nos indicadores da Receita.",
      ];
    if (code.length < 3 || code.length > 60)
      errors.code = ["Informe o código da ocorrência (ex.: CPF_DESTINATARIO)."];
    if (description.length < 5) errors.description = ["Descreva a ocorrência."];
    if (body.occurredAt && new Date(body.occurredAt).getTime() > Date.now() + DAY_MS)
      errors.occurredAt = ["A data não pode estar no futuro."];
    if (Object.keys(errors).length) return validation(errors);

    let sellerId = body.sellerId ?? null;
    let order: OrderDto | undefined;
    if (body.orderNumber?.trim()) {
      const number = body.orderNumber.trim().toUpperCase();
      order = db.orders.find((o) => o.number === number);
      if (!order) return validation({ orderNumber: ["Pedido não encontrado."] });
      sellerId ??= order.seller.id;
    }
    if (sellerId && !findSellerById(sellerId)) return validation({ sellerId: ["Loja não encontrada."] });

    const occurrence = newOccurrence({
      indicator: body.indicator,
      source: body.source,
      code,
      description,
      sellerId,
      productId: body.productId ?? null,
      orderId: order?.id ?? null,
      orderNumber: order?.number ?? null,
      occurredAt: body.occurredAt ?? nowIso(),
    });
    db.occurrences.unshift(occurrence);
    audit("admin.occurrence.create", `${occurrence.indicator}/${code}`);
    reviewSellerOccurrences(sellerId);
    persistDb();
    return HttpResponse.json(occurrence, { status: 201 });
  }),

  http.post(`${API}/admin/compliance/occurrences/:id/status`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const occurrence = db.occurrences.find((o) => o.id === params.id);
    if (!occurrence) return notFound("Ocorrência");
    const body = (await request.json()) as OccurrenceStatusRequest;
    if (body.status === "Contestada") {
      // Programa 11.6 e 11.7: só por erro material, inconsistência sistêmica ou impropriedade na metodologia.
      if (!body.contestationReason)
        return validation({
          contestationReason: [
            "A contestação só cabe por erro material, inconsistência sistêmica ou impropriedade na aplicação da metodologia de cálculo (Programa 11.6).",
          ],
        });
      const result = contest(
        {
          indicator: occurrence.indicator,
          occurrenceIds: [occurrence.id],
          reason: body.contestationReason,
          grounds: body.grounds ?? body.reason ?? "",
          evidence: body.evidence,
          reference: body.reference,
        },
        admin.email,
      );
      if ("errors" in result) return validation(result.errors);
      audit("admin.occurrence.status", `${occurrence.id}/Contestada`);
      persistDb();
      return HttpResponse.json(occurrence);
    }
    const reason = body.reason?.trim() || null;
    if (body.status === "Anulada" && (!reason || reason.length < 5))
      return validation({ reason: ["Informe o motivo da anulação (ex.: contestação acolhida pela Receita)."] });
    if (reason && reason.length > 500) return validation({ reason: ["Máximo de 500 caracteres."] });
    occurrence.status = body.status;
    occurrence.statusReason = reason;
    audit("admin.occurrence.status", occurrence.id);
    persistDb();
    return HttpResponse.json(occurrence);
  }),

  // ----- Admin: denúncias -----
  http.get(`${API}/admin/reports`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const items = db.reports
      .filter((r) => !status || r.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(liveReport);
    return HttpResponse.json(
      paginate(items, num(url.searchParams.get("page"), 1)!, num(url.searchParams.get("pageSize"), 20)!),
    );
  }),

  http.post(`${API}/admin/reports/:id/resolve`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const report = db.reports.find((r) => r.id === params.id);
    if (!report) return notFound("Denúncia");
    if (report.status !== "Aberta")
      return problem(409, "REPORT_ALREADY_RESOLVED", "Esta denúncia já foi resolvida.");
    const body = (await request.json()) as ProductReportResolveRequest;
    const note = body.note?.trim() || null;
    if (note && note.length > 500) return validation({ note: ["Máximo de 500 caracteres."] });
    const now = nowIso();
    report.status = body.upheld ? "Procedente" : "Improcedente";
    report.resolvedAt = now;
    report.resolutionNote = note;
    if (body.upheld) {
      // Política 6.7: denúncia procedente é infração da loja (não ocorrência dos indicadores da Receita); com bloqueio, o
      // anúncio é removido e o vendedor comunicado (8.5). Suspensão ou exclusão são graduadas na ficha da loja (8.2).
      const [code, severity, moderation] = INFRACTION_FOR[report.reason];
      const why = note ?? `Denúncia ${report.protocol ?? ""} julgada procedente (${report.reason}).`;
      const infraction = addInfraction(report.sellerId, {
        code,
        description: why,
        severity,
        intentional: false,
        productId: report.productId,
      });
      if (body.blockProduct)
        applyMeasure(
          report.sellerId,
          { type: "RemocaoAnuncio", reason: why, infractionId: infraction.id, productId: report.productId },
          false,
          moderation,
        );
      logAction(
        "DenunciaProcedente",
        note ?? report.reason,
        body.blockProduct ? "Anúncio removido; infração registrada." : "Infração registrada.",
        { sellerId: report.sellerId, productId: report.productId, reportId: report.id },
      );
    } else {
      logAction("DenunciaImprocedente", note ?? report.reason, "Anúncio mantido.", {
        sellerId: report.sellerId,
        productId: report.productId,
        reportId: report.id,
      });
    }
    audit("admin.report.resolve", report.id);
    persistDb();
    return HttpResponse.json(liveReport(report));
  }),

  // ----- Admin: remessas -----
  http.get(`${API}/admin/shipments`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as ShipmentStatus | null;
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const items = db.orders
      .filter((o) => o.shipment)
      .map(shipmentItem)
      .filter(
        (s) =>
          (!status || s.status === status) &&
          (!q || `${s.orderNumber} ${s.trackingCode ?? ""} ${s.sellerName}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(
      paginate(items, num(url.searchParams.get("page"), 1)!, num(url.searchParams.get("pageSize"), 20)!),
    );
  }),

  http.get(`${API}/admin/shipments/:id/label`, async ({ request, params }) => {
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const order = db.orders.find((o) => o.shipment?.id === params.id);
    if (!order?.shipment?.hasLabel) return notFound("Etiqueta");
    return pdfResponse(labelPdf(order), `etiqueta-${order.number}.pdf`);
  }),

  http.post(`${API}/admin/shipments/:id/retry`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const order = db.orders.find((o) => o.shipment?.id === params.id);
    if (!order?.shipment) return notFound("Remessa");
    if (order.shipment.status !== "Falhou")
      return problem(409, "SHIPMENT_NOT_FAILED", "Só remessas com falha podem ser reenviadas.");
    const seller = findSellerById(order.seller.id);
    if (!seller) return notFound("Loja");
    const result = issueShipment(order, seller);
    return isResponse(result) ? result : HttpResponse.json(shipmentFor(order, "admin"));
  }),

  http.get(`${API}/admin/integrations`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    return HttpResponse.json(integrations());
  }),
];
