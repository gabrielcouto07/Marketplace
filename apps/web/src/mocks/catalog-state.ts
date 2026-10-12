import type {
  ProductDetailDto,
  ProductStatus,
  SellerDto,
  SellerStatus,
  SellerSummaryDto,
  SellerVerificationDto,
} from "@marketplace/contracts";

import { convert, discountPercent } from "@/lib/money";

import { db } from "./db";
import { EXCHANGE_RATES, SELLERS, categoryById, getRate, toSellerSummary } from "./fixtures/base";
import {
  PRODUCT_DECLARATION,
  PRODUCT_NCM,
  PRODUCT_RECORDS,
  PRODUCTS,
  type ProductDeclaration,
  type ProductRecord,
} from "./fixtures/products";
import { EMPTY_KYC, type SellerKyc, maskAccount, maskDocument, seedSellerKyc } from "./fixtures/remessa";

/**
 * Catálogo "vivo" do mock: fixtures determinísticas + o que os painéis (vendedor/admin) alteraram
 * ou criaram, tudo persistido em `db`. Os handlers públicos (home, busca, produto, loja, checkout)
 * leem daqui, então uma edição no painel aparece na vitrine na hora.
 */

// Cotações criadas no admin entram na frente das fixas: `getRate` usa a primeira que casar.
for (const rate of db.customRates) {
  if (!EXCHANGE_RATES.some((r) => r.id === rate.id)) EXCHANGE_RATES.unshift(rate);
}

// ---------------------------------------------------------------------------
// Lojas
// ---------------------------------------------------------------------------

export function applySellerOverride(seller: SellerDto): SellerDto {
  const o = db.sellerOverrides[seller.id];
  if (!o) return seller;
  const categories = o.categoryIds
    ? o.categoryIds
        .map((id) => categoryById(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => ({ id: c.id, slug: c.slug, name: c.name }))
    : seller.categories;
  return {
    ...seller,
    name: o.name ?? seller.name,
    city: o.city ?? seller.city,
    description: o.description ?? seller.description,
    reputationLevel: o.reputationLevel ?? seller.reputationLevel,
    isOfficialStore: o.isOfficialStore ?? seller.isOfficialStore,
    logoUrl: o.logoUrl === undefined ? seller.logoUrl : o.logoUrl,
    bannerUrl: o.bannerUrl === undefined ? seller.bannerUrl : o.bannerUrl,
    exchangePolicy: o.exchangePolicy ?? seller.exchangePolicy,
    categories,
  };
}

/** Todas as lojas (fixas + cadastradas no painel), com ajustes aplicados. */
export function allSellers(): SellerDto[] {
  return [...SELLERS, ...db.customSellers].map(applySellerOverride);
}

/** Lojas fixas nascem aprovadas; as cadastradas no painel aguardam aprovação do admin. */
export function sellerStatus(sellerId: string): SellerStatus {
  return (
    db.sellerOverrides[sellerId]?.status ??
    (db.customSellers.some((s) => s.id === sellerId) ? "Pendente" : "Aprovado")
  );
}

/** Documentos da loja: o que foi enviado no painel ou, nas lojas fixas, o seed (já conferido pela equipe). */
export function sellerKyc(sellerId: string): SellerKyc {
  const stored = db.sellerKyc[sellerId];
  if (stored) return stored;
  const index = SELLERS.findIndex((s) => s.id === sellerId);
  return index >= 0 ? seedSellerKyc(SELLERS[index], index) : EMPTY_KYC;
}

/** Telefone da loja: o do perfil (painel) ou o do cadastro. */
export function sellerPhone(sellerId: string): string | null {
  return db.sellerOverrides[sellerId]?.phone ?? sellerKyc(sellerId).phone ?? null;
}

const RUC_PATTERN = /^\d{6,8}-\d$/;

/** O que falta do cadastro (Política de Vendedores 3.1 e 3.2), com os rótulos da API. */
export function missingAdmissionData(sellerId: string): string[] {
  const k = sellerKyc(sellerId);
  const seller = findSellerById(sellerId);
  const missing: string[] = [];
  if (!k.legalName?.trim()) missing.push("Denominação social");
  if (!k.legalAddress?.trim()) missing.push("Endereço");
  if (!sellerPhone(sellerId)?.trim()) missing.push("Telefone");
  if (!k.email?.trim()) missing.push("E-mail");
  if (!seller || !RUC_PATTERN.test(seller.ruc)) missing.push("RUC válido");
  if (!k.payoutMethod || !k.payoutAccount || !k.payoutHolder) missing.push("Meio de pagamento");
  if (!k.responsibleName || !k.responsibleDocumentType || !k.responsibleDocument) missing.push("Representante legal");
  if (!k.identityDocumentUrl) missing.push("Documento do representante");
  if (!k.rucCertificateUrl) missing.push("Constancia de RUC");
  if (!k.taxComplianceCertificateUrl) missing.push("Certificado de Cumplimiento Tributario");
  if (!k.articlesOfIncorporationUrl) missing.push("Atos constitutivos e registro comercial");
  return missing;
}

/** Documento privado (`doc/…`) volta como link "assinado" do mock; exemplos públicos voltam como estão. */
export function documentLink(reference: string | null): string | null {
  if (!reference) return null;
  return reference.startsWith("doc/") ? `/api/documents/${reference}?t=mock` : reference;
}

/** Cadastro da loja na Política de Vendedores (3.1 e 3.2): documento e conta mascarados, arquivos por link. */
export function sellerVerification(sellerId: string): SellerVerificationDto {
  const k = sellerKyc(sellerId);
  const missing = missingAdmissionData(sellerId);
  const keys: Record<string, string> = {};
  const docs = {
    identityDocumentUrl: k.identityDocumentUrl,
    rucCertificateUrl: k.rucCertificateUrl,
    taxComplianceCertificateUrl: k.taxComplianceCertificateUrl,
    articlesOfIncorporationUrl: k.articlesOfIncorporationUrl,
  };
  for (const [field, value] of Object.entries(docs)) if (value) keys[field] = value;
  return {
    legalAddress: k.legalAddress,
    responsibleName: k.responsibleName,
    responsibleDocumentType: k.responsibleDocumentType,
    responsibleDocumentMasked: maskDocument(k.responsibleDocument),
    identityDocumentUrl: documentLink(k.identityDocumentUrl),
    rucCertificateUrl: documentLink(k.rucCertificateUrl),
    complete: missing.length === 0,
    verifiedAt: k.verifiedAt,
    suspensionReason: k.suspensionReason,
    taxComplianceCertificateUrl: documentLink(k.taxComplianceCertificateUrl),
    articlesOfIncorporationUrl: documentLink(k.articlesOfIncorporationUrl),
    payoutMethod: k.payoutMethod,
    payoutInstitution: k.payoutInstitution,
    payoutAccountMasked: maskAccount(k.payoutAccount),
    payoutHolder: k.payoutHolder,
    admissionComplete: missing.length === 0,
    missingAdmissionData: missing,
    checklist: k.checklist,
    policyVersionAccepted: k.policyVersionAccepted,
    policyAcceptedAt: k.policyAcceptedAt,
    dataConfirmedAt: k.dataConfirmedAt,
    suspendedUntil: k.suspendedUntil,
    documentKeys: keys,
  };
}

export const findSellerBySlug = (slug: string) => allSellers().find((s) => s.slug === slug);
export const findSellerById = (id: string) => allSellers().find((s) => s.id === id);

function sellerSummaryFor(summary: SellerSummaryDto): SellerSummaryDto {
  const seller = findSellerById(summary.id);
  return seller ? toSellerSummary(seller) : summary;
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

export function productStatus(productId: string): ProductStatus {
  return db.productOverrides[productId]?.status ?? "Ativo";
}

/** NCM do produto: o que o vendedor salvou (mesmo vazio) ou o do catálogo fixo. */
export function productNcm(productId: string): string | null {
  const override = db.productOverrides[productId];
  if (override && "hsCode" in override) return override.hsCode ?? null;
  return PRODUCT_NCM[productId] ?? null;
}

/** Descrição da declaração (Programa 7.4 e 7.6): o que o vendedor salvou ou a do catálogo fixo. */
export function productDeclaration(productId: string): ProductDeclaration | null {
  const o = db.productOverrides[productId];
  if (o && "nature" in o)
    return {
      nature: o.nature ?? "",
      brand: o.brand ?? null,
      unbranded: o.unbranded ?? false,
      model: o.model ?? null,
      material: o.material ?? "",
      packageQuantity: o.packageQuantity ?? 1,
      originCountry: o.originCountry ?? "",
    };
  return PRODUCT_DECLARATION[productId] ?? null;
}

export function applyProductOverride(product: ProductDetailDto): ProductDetailDto {
  const o = db.productOverrides[product.id];
  const seller = sellerSummaryFor(product.seller);
  if (!o) return product.seller === seller ? product : { ...product, seller };

  const price =
    o.priceAmount !== undefined ? { ...product.price, amount: o.priceAmount } : product.price;
  const compareAt =
    o.compareAtAmount === undefined
      ? product.compareAtPrice
      : o.compareAtAmount === null
        ? null
        : { currency: product.price.currency, amount: o.compareAtAmount };
  const images = o.images
    ? o.images.map((img, i) => ({
        id: `${product.id}:img:${i + 1}`,
        url: img.url,
        alt: img.alt || (o.name ?? product.name),
        sortOrder: i + 1,
      }))
    : product.images;
  const category = o.categoryId ? categoryById(o.categoryId) : undefined;
  const discount = discountPercent(price, compareAt);

  return {
    ...product,
    seller,
    name: o.name ?? product.name,
    description: o.description ?? product.description,
    price,
    compareAtPrice: compareAt,
    referencePrice: convert(price, getRate("BRL", "PYG")),
    discountPercent: discount,
    isOffer: discount >= 15,
    stock: o.stock ?? product.stock,
    freeShipping: o.freeShipping ?? product.freeShipping,
    warrantyMonths: o.warrantyMonths === undefined ? product.warrantyMonths : o.warrantyMonths,
    handlingDays: o.handlingDays ?? product.handlingDays,
    attributes: o.attributes ?? product.attributes,
    images,
    thumbnailUrl: images[0]?.url ?? product.thumbnailUrl,
    categoryId: category?.id ?? product.categoryId,
    categoryPath: category
      ? [{ id: category.id, slug: category.slug, name: category.name }]
      : product.categoryPath,
    originCountry: "nature" in o ? (o.originCountry ?? null) : product.originCountry,
    brand: "nature" in o ? (o.unbranded ? null : (o.brand ?? null)) : product.brand,
    model: "nature" in o ? (o.model ?? null) : product.model,
  };
}

/** Todos os produtos (fixos + criados), em qualquer status, com ajustes aplicados. */
export function allProducts(): ProductDetailDto[] {
  return [...PRODUCTS, ...db.customProducts].map(applyProductOverride);
}

/** O que a vitrine mostra: produtos ativos de lojas que podem vender (nem suspensas nem excluídas). */
export function catalogProducts(): ProductDetailDto[] {
  return allProducts().filter((p) => {
    const status = sellerStatus(p.seller.id);
    return productStatus(p.id) === "Ativo" && status !== "Suspenso" && status !== "Excluido";
  });
}

export const findProduct = (idOrSlug: string) =>
  allProducts().find((p) => p.id === idOrSlug || p.slug === idOrSlug);

const EMPTY_SUMMARY = {
  average: 0,
  total: 0,
  distribution: [0, 0, 0, 0, 0] as [number, number, number, number, number],
};

/** Registro completo (detalhe + avaliações + perguntas); produtos criados no painel nascem sem histórico. */
export function findProductRecord(id: string): ProductRecord | undefined {
  const fixed = PRODUCT_RECORDS.find((r) => r.detail.id === id);
  if (fixed) return { ...fixed, detail: applyProductOverride(fixed.detail) };
  const custom = db.customProducts.find((p) => p.id === id);
  if (!custom) return undefined;
  return {
    detail: applyProductOverride(custom),
    reviews: [],
    reviewSummary: { ...EMPTY_SUMMARY, distribution: [...EMPTY_SUMMARY.distribution] },
    questions: [],
  };
}

export function findProductRecordBySlug(slug: string): ProductRecord | undefined {
  const match = allProducts().find((p) => p.slug === slug);
  return match ? findProductRecord(match.id) : undefined;
}
