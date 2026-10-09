import type {
  AdminShipmentListItemDto,
  ComplianceDashboardDto,
  ComplianceIndicator,
  ComplianceIndicatorDto,
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
  ShipmentDto,
  ShipmentStatus,
} from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { formatMoney } from "@/lib/money";
import { isValidCpf } from "@/lib/validation/documents";

import {
  allProducts,
  allSellers,
  findProduct,
  findSellerById,
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
  unauthorized,
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

  const errors: Record<string, string[]> = {};
  const withoutNcm = order.items.find((item) => !productNcm(item.productId));
  if (withoutNcm)
    errors.items = [`"${withoutNcm.name}" está sem NCM válido. Complete o cadastro do produto.`];
  if (!isValidCpf(order.shippingAddress.recipientCpf ?? ""))
    errors.recipient = [
      "O pedido está sem CPF do destinatário. Fale com o suporte para corrigir antes de enviar.",
    ];
  if (!sellerKyc(seller.id).legalAddress)
    errors.sender = [
      "Complete o endereço de origem da loja em Configurações (vai na declaração e na etiqueta).",
    ];
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
    senderName: `${seller?.name ?? order.seller.name} - RUC ${seller?.ruc ?? ""}`,
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
  const occurrences = db.occurrences.filter((o) => o.status !== "Anulada" && inCycle(o.occurredAt));

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

  const windowStart = Date.now() - db.settings.strikeWindowDays * DAY_MS;
  const counts = new Map<string, number>();
  for (const o of db.occurrences) {
    if (!o.sellerId || o.status === "Anulada" || new Date(o.occurredAt).getTime() < windowStart) continue;
    counts.set(o.sellerId, (counts.get(o.sellerId) ?? 0) + 1);
  }
  const sellersAtRisk: SellerRiskDto[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .flatMap(([sellerId, count]) => {
      const seller = findSellerById(sellerId);
      return seller
        ? [
            {
              sellerId,
              sellerName: seller.name,
              status: sellerStatus(sellerId),
              occurrences: count,
              openReports: db.reports.filter((r) => r.sellerId === sellerId && r.status === "Aberta").length,
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

/** Ocorrências da loja na janela de reincidência (as anuladas não contam). */
export function sellerOccurrences(sellerId: string): ComplianceOccurrenceDto[] {
  const from = Date.now() - db.settings.strikeWindowDays * DAY_MS;
  return db.occurrences.filter(
    (o) => o.sellerId === sellerId && o.status !== "Anulada" && new Date(o.occurredAt).getTime() >= from,
  );
}

export const openReportsFor = (productId: string) =>
  db.reports.filter((r) => r.productId === productId && r.status === "Aberta").length;

/** Descredencia (suspende) a loja que atingiu o limite de ocorrências na janela. */
function evaluateStrikes(sellerId: string | null): void {
  if (!sellerId || db.settings.sellerStrikeLimit <= 0) return;
  const count = sellerOccurrences(sellerId).length;
  if (count < db.settings.sellerStrikeLimit || sellerStatus(sellerId) === "Suspenso") return;
  db.sellerOverrides[sellerId] = { ...db.sellerOverrides[sellerId], status: "Suspenso" };
  db.sellerKyc[sellerId] = {
    ...sellerKyc(sellerId),
    suspensionReason: `Descredenciada automaticamente: ${count} ocorrências de conformidade em ${db.settings.strikeWindowDays} dias (limite ${db.settings.sellerStrikeLimit}).`,
  };
  audit("compliance.seller.suspend", findSellerById(sellerId)?.slug ?? sellerId);
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

/** Falsificado → contrafação; preço suspeito → subvaloração; o resto → qualidade da declaração. */
const indicatorFor = (reason: ProductReportReason): ComplianceIndicator =>
  reason === "Falsificado" ? "Contrafacao" : reason === "PrecoSuspeito" ? "Subvaloracao" : "QualidadeDeclaracao";

/** Denúncia com nome e status atuais do produto. */
function liveReport(report: ProductReportDto): ProductReportDto {
  const product = findProduct(report.productId);
  return product ? { ...report, productName: product.name, productStatus: productStatus(product.id) } : report;
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
        "Situação do CPF do destinatário na Receita antes da compra (indicador de qualidade da declaração).",
      provider: "serpro",
      configured: false,
      requiresCredential: true,
      mode: "Só dígito verificador",
      missing: ["Serpro__ConsumerKey", "Serpro__ConsumerSecret"],
      detail: null,
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

const REPORT_REASONS: ProductReportReason[] = [
  "Falsificado",
  "PrecoSuspeito",
  "DescricaoIncorreta",
  "ProdutoProibido",
  "Outro",
];

export const remessaHandlers = [
  // ----- Público: tributos e NCM -----
  http.get(`${API}/taxes/estimate`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const amount = num(url.searchParams.get("amount"), 0)!;
    const state = url.searchParams.get("state")?.trim().toUpperCase() || null;
    const errors: Record<string, string[]> = {};
    if (!Number.isInteger(amount) || amount < 1 || amount > 100_000_000) errors.amount = ["Valor inválido."];
    if (state && state.length !== 2) errors.state = ["UF inválida."];
    if (Object.keys(errors).length) return validation(errors);
    return HttpResponse.json(
      calculateImportTax({ products: amount, freight: 0, discount: 0, state }, db.settings),
    );
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

  // ----- Comprador: denúncia -----
  http.post(`${API}/products/:id/reports`, async ({ request, params }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const body = (await request.json()) as ProductReportRequest;
    const details = body.details?.trim() ?? "";
    const errors: Record<string, string[]> = {};
    if (!REPORT_REASONS.includes(body.reason)) errors.reason = ["Escolha o motivo da denúncia."];
    if (details.length > 1000) errors.details = ["Conte em até 1.000 caracteres."];
    if (body.reason === "Outro" && details.length < 10)
      errors.details = ["Explique o problema em pelo menos 10 caracteres."];
    if (Object.keys(errors).length) return validation(errors);
    const product = findProduct(String(params.id));
    if (!product) return notFound("Produto");
    if (
      db.reports.some(
        (r) => r.productId === product.id && r.reporterEmail === db.user.email && r.status === "Aberta",
      )
    )
      return problem(409, "REPORT_ALREADY_OPEN", "Você já denunciou este produto. A equipe está analisando.");
    const report: ProductReportDto = {
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      productStatus: productStatus(product.id),
      sellerId: product.seller.id,
      sellerName: product.seller.name,
      reason: body.reason,
      details,
      status: "Aberta",
      createdAt: nowIso(),
      reporterEmail: db.user.email,
      resolvedAt: null,
      resolutionNote: null,
      occurrenceId: null,
    };
    db.reports.unshift(report);
    audit("product.report", product.slug);
    persistDb();
    return HttpResponse.json(report, { status: 201 });
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
    const items = db.occurrences
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
    evaluateStrikes(sellerId);
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
    const reason = body.reason?.trim() || null;
    if (body.status !== "Confirmada" && (!reason || reason.length < 5))
      return validation({
        reason: [
          "Informe o motivo (contestação só cabe por erro material, falha de sistema ou duplicidade).",
        ],
      });
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
      const occurrence = newOccurrence({
        indicator: body.indicator ?? indicatorFor(report.reason),
        source: "Denuncia",
        code: `DENUNCIA_${report.reason.toUpperCase()}`,
        description: note ?? `Denúncia procedente: ${report.reason}.`,
        sellerId: report.sellerId,
        productId: report.productId,
        externalId: `report:${report.id}`,
        occurredAt: now,
      });
      db.occurrences.unshift(occurrence);
      report.occurrenceId = occurrence.id;
      if (body.blockProduct)
        db.productOverrides[report.productId] = {
          ...db.productOverrides[report.productId],
          status: "Bloqueado",
          moderationReason: report.reason === "Falsificado" ? "CONTRAFACAO" : "DENUNCIA",
          moderationNote: note ?? "Bloqueado após denúncia procedente.",
          updatedAt: now,
        };
      evaluateStrikes(report.sellerId);
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
