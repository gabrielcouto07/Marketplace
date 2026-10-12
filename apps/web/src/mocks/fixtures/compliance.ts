import type {
  ComplianceOccurrenceDto,
  EnforcementActionDto,
  MonitoringAlertDto,
  ProductReportDto,
  SellerDto,
} from "@marketplace/contracts";

import type { StoredNotice, StoredRfInteraction } from "../db";
import { ADMIN_USER, DEMO_USER } from "./account";
import { SELLERS, categoryBySlug, guid, isoDaysAgo, isoDaysFromNow } from "./base";
import { SEED_DATA } from "./orders";
import { PRODUCTS } from "./products";
import {
  INITIAL_SELLER_POLICY_VERSION,
  KYC_ARTICLES_URL,
  KYC_IDENTITY_URL,
  KYC_RUC_URL,
  KYC_TAX_CERTIFICATE_URL,
  type SellerKyc,
} from "./remessa";

/**
 * Dados de conformidade da demo, iguais aos do seed da API (SeedDemo.Compliance): duas ocorrências do despacho, duas
 * denúncias abertas (uma pelo canal público), um produto em análise por preço e uma loja com cadastro completo
 * aguardando a conferência da equipe. Mais uma comunicação aberta para a loja da conta de vendedor, um alerta de
 * monitoramento, a consulta mensal dos indicadores e o registro das ações já tomadas.
 */

const productByName = (prefix: string) => {
  const product = PRODUCTS.find((p) => p.name.startsWith(prefix));
  if (!product) throw new Error(`Produto seed não encontrado: ${prefix}`);
  return product;
};

const eletronicos = categoryBySlug("eletronicos")!;

export const PENDING_SELLER: SellerDto = {
  id: guid("seller:eletro-ponte"),
  slug: "eletro-ponte-import",
  name: "Eletro Ponte Import",
  logoUrl: null,
  reputationLevel: 3,
  isOfficialStore: false,
  city: "Ciudad del Este",
  description: "Eletrônicos e acessórios com nota de importação e garantia de 6 meses.",
  ruc: "80090123-7",
  country: "PY",
  memberSince: isoDaysAgo(1),
  rating: 0,
  reviewCount: 0,
  productCount: 0,
  metrics: { salesCount: 0, positiveRatingPercent: 0, onTimeShippingPercent: 0, avgResponseTimeHours: 0 },
  exchangePolicy:
    "Trocas e devoluções em até 30 dias após o recebimento para produtos lacrados ou com defeito de fabricação.",
  bannerUrl: null,
  categories: [{ id: eletronicos.id, slug: eletronicos.slug, name: eletronicos.name }],
};

/** Cadastro completo (Política 3.1 e 3.2) e Política aceita: aguarda só a conferência da equipe (3.3). */
export const PENDING_SELLER_KYC: SellerKyc = {
  legalName: "Eletro Ponte Import S.R.L.",
  email: "contato@eletroponte.com.py",
  phone: "+595 61 512 300",
  legalAddress: "Av. San Blas 455, Km 4",
  payoutMethod: "CarteiraDigital",
  payoutInstitution: "Tigo Money",
  payoutAccount: "0981512300",
  payoutHolder: "Eletro Ponte Import S.R.L.",
  responsibleName: "Fabián Ramírez",
  responsibleDocumentType: "CedulaPy",
  responsibleDocument: "4512398",
  identityDocumentUrl: KYC_IDENTITY_URL,
  rucCertificateUrl: KYC_RUC_URL,
  taxComplianceCertificateUrl: KYC_TAX_CERTIFICATE_URL,
  articlesOfIncorporationUrl: KYC_ARTICLES_URL,
  checklist: [],
  verifiedAt: null,
  suspensionReason: null,
  suspendedUntil: null,
  policyVersionAccepted: INITIAL_SELLER_POLICY_VERSION,
  policyAcceptedAt: isoDaysAgo(1),
  dataConfirmedAt: isoDaysAgo(1),
};

/** Soma dias úteis (segunda a sexta), como ProgramDeadlines.AddBusinessDays. */
export function addBusinessDays(iso: string, days: number): string {
  const d = new Date(iso);
  let remaining = days;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return d.toISOString();
}

export function seedOccurrences(): ComplianceOccurrenceDto[] {
  const first = SEED_DATA.orders.find((o) => o.shipment)!;
  const moda = SELLERS.find((s) => s.slug === "moda-guarani")!;
  const watch = productByName("Relógio analógico");
  return [
    {
      id: guid("occurrence:seed:1"),
      indicator: "QualidadeDeclaracao",
      source: "Siscomex",
      status: "Confirmada",
      code: "CPF_DESTINATARIO",
      description: `CPF do destinatário divergente do cadastro (remessa ${first.trackingCode}).`,
      sellerId: first.seller.id,
      sellerName: first.seller.name,
      productId: null,
      productName: null,
      orderId: first.id,
      orderNumber: first.number,
      externalId: "oc:seed-1",
      occurredAt: isoDaysAgo(18, 11),
      registeredAt: isoDaysAgo(18, 12),
      statusReason: null,
    },
    {
      id: guid("occurrence:seed:2"),
      indicator: "Subvaloracao",
      source: "Despacho",
      status: "Confirmada",
      code: "VALOR_MAJORADO",
      description: "Valor declarado aumentado pela fiscalização em Curitiba.",
      sellerId: moda.id,
      sellerName: moda.name,
      productId: watch.id,
      productName: watch.name,
      orderId: null,
      orderNumber: null,
      externalId: "trk:seed-2",
      occurredAt: isoDaysAgo(40, 15),
      registeredAt: isoDaysAgo(40, 16),
      statusReason: null,
    },
  ];
}

export function seedReports(): ProductReportDto[] {
  const glasses = productByName("Óculos de sol");
  const perfume = productByName("Perfume oriental");
  const report = (
    key: string,
    protocol: string,
    product: typeof glasses,
    reason: ProductReportDto["reason"],
    details: string,
    createdAt: string,
    reporter: Partial<ProductReportDto>,
  ): ProductReportDto => ({
    id: guid(key),
    productId: product.id,
    productName: product.name,
    productSlug: product.slug,
    productStatus: "Ativo",
    sellerId: product.seller.id,
    sellerName: product.seller.name,
    reason,
    details,
    status: "Aberta",
    createdAt,
    reporterEmail: null,
    resolvedAt: null,
    resolutionNote: null,
    occurrenceId: null,
    protocol,
    channel: "PaginaDoProduto",
    reporterName: null,
    isRightsHolder: false,
    rightsHolderName: null,
    evidenceUrls: [],
    // Política 6.5: decisão em até 2 dias úteis do recebimento.
    dueAt: addBusinessDays(createdAt, 2),
    overdue: false,
    ...reporter,
  });
  return [
    report(
      "report:seed:1",
      "DEN-2026-000001",
      glasses,
      "Falsificado",
      "A armação veio sem a gravação da marca e a lente não é polarizada como anunciado.",
      isoDaysAgo(2, 10),
      { reporterEmail: DEMO_USER.email, reporterName: DEMO_USER.fullName },
    ),
    report(
      "report:seed:2",
      "DEN-2026-000002",
      perfume,
      "PrecoSuspeito",
      "Preço muito abaixo do que se encontra em outras lojas para o mesmo frasco.",
      isoDaysAgo(1, 16),
      { channel: "CanalPublico", reporterName: "Rafaela Moura", reporterEmail: "rafaela.moura@example.com" },
    ),
  ];
}

/** "Miniatura decant" nasce em análise: preço abaixo de 40% da mediana do mesmo NCM. */
export function seedModeration() {
  const decant = productByName("Miniatura decant");
  return {
    [decant.id]: {
      status: "EmAnalise" as const,
      moderationReason: "PRECO_ABAIXO_REFERENCIA",
      moderationNote:
        "Preço abaixo de 40% da mediana de produtos com o mesmo NCM. Risco de subvaloração na declaração.",
      updatedAt: isoDaysAgo(1, 9),
    },
  };
}

/** Pedido de documentos aberto para a loja da conta de vendedor (Política 4.6): mostra o fluxo de resposta. */
export function seedNotices(): StoredNotice[] {
  const seller = SELLERS.find((s) => s.slug === "tecnocentro-cde")!;
  const order = SEED_DATA.orders.find((o) => o.seller.id === seller.id);
  const createdAt = isoDaysFromNow(-3);
  return [
    {
      id: guid("notice:seed:1"),
      sellerId: seller.id,
      sellerName: seller.name,
      type: "SolicitacaoDocumentos",
      status: "Aberta",
      documentKind: "ValorDaOperacao",
      title: "Pedido de documentos — valor da operação",
      message:
        `Envie a nota fiscal de aquisição ou outro documento que comprove o valor da operação${order ? ` do pedido ${order.number}` : ""}. ` +
        "Os documentos ficam com o pedido e podem ser apresentados à Receita Federal (Política de Vendedores, item 4.6).",
      productId: null,
      productName: null,
      productSlug: null,
      orderId: order?.id ?? null,
      orderNumber: order?.number ?? null,
      measureId: null,
      createdAt,
      dueAt: isoDaysFromNow(7),
      readAt: null,
      responseText: null,
      responseFiles: [],
      respondedAt: null,
      resolution: null,
      resolvedAt: null,
    },
  ];
}

/** Alerta de preço muito abaixo de produto equivalente (Política 7.3 d) para a equipe julgar. */
export function seedAlerts(): MonitoringAlertDto[] {
  const decant = productByName("Miniatura decant");
  return [
    {
      id: guid("alert:seed:1"),
      type: "PrecoMuitoAbaixo",
      status: "Aberto",
      sellerId: decant.seller.id,
      sellerName: decant.seller.name,
      buyerUserId: null,
      buyerEmail: null,
      summary: `"${decant.name}" anunciado abaixo de 40% da mediana dos produtos com o mesmo NCM.`,
      orderNumbers: [],
      holdsShipments: false,
      detectedAt: isoDaysAgo(1, 9),
      attribution: null,
      resolutionNote: null,
      resolvedAt: null,
    },
  ];
}

/** Consulta mensal dos indicadores do mês anterior (Programa 11.2), já registrada. */
export function seedRfInteractions(): StoredRfInteraction[] {
  const at = isoDaysAgo(20, 14);
  const d = new Date(at);
  return [
    {
      id: guid("rf:seed:1"),
      type: "ConsultaMensal",
      status: "Concluida",
      title: `Consulta mensal dos indicadores — ${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`,
      description: "Indicadores consultados no Portal Único Siscomex.",
      reference: null,
      openedAt: at,
      dueAt: null,
      indicator: null,
      contestationReason: null,
      occurrenceIds: [],
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      officialCounterfeitPermyriad: 9985,
      officialUndervaluationPermyriad: 9971,
      officialDeclarationQualityPermyriad: 9942,
      response: "Qualidade da declaração na faixa Prata: reforçada a conferência do CPF do destinatário no checkout.",
      attachments: [],
      completedAt: at,
      completedBy: ADMIN_USER.email,
      createdAt: at,
      createdBy: ADMIN_USER.email,
    },
  ];
}

/** Registro das ações contra produtos ilegais já tomadas na demo (Programa 8.9; Política 6.8). */
export function seedActions(): EnforcementActionDto[] {
  const decant = productByName("Miniatura decant");
  const glasses = productByName("Óculos de sol");
  const perfume = productByName("Perfume oriental");
  return [
    {
      id: 3,
      kind: "DenunciaRecebida",
      occurredAt: isoDaysAgo(1, 16),
      automatic: true,
      actorEmail: null,
      sellerId: perfume.seller.id,
      sellerName: perfume.seller.name,
      productId: perfume.id,
      productName: perfume.name,
      reportId: guid("report:seed:2"),
      reason: "Preço suspeito (canal público, protocolo DEN-2026-000002).",
      result: "Em análise; decisão em até 2 dias úteis.",
    },
    {
      id: 2,
      kind: "AnuncioEmAnalise",
      occurredAt: isoDaysAgo(1, 9),
      automatic: true,
      actorEmail: null,
      sellerId: decant.seller.id,
      sellerName: decant.seller.name,
      productId: decant.id,
      productName: decant.name,
      reportId: null,
      reason: "Preço abaixo de 40% da mediana de produtos com o mesmo NCM.",
      result: "Anúncio fora da vitrine até a decisão da equipe.",
    },
    {
      id: 1,
      kind: "DenunciaRecebida",
      occurredAt: isoDaysAgo(2, 10),
      automatic: true,
      actorEmail: null,
      sellerId: glasses.seller.id,
      sellerName: glasses.seller.name,
      productId: glasses.id,
      productName: glasses.name,
      reportId: guid("report:seed:1"),
      reason: "Produto falsificado (página do produto, protocolo DEN-2026-000001).",
      result: "Em análise; decisão em até 2 dias úteis.",
    },
  ];
}
