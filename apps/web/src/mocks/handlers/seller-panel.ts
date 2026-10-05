import type {
  OrderStatus,
  PresignedUploadDto,
  ProductDetailDto,
  ProductStatus,
  SellerDashboardDto,
  SellerDto,
  SellerProductDto,
  SellerProductInput,
  SellerProductListItemDto,
  SellerProfileDto,
  SellerProfileInput,
  SellerRegisterRequest,
  SellerRegisterResponseDto,
  ShipOrderRequest,
  UploadRequest,
} from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { getApiBaseUrl } from "@/lib/api/http";
import { convert, discountPercent, formatMoney, sum } from "@/lib/money";
import { isValidCpf } from "@/lib/validation/documents";

import {
  allProducts,
  findProduct,
  findSellerBySlug,
  productNcm,
  productStatus,
  sellerKyc,
  sellerStatus,
  sellerVerification,
} from "../catalog-state";
import { db, persistDb } from "../db";
import { categoryById, getRate, slugify, toSellerSummary } from "../fixtures/base";
import {
  NCM_TABLE,
  type SellerKyc,
  findProtectedBrand,
  normalizeResponsibleDocument,
  validateNcm,
} from "../fixtures/remessa";
import { issueSession } from "./auth";
import { audit, currentSeller, isResponse, requireSeller } from "./guards";
import { advanceOrder, settlePendingPayments } from "./orders";
import { markShipmentPosted, withShipment } from "./remessa";
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

const CITIES = [
  "Ciudad del Este",
  "Asunción",
  "Salto del Guairá",
  "Pedro Juan Caballero",
  "Encarnación",
  "Hernandarias",
  "Presidente Franco",
];

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Orçamento total de uploads guardados em base64 no localStorage. */
const UPLOAD_BUDGET_BYTES = 3 * 1024 * 1024;

/** CEP/código postal de origem (4 a 10 dígitos) e telefone (8 a 15 dígitos), ambos opcionais. */
function validateContact(body: SellerProfileInput): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const cep = body.originPostalCode?.replace(/\D/g, "") ?? "";
  if (body.originPostalCode?.trim() && (cep.length < 4 || cep.length > 10))
    errors.originPostalCode = ["Código postal inválido."];
  const phone = body.phone?.replace(/\D/g, "") ?? "";
  if (body.phone?.trim() && (phone.length < 8 || phone.length > 15))
    errors.phone = ["Telefone inválido."];
  return errors;
}

const isUploadUrl = (url: string | null) =>
  Boolean(url) && url!.length <= 1024 && (url!.startsWith("/") || url!.toLowerCase().startsWith("http"));

/**
 * Política de admissão (Portaria Coana 130/2023, art. 8º, V): endereço de origem, responsável, documento e constância
 * do RUC, com as mensagens da API. No perfil o documento volta mascarado: vazio mantém o atual.
 */
function validateKyc(
  body: SellerProfileInput,
  existing: SellerKyc | null,
): { kyc: SellerKyc } | { errors: Record<string, string[]> } {
  const legalAddress = body.legalAddress?.trim() ?? "";
  const responsibleName = body.responsibleName?.trim() ?? "";
  const type = body.responsibleDocumentType ?? existing?.responsibleDocumentType ?? null;
  const keep =
    !body.responsibleDocument?.trim() &&
    existing?.responsibleDocument &&
    type === existing.responsibleDocumentType;
  const document = keep
    ? existing!.responsibleDocument
    : type
      ? normalizeResponsibleDocument(type, body.responsibleDocument, isValidCpf)
      : null;
  const identityDocumentUrl = body.identityDocumentUrl?.trim() || null;
  const rucCertificateUrl = body.rucCertificateUrl?.trim() || null;
  const errors: Record<string, string[]> = {};
  if (legalAddress.length < 10 || legalAddress.length > 300)
    errors.legalAddress = [
      "Informe o endereço completo de onde os pacotes saem (rua, número e bairro).",
    ];
  if (responsibleName.length < 5 || responsibleName.length > 160)
    errors.responsibleName = ["Informe o nome completo do responsável pela loja."];
  if (!type) errors.responsibleDocumentType = ["Escolha o tipo de documento do responsável."];
  else if (!document) errors.responsibleDocument = ["Documento do responsável inválido."];
  if (!isUploadUrl(identityDocumentUrl))
    errors.identityDocumentUrl = ["Envie a foto do documento do responsável."];
  if (!isUploadUrl(rucCertificateUrl)) errors.rucCertificateUrl = ["Envie a constância do RUC."];
  if (Object.keys(errors).length) return { errors };
  // Documento ou comprovantes novos exigem nova verificação da equipe.
  const changed =
    document !== existing?.responsibleDocument ||
    identityDocumentUrl !== existing?.identityDocumentUrl ||
    rucCertificateUrl !== existing?.rucCertificateUrl;
  return {
    kyc: {
      legalAddress,
      responsibleName,
      responsibleDocumentType: type,
      responsibleDocument: document,
      identityDocumentUrl,
      rucCertificateUrl,
      verifiedAt: changed ? null : (existing?.verifiedAt ?? null),
      suspensionReason: existing?.suspensionReason ?? null,
    },
  };
}

const AUTOMATIC_REASONS = new Set(["MARCA_PROTEGIDA", "PRECO_ABAIXO_REFERENCIA"]);

/** Mediana do preço dos produtos ativos com o mesmo NCM (mín. 3); senão, da mesma posição de 4 dígitos. */
function referencePrice(productId: string, ncm: string): number | null {
  const active = allProducts().filter((p) => p.id !== productId && productStatus(p.id) === "Ativo");
  let prices = active.filter((p) => productNcm(p.id) === ncm).map((p) => p.price.amount);
  if (prices.length < 3)
    prices = active
      .filter((p) => productNcm(p.id)?.startsWith(ncm.slice(0, 4)))
      .map((p) => p.price.amount);
  if (prices.length < 3) return null;
  prices.sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 ? prices[mid] : Math.floor((prices[mid - 1] + prices[mid]) / 2);
}

/**
 * Status final de um produto salvo (como `ComplianceService.DecideListingAsync`): bloqueado continua bloqueado; marca
 * protegida ou preço muito abaixo da mediana do mesmo NCM vão para análise, a não ser que o admin já tenha liberado
 * este nome e preço.
 */
function decideListing(
  productId: string,
  name: string,
  priceAmount: number,
  ncm: string | null,
  requested: SellerProductInput["status"],
): { status: ProductStatus; moderationReason: string | null; moderationNote: string | null } {
  const current = db.productOverrides[productId];
  if (current?.status === "Bloqueado")
    return {
      status: "Bloqueado",
      moderationReason: current.moderationReason ?? null,
      moderationNote: current.moderationNote ?? null,
    };
  if (requested === "Rascunho") return { status: "Rascunho", moderationReason: null, moderationNote: null };
  const approved =
    current?.approvedName === name &&
    current.approvedPriceAmount != null &&
    priceAmount * 10 >= current.approvedPriceAmount * 9;
  if (!approved) {
    const brand = findProtectedBrand(name, db.settings.protectedBrands);
    if (brand)
      return {
        status: "EmAnalise",
        moderationReason: "MARCA_PROTEGIDA",
        moderationNote: `Marca ${brand}: a equipe confere a origem (nota de compra ou autorização do distribuidor) antes de publicar.`,
      };
    const median = ncm ? referencePrice(productId, ncm) : null;
    if (median !== null && priceAmount * 100 < median * db.settings.priceFloorPercent)
      return {
        status: "EmAnalise",
        moderationReason: "PRECO_ABAIXO_REFERENCIA",
        moderationNote: `Preço abaixo de ${db.settings.priceFloorPercent}% da mediana (${formatMoney({ amount: median, currency: "BRL" }, { locale: "pt-BR" })}) de produtos com o mesmo NCM. Risco de subvaloração na declaração.`,
      };
  }
  // Análise aberta por denúncia ou pela equipe só sai pelo admin.
  if (
    current?.status === "EmAnalise" &&
    current.moderationReason &&
    !AUTOMATIC_REASONS.has(current.moderationReason) &&
    !approved
  )
    return {
      status: "EmAnalise",
      moderationReason: current.moderationReason,
      moderationNote: current.moderationNote ?? null,
    };
  return { status: "Ativo", moderationReason: null, moderationNote: null };
}

function productsOf(sellerId: string): ProductDetailDto[] {
  return allProducts().filter((p) => p.seller.id === sellerId);
}

function toProfile(seller: SellerDto): SellerProfileDto {
  const override = db.sellerOverrides[seller.id];
  return {
    id: seller.id,
    slug: seller.slug,
    name: seller.name,
    logoUrl: seller.logoUrl,
    bannerUrl: seller.bannerUrl,
    city: seller.city,
    description: seller.description,
    ruc: seller.ruc,
    exchangePolicy: seller.exchangePolicy,
    status: sellerStatus(seller.id),
    reputationLevel: seller.reputationLevel,
    isOfficialStore: seller.isOfficialStore,
    rating: seller.rating,
    reviewCount: seller.reviewCount,
    productCount: productsOf(seller.id).filter((p) => productStatus(p.id) !== "Arquivado").length,
    memberSince: seller.memberSince,
    categories: seller.categories,
    originPostalCode: override?.originPostalCode ?? null,
    phone: override?.phone ?? null,
    verification: sellerVerification(seller.id),
  };
}

function updatedAtOf(p: ProductDetailDto): string {
  return db.productOverrides[p.id]?.updatedAt ?? p.createdAt;
}

function toListItem(p: ProductDetailDto): SellerProductListItemDto {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    thumbnailUrl: p.thumbnailUrl,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    stock: p.stock,
    status: productStatus(p.id),
    soldCount: p.soldCount,
    updatedAt: updatedAtOf(p),
    moderationReason: db.productOverrides[p.id]?.moderationReason ?? null,
    hsCode: productNcm(p.id),
  };
}

function toSellerProduct(p: ProductDetailDto): SellerProductDto {
  const override = db.productOverrides[p.id];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    stock: p.stock,
    freeShipping: p.freeShipping,
    warrantyMonths: p.warrantyMonths,
    handlingDays: p.handlingDays,
    weightGrams: override?.weightGrams ?? null,
    dimensions: override?.dimensions ?? null,
    hsCode: productNcm(p.id),
    hsCodeDescription: NCM_TABLE[productNcm(p.id) ?? ""] ?? null,
    moderationReason: override?.moderationReason ?? null,
    moderationNote: override?.moderationNote ?? null,
    attributes: p.attributes,
    images: p.images.map((img, i) => ({
      id: img.id,
      url: img.url,
      alt: img.alt,
      sortOrder: img.sortOrder,
      storageKey: override?.images?.[i]?.storageKey ?? null,
    })),
    status: productStatus(p.id),
    soldCount: p.soldCount,
    rating: p.rating,
    reviewCount: p.reviewCount,
    createdAt: p.createdAt,
    updatedAt: updatedAtOf(p),
  };
}

function validateProduct(body: SellerProductInput) {
  const errors: Record<string, string[]> = {};
  if (!body.name || body.name.trim().length < 5)
    errors.name = ["Informe um título com pelo menos 5 caracteres."];
  const listed = body.status === "Ativo";
  const description = body.description?.trim() ?? "";
  if (description.length < 20) errors.description = ["Descreva o produto com pelo menos 20 caracteres."];
  else if (listed && description.length < 40)
    errors.description = [
      "Para publicar, descreva o produto com pelo menos 40 caracteres (a descrição vai na declaração de importação).",
    ];
  const category = body.categoryId ? categoryById(body.categoryId) : undefined;
  if (!category) errors.categoryId = ["Escolha uma categoria."];
  else {
    // NCM obrigatório para publicar, conferido na tabela oficial (formato, capítulo proibido e categoria).
    const ncm = validateNcm(body.hsCode, category.slug, listed);
    if ("error" in ncm) errors.hsCode = [ncm.error];
  }
  if (!Number.isInteger(body.priceAmount) || body.priceAmount <= 0)
    errors.priceAmount = ["Informe um preço válido."];
  if (
    body.compareAtAmount !== null &&
    body.compareAtAmount !== undefined &&
    body.compareAtAmount <= body.priceAmount
  )
    errors.compareAtAmount = ['O preço "de" precisa ser maior que o preço atual.'];
  if (!Number.isInteger(body.stock) || body.stock < 0) errors.stock = ["Estoque inválido."];
  if (body.handlingDaysMin < 1 || body.handlingDaysMax < body.handlingDaysMin)
    errors.handlingDaysMax = ["Prazo de postagem inválido."];
  if ((body.images?.length ?? 0) > 8) errors.images = ["Máximo de 8 imagens."];
  const weight = body.weightGrams;
  if (
    weight !== null &&
    weight !== undefined &&
    (!Number.isInteger(weight) || weight < 0 || weight > 100_000)
  )
    errors.weightGrams = ["Peso em gramas entre 0 e 100.000."];
  const dims = body.dimensions;
  if (dims) {
    const ok = [dims.lengthCm, dims.widthCm, dims.heightCm].every(
      (v) => Number.isInteger(v) && v >= 0 && v <= 200,
    );
    if (!ok) errors.dimensions = ["Dimensões em centímetros inteiros entre 0 e 200."];
  }
  return Object.keys(errors).length ? validation(errors) : null;
}

/** Dados de envio normalizados (null quando vazios). */
function shippingFromInput(body: SellerProductInput) {
  const dims = body.dimensions;
  return {
    weightGrams: body.weightGrams ?? null,
    dimensions:
      dims && (dims.lengthCm || dims.widthCm || dims.heightCm)
        ? { lengthCm: dims.lengthCm, widthCm: dims.widthCm, heightCm: dims.heightCm }
        : null,
    hsCode: body.hsCode?.replace(/\D/g, "") || null,
  };
}

function buildCustomProduct(body: SellerProductInput, seller: SellerDto): ProductDetailDto {
  const id = crypto.randomUUID();
  const category = categoryById(body.categoryId)!;
  const price = { amount: body.priceAmount, currency: "BRL" as const };
  const compareAt = body.compareAtAmount
    ? { amount: body.compareAtAmount, currency: "BRL" as const }
    : null;
  const images = (body.images ?? []).map((img, i) => ({
    id: `${id}:img:${i + 1}`,
    url: img.url,
    alt: img.alt || body.name,
    sortOrder: i + 1,
  }));
  const discount = discountPercent(price, compareAt);
  const now = nowIso();
  return {
    id,
    slug: `${slugify(body.name)}-${id.slice(0, 6)}`,
    name: body.name.trim(),
    thumbnailUrl: images[0]?.url ?? "/images/products/placeholder.svg",
    price,
    compareAtPrice: compareAt,
    referencePrice: convert(price, getRate("BRL", "PYG")),
    discountPercent: discount,
    rating: 0,
    reviewCount: 0,
    soldCount: 0,
    stock: body.stock,
    freeShipping: body.freeShipping,
    isNew: true,
    isOffer: discount >= 15,
    categoryId: category.id,
    seller: toSellerSummary(seller),
    createdAt: now,
    description: body.description.trim(),
    images,
    variantOptions: [],
    variants: [],
    attributes: body.attributes ?? [],
    categoryPath: [{ id: category.id, slug: category.slug, name: category.name }],
    originCity: seller.city,
    handlingDays: { min: body.handlingDaysMin, max: body.handlingDaysMax },
    warrantyMonths: body.warrantyMonths,
    questionCount: 0,
  };
}

function overrideFromInput(body: SellerProductInput) {
  return {
    name: body.name.trim(),
    description: body.description.trim(),
    categoryId: body.categoryId,
    priceAmount: body.priceAmount,
    compareAtAmount: body.compareAtAmount ?? null,
    stock: body.stock,
    status: body.status,
    freeShipping: body.freeShipping,
    warrantyMonths: body.warrantyMonths,
    handlingDays: { min: body.handlingDaysMin, max: body.handlingDaysMax },
    ...shippingFromInput(body),
    attributes: body.attributes ?? [],
    images: (body.images ?? []).map((img, i) => ({
      id: `${i + 1}`,
      url: img.url,
      alt: img.alt ?? "",
      sortOrder: i + 1,
      storageKey: img.storageKey ?? null,
    })),
    updatedAt: nowIso(),
  };
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Mantém os uploads dentro do orçamento do localStorage descartando os mais antigos. */
function trimUploads(): void {
  const entries = Object.entries(db.uploads).sort(([, a], [, b]) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  let total = entries.reduce((acc, [, u]) => acc + u.base64.length, 0);
  for (const [key, upload] of entries) {
    if (total <= UPLOAD_BUDGET_BYTES) break;
    total -= upload.base64.length;
    delete db.uploads[key];
  }
}

export const sellerPanelHandlers = [
  http.get(`${API}/seller/cities`, async () => {
    await simulateLatency();
    return HttpResponse.json(CITIES);
  }),

  http.post(`${API}/seller/register`, async ({ request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    if (currentSeller()) return problem(409, "SELLER_EXISTS", "Você já tem uma loja cadastrada.");
    const body = (await request.json()) as SellerRegisterRequest;
    const errors: Record<string, string[]> = {};
    if (!body.name || body.name.trim().length < 3) errors.name = ["Informe o nome da loja."];
    if (!/^\d{6,8}-\d$/.test(body.ruc ?? "")) errors.ruc = ["RUC inválido. Formato: 80012345-6."];
    if (!body.city) errors.city = ["Escolha a cidade de envio."];
    if (!body.description || body.description.trim().length < 20)
      errors.description = ["Descreva sua loja com pelo menos 20 caracteres."];
    if (!body.acceptTerms) errors.acceptTerms = ["Aceite os termos para continuar."];
    Object.assign(errors, validateContact(body));
    const kyc = validateKyc(body, null);
    if ("errors" in kyc) Object.assign(errors, kyc.errors);
    if (Object.keys(errors).length || "errors" in kyc) return validation(errors);

    const id = crypto.randomUUID();
    const baseSlug = slugify(body.name);
    const slug = findSellerBySlug(baseSlug) ? `${baseSlug}-${id.slice(0, 4)}` : baseSlug;
    const categories = (body.categoryIds ?? [])
      .map((cid) => categoryById(cid))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
    const seller: SellerDto = {
      id,
      slug,
      name: body.name.trim(),
      logoUrl: body.logoUrl ?? null,
      reputationLevel: 3,
      isOfficialStore: false,
      city: body.city,
      description: body.description.trim(),
      ruc: body.ruc,
      country: "PY",
      memberSince: nowIso(),
      rating: 0,
      reviewCount: 0,
      productCount: 0,
      metrics: {
        salesCount: 0,
        positiveRatingPercent: 0,
        onTimeShippingPercent: 0,
        avgResponseTimeHours: 0,
      },
      exchangePolicy:
        body.exchangePolicy?.trim() ||
        "Trocas e devoluções em até 30 dias após o recebimento para produtos lacrados ou com defeito.",
      bannerUrl: body.bannerUrl ?? null,
      categories,
    };
    db.customSellers.push(seller);
    db.sellerOverrides[seller.id] = {
      originPostalCode: body.originPostalCode?.trim() || null,
      phone: body.phone?.replace(/\D/g, "") || null,
    };
    db.sellerKyc[seller.id] = kyc.kyc;
    db.sellerByUser[db.user.id] = slug;
    if (!db.user.roles.includes("Vendedor")) db.user.roles = [...db.user.roles, "Vendedor"];
    db.audit.push({
      id: db.audit.length + 1,
      userId: db.user.id,
      userEmail: db.user.email,
      action: "seller.register",
      target: slug,
      occurredAt: nowIso(),
      ipAddress: null,
    });
    persistDb();
    const body2: SellerRegisterResponseDto = {
      seller: toProfile(seller),
      session: issueSession(db.user),
    };
    return HttpResponse.json(body2, { status: 201 });
  }),

  http.get(`${API}/seller/profile`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    return HttpResponse.json(toProfile(seller));
  }),

  http.put(`${API}/seller/profile`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const body = (await request.json()) as SellerProfileInput;
    const errors: Record<string, string[]> = {};
    if (!body.name || body.name.trim().length < 3) errors.name = ["Informe o nome da loja."];
    if (!body.city) errors.city = ["Escolha a cidade de envio."];
    if (!body.description || body.description.trim().length < 20)
      errors.description = ["Descreva sua loja com pelo menos 20 caracteres."];
    Object.assign(errors, validateContact(body));
    const kyc = validateKyc(body, sellerKyc(seller.id));
    if ("errors" in kyc) Object.assign(errors, kyc.errors);
    if (Object.keys(errors).length || "errors" in kyc) return validation(errors);
    db.sellerKyc[seller.id] = kyc.kyc;
    db.sellerOverrides[seller.id] = {
      ...db.sellerOverrides[seller.id],
      name: body.name.trim(),
      city: body.city,
      description: body.description.trim(),
      logoUrl: body.logoUrl,
      bannerUrl: body.bannerUrl,
      exchangePolicy: body.exchangePolicy?.trim() || undefined,
      categoryIds: body.categoryIds?.length ? body.categoryIds : undefined,
      originPostalCode: body.originPostalCode?.trim() || null,
      phone: body.phone?.replace(/\D/g, "") || null,
    };
    persistDb();
    return HttpResponse.json(toProfile(findSellerBySlug(seller.slug)!));
  }),

  http.get(`${API}/seller/dashboard`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    settlePendingPayments();
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const orders = db.orders.filter((o) => o.seller.id === seller.id);
    const paid = orders.filter(
      (o) => o.payment.status === "Aprovado" && !["Cancelado", "Reembolsado"].includes(o.status),
    );
    const recent = paid.filter((o) => new Date(o.createdAt) >= since);
    const productIds = new Set(productsOf(seller.id).map((p) => p.id));
    const openQuestions = db.questions.filter(
      (q) => productIds.has(q.productId) && !q.answer,
    ).length;
    const body: SellerDashboardDto = {
      sellerId: seller.id,
      period: { min: since.toISOString(), max: nowIso() },
      grossSales: sum(
        recent.map((o) => ({
          amount: o.totals.subtotal.amount + o.totals.shipping.amount,
          currency: "BRL",
        })),
      ),
      ordersCount: recent.length,
      pendingShipments: orders.filter((o) => o.status === "Pago" || o.status === "EmPreparacao")
        .length,
      openQuestions,
      activeProducts: productsOf(seller.id).filter((p) => productStatus(p.id) === "Ativo").length,
      reputationLevel: seller.reputationLevel,
    };
    return HttpResponse.json(body);
  }),

  // ----- Produtos -----
  http.get(`${API}/seller/products`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const status = url.searchParams.get("status");
    const page = num(url.searchParams.get("page"), 1)!;
    const pageSize = num(url.searchParams.get("pageSize"), 20)!;
    let items = productsOf(seller.id).map(toListItem);
    if (status) items = items.filter((p) => p.status === status);
    if (q) items = items.filter((p) => p.name.toLowerCase().includes(q));
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return HttpResponse.json(paginate(items, page, pageSize));
  }),

  http.post(`${API}/seller/products`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const body = (await request.json()) as SellerProductInput;
    const invalid = validateProduct(body);
    if (invalid) return invalid;
    const product = buildCustomProduct(body, seller);
    db.customProducts.push(product);
    const shipping = shippingFromInput(body);
    db.productOverrides[product.id] = {
      images: overrideFromInput(body).images,
      ...shipping,
      ...decideListing(product.id, product.name, body.priceAmount, shipping.hsCode, body.status),
      updatedAt: nowIso(),
    };
    persistDb();
    return HttpResponse.json(toSellerProduct(findProduct(product.id)!), { status: 201 });
  }),

  http.get(`${API}/seller/products/:id`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const product = findProduct(String(params.id));
    if (!product || product.seller.id !== seller.id) return notFound("Produto");
    return HttpResponse.json(toSellerProduct(product));
  }),

  http.put(`${API}/seller/products/:id`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const product = findProduct(String(params.id));
    if (!product || product.seller.id !== seller.id) return notFound("Produto");
    const body = (await request.json()) as SellerProductInput;
    const invalid = validateProduct(body);
    if (invalid) return invalid;
    const next = overrideFromInput(body);
    db.productOverrides[product.id] = {
      ...db.productOverrides[product.id],
      ...next,
      ...decideListing(product.id, next.name, body.priceAmount, next.hsCode, body.status),
    };
    persistDb();
    return HttpResponse.json(toSellerProduct(findProduct(product.id)!));
  }),

  http.delete(`${API}/seller/products/:id`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const product = findProduct(String(params.id));
    if (!product || product.seller.id !== seller.id) return notFound("Produto");
    db.productOverrides[product.id] = {
      ...db.productOverrides[product.id],
      status: "Arquivado",
      updatedAt: nowIso(),
    };
    persistDb();
    return new HttpResponse(null, { status: 204 });
  }),

  // ----- Pedidos da loja -----
  http.get(`${API}/seller/orders`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    settlePendingPayments();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as OrderStatus | null;
    const page = num(url.searchParams.get("page"), 1)!;
    const pageSize = num(url.searchParams.get("pageSize"), 20)!;
    let orders = db.orders.filter((o) => o.seller.id === seller.id);
    if (status) orders = orders.filter((o) => o.status === status);
    orders = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(
      paginate(
        orders.map((o) => withShipment(o, "seller")),
        page,
        pageSize,
      ),
    );
  }),

  http.post(`${API}/seller/orders/:id/prepare`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const order = db.orders.find((o) => o.id === params.id && o.seller.id === seller.id);
    if (!order) return notFound("Pedido");
    if (order.status !== "Pago")
      return problem(409, "INVALID_STATUS", "Só pedidos pagos podem entrar em preparação.");
    advanceOrder(order, "EmPreparacao");
    persistDb();
    return HttpResponse.json(withShipment(order, "seller"));
  }),

  http.post(`${API}/seller/orders/:id/ship`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const order = db.orders.find((o) => o.id === params.id && o.seller.id === seller.id);
    if (!order) return notFound("Pedido");
    if (order.status !== "Pago" && order.status !== "EmPreparacao")
      return problem(
        409,
        "ORDER_INVALID_TRANSITION",
        "Só pedidos pagos ou em preparação podem ser enviados.",
      );
    const body = ((await request.json().catch(() => null)) ?? {}) as ShipOrderRequest;
    // Com etiqueta da plataforma, usa o rastreio dela; sem etiqueta, só se a plataforma permitir.
    const shipment = order.shipment;
    let tracking: string;
    let carrier: string;
    if (shipment?.status === "EtiquetaEmitida" && shipment.trackingCode) {
      tracking = shipment.trackingCode;
      carrier = shipment.carrier ?? order.shippingOption.carrier;
    } else if (db.settings.requirePlatformLabel) {
      return problem(
        409,
        "LABEL_REQUIRED",
        "Gere a etiqueta da plataforma antes de confirmar o envio. É ela que leva a declaração antecipada do Remessa Conforme.",
      );
    } else {
      tracking = body.trackingCode?.trim().toUpperCase() ?? "";
      const errors: Record<string, string[]> = {};
      if (tracking.length < 8 || tracking.length > 40)
        errors.trackingCode = ["Informe o código de rastreio (8 a 40 caracteres)."];
      if (!body.carrier?.trim()) errors.carrier = ["Informe a transportadora."];
      if (Object.keys(errors).length) return validation(errors);
      carrier = body.carrier!.trim();
    }
    if (order.status === "Pago") advanceOrder(order, "EmPreparacao");
    order.trackingCode = tracking;
    order.carrier = carrier;
    order.shippingOption = { ...order.shippingOption, carrier };
    markShipmentPosted(order);
    order.trackingEvents = [
      ...order.trackingEvents,
      {
        code: "POSTED",
        description: "Objeto postado",
        location: `${seller.city}, PY`,
        occurredAt: nowIso(),
      },
    ];
    advanceOrder(order, "Enviado");
    audit("order.ship", order.number);
    persistDb();
    return HttpResponse.json(withShipment(order, "seller"));
  }),

  // ----- Uploads (duas etapas: assina → PUT do arquivo) -----
  http.post(`${API}/seller/uploads`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const body = (await request.json()) as UploadRequest;
    if (!body.contentType?.startsWith("image/"))
      return validation({ contentType: ["Envie uma imagem (JPG, PNG ou WebP)."] });
    if (body.sizeBytes > MAX_UPLOAD_BYTES)
      return validation({ sizeBytes: ["Imagem maior que 5 MB."] });
    const ext = body.fileName?.split(".").pop()?.toLowerCase() ?? "img";
    const key = `${seller.slug}/${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const url = `${getApiBaseUrl()}/uploads/mock/${key}`;
    const presigned: PresignedUploadDto = {
      uploadUrl: url,
      publicUrl: url,
      storageKey: key,
      headers: { "Content-Type": body.contentType },
    };
    return HttpResponse.json(presigned, { status: 201 });
  }),

  http.put(`${API}/uploads/mock/*`, async ({ request }) => {
    const key = new URL(request.url).pathname.split("/uploads/mock/")[1] ?? "";
    if (!key) return notFound("Upload");
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD_BYTES)
      return validation({ file: ["Imagem maior que 5 MB."] });
    db.uploads[decodeURIComponent(key)] = {
      contentType: request.headers.get("content-type") ?? "application/octet-stream",
      base64: base64FromBytes(bytes),
      createdAt: nowIso(),
    };
    trimUploads();
    persistDb();
    return new HttpResponse(null, { status: 200 });
  }),

  http.get(`${API}/uploads/mock/*`, async ({ request }) => {
    const key = decodeURIComponent(new URL(request.url).pathname.split("/uploads/mock/")[1] ?? "");
    const upload = db.uploads[key];
    if (!upload) return notFound("Imagem");
    return new HttpResponse(bytesFromBase64(upload.base64), {
      headers: { "Content-Type": upload.contentType, "Cache-Control": "public, max-age=31536000" },
    });
  }),
];
