import type { ComplianceOccurrenceDto, ProductReportDto, SellerDto } from "@marketplace/contracts";

import { DEMO_USER } from "./account";
import { SELLERS, categoryBySlug, guid, isoDaysAgo } from "./base";
import { SEED_DATA } from "./orders";
import { PRODUCTS } from "./products";
import { KYC_IDENTITY_URL, KYC_RUC_URL, type SellerKyc } from "./remessa";

/**
 * Dados de conformidade da demo, iguais aos do seed da API (SeedDemo.Compliance): duas ocorrências do despacho, duas
 * denúncias abertas, um produto em análise por preço e uma loja aguardando a verificação de documentos.
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

export const PENDING_SELLER_KYC: SellerKyc = {
  legalAddress: "Av. San Blas 455, Km 4",
  responsibleName: "Fabián Ramírez",
  responsibleDocumentType: "CedulaPy",
  responsibleDocument: "4512398",
  identityDocumentUrl: KYC_IDENTITY_URL,
  rucCertificateUrl: KYC_RUC_URL,
  verifiedAt: null,
  suspensionReason: null,
};

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
    product: typeof glasses,
    reason: ProductReportDto["reason"],
    details: string,
    createdAt: string,
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
    reporterEmail: DEMO_USER.email,
    resolvedAt: null,
    resolutionNote: null,
    occurrenceId: null,
  });
  return [
    report(
      "report:seed:1",
      glasses,
      "Falsificado",
      "A armação veio sem a gravação da marca e a lente não é polarizada como anunciado.",
      isoDaysAgo(2, 10),
    ),
    report(
      "report:seed:2",
      perfume,
      "PrecoSuspeito",
      "Preço muito abaixo do que se encontra em outras lojas para o mesmo frasco.",
      isoDaysAgo(1, 16),
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
