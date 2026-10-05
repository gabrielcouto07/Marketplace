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
import { PRODUCT_NCM, PRODUCT_RECORDS, PRODUCTS, type ProductRecord } from "./fixtures/products";
import { EMPTY_KYC, type SellerKyc, maskDocument, seedSellerKyc } from "./fixtures/remessa";

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

/** Política de admissão (critério v): responsável, documento, constância do RUC e endereço de origem. */
export function sellerVerification(sellerId: string): SellerVerificationDto {
  const k = sellerKyc(sellerId);
  return {
    legalAddress: k.legalAddress,
    responsibleName: k.responsibleName,
    responsibleDocumentType: k.responsibleDocumentType,
    responsibleDocumentMasked: maskDocument(k.responsibleDocument),
    identityDocumentUrl: k.identityDocumentUrl,
    rucCertificateUrl: k.rucCertificateUrl,
    complete: Boolean(
      k.legalAddress &&
        k.responsibleName &&
        k.responsibleDocumentType &&
        k.responsibleDocument &&
        k.identityDocumentUrl &&
        k.rucCertificateUrl,
    ),
    verifiedAt: k.verifiedAt,
    suspensionReason: k.suspensionReason,
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
  };
}

/** Todos os produtos (fixos + criados), em qualquer status, com ajustes aplicados. */
export function allProducts(): ProductDetailDto[] {
  return [...PRODUCTS, ...db.customProducts].map(applyProductOverride);
}

/** O que a vitrine mostra: produtos ativos de lojas não suspensas. */
export function catalogProducts(): ProductDetailDto[] {
  return allProducts().filter(
    (p) => productStatus(p.id) === "Ativo" && sellerStatus(p.seller.id) !== "Suspenso",
  );
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
