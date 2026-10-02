import type {
  AnswerQuestionRequest,
  CancelOrderRequest,
  OrderStatus,
  PayoutDto,
  PayoutStatus,
  PresignedUploadDto,
  ProductDetailDto,
  QuestionDto,
  SellerDashboardDto,
  SellerDto,
  SellerPayoutSummaryDto,
  SellerProductDto,
  SellerProductInput,
  SellerProductListItemDto,
  SellerProfileDto,
  SellerProfileInput,
  SellerQuestionDto,
  SellerRegisterRequest,
  SellerRegisterResponseDto,
  ShipOrderRequest,
  UploadRequest,
} from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { getApiBaseUrl } from "@/lib/api/http";
import { convert, discountPercent, sum } from "@/lib/money";

import {
  allProducts,
  findProduct,
  findProductRecord,
  findSellerBySlug,
  productStatus,
  sellerStatus,
} from "../catalog-state";
import { db, persistDb } from "../db";
import { categoryById, getRate, slugify, toSellerSummary } from "../fixtures/base";
import { payoutFor } from "./admin";
import { issueSession } from "./auth";
import { advanceOrder, settlePendingPayments } from "./orders";
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

const sellerRequired = () =>
  problem(403, "SELLER_REQUIRED", "Cadastre sua loja para acessar o painel do vendedor.");

function currentSeller(): SellerDto | null {
  const slug = db.sellerByUser[db.user.id];
  return slug ? (findSellerBySlug(slug) ?? null) : null;
}

/** Sessão válida e loja associada; senão 401/403. */
function requireSeller(request: Request): SellerDto | ReturnType<typeof problem> {
  if (!isAuthorized(request)) return unauthorized();
  return currentSeller() ?? sellerRequired();
}

const isResponse = (value: unknown): value is Response => value instanceof Response;

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

function productsOf(sellerId: string): ProductDetailDto[] {
  return allProducts().filter((p) => p.seller.id === sellerId);
}

/** Perguntas (fixtures + feitas nesta sessão) de todos os produtos da loja, com o produto para contexto. */
function sellerQuestions(sellerId: string): SellerQuestionDto[] {
  const result: SellerQuestionDto[] = [];
  for (const product of productsOf(sellerId)) {
    const record = findProductRecord(product.id);
    const fixture = record?.questions ?? [];
    const session = db.questions.filter((q) => q.productId === product.id);
    const sessionIds = new Set(session.map((q) => q.id));
    for (const q of [...session, ...fixture.filter((q) => !sessionIds.has(q.id))]) {
      result.push({
        id: q.id,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        productThumbnailUrl: product.thumbnailUrl,
        question: q.question,
        askedBy: q.askedBy,
        askedAt: q.askedAt,
        answer: q.answer,
      });
    }
  }
  return result;
}

function toPlainQuestion(q: SellerQuestionDto): QuestionDto {
  return {
    id: q.id,
    productId: q.productId,
    question: q.question,
    askedBy: q.askedBy,
    askedAt: q.askedAt,
    answer: q.answer,
  };
}

function sellerPayouts(sellerId: string): PayoutDto[] {
  return db.orders
    .filter((o) => o.seller.id === sellerId)
    .map(payoutFor)
    .filter((p): p is PayoutDto => Boolean(p))
    .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
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
    hsCode: override?.hsCode ?? null,
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
  if (!body.description || body.description.trim().length < 20)
    errors.description = ["Descreva o produto com pelo menos 20 caracteres."];
  if (!body.categoryId || !categoryById(body.categoryId))
    errors.categoryId = ["Escolha uma categoria."];
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
  if (body.hsCode && !/^\d{4,10}$/.test(body.hsCode.replace(/\D/g, "")))
    errors.hsCode = ["Código NCM/HS com 4 a 10 dígitos."];
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
    hsCode: body.hsCode?.trim() || null,
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
    if (Object.keys(errors).length) return validation(errors);

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
    if (Object.keys(errors).length) return validation(errors);
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
    db.productOverrides[product.id] = {
      status: body.status,
      images: overrideFromInput(body).images,
      ...shippingFromInput(body),
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
    db.productOverrides[product.id] = {
      ...db.productOverrides[product.id],
      ...overrideFromInput(body),
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
    return HttpResponse.json(paginate(orders, page, pageSize));
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
    return HttpResponse.json(order);
  }),

  http.post(`${API}/seller/orders/:id/ship`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const order = db.orders.find((o) => o.id === params.id && o.seller.id === seller.id);
    if (!order) return notFound("Pedido");
    if (order.status !== "Pago" && order.status !== "EmPreparacao")
      return problem(409, "INVALID_STATUS", "Este pedido não pode ser enviado neste status.");
    const body = (await request.json()) as ShipOrderRequest;
    const errors: Record<string, string[]> = {};
    if (!body.carrier?.trim()) errors.carrier = ["Informe a transportadora."];
    if (!/^[A-Z0-9]{8,20}$/i.test(body.trackingCode ?? ""))
      errors.trackingCode = ["Código de rastreio inválido (8 a 20 letras/números)."];
    if (Object.keys(errors).length) return validation(errors);
    order.trackingCode = body.trackingCode.toUpperCase();
    order.carrier = body.carrier.trim();
    order.shippingOption = { ...order.shippingOption, carrier: body.carrier.trim() };
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
    db.audit.push({
      id: db.audit.length + 1,
      userId: db.user.id,
      userEmail: db.user.email,
      action: "order.ship",
      target: order.number,
      occurredAt: nowIso(),
      ipAddress: null,
    });
    persistDb();
    return HttpResponse.json(order);
  }),

  http.post(`${API}/seller/orders/:id/cancel`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const order = db.orders.find((o) => o.id === params.id && o.seller.id === seller.id);
    if (!order) return notFound("Pedido");
    if (!["AguardandoPagamento", "Pago", "EmPreparacao"].includes(order.status))
      return problem(409, "ORDER_NOT_CANCELLABLE", "Este pedido não pode mais ser cancelado.");
    const body = (await request.json().catch(() => null)) as CancelOrderRequest | null;
    const reason = body?.reason?.trim();
    if (reason && reason.length > 300) return validation({ reason: ["Motivo muito longo."] });
    const wasPaid = order.payment.status === "Aprovado";
    advanceOrder(
      order,
      "Cancelado",
      (reason ? `Cancelado pela loja: ${reason}` : "Cancelado pela loja.") +
        (wasPaid ? " Reembolso solicitado no meio de pagamento original." : ""),
    );
    if (wasPaid) {
      const payment = db.payments.find((p) => p.id === order.payment.id);
      const siblings = db.orders.filter((o) => o.purchaseId === order.purchaseId && o.id !== order.id);
      if (payment) {
        payment.refundedAmount = {
          amount: Math.min(payment.amount.amount, payment.refundedAmount.amount + order.totals.total.amount),
          currency: "BRL",
        };
        if (siblings.every((o) => ["Cancelado", "Reembolsado"].includes(o.status))) {
          payment.status = "Estornado";
          order.payment = { ...order.payment, status: "Estornado" };
        }
      }
    }
    db.audit.push({
      id: db.audit.length + 1,
      userId: db.user.id,
      userEmail: db.user.email,
      action: "seller.order.cancel",
      target: order.number,
      occurredAt: nowIso(),
      ipAddress: null,
    });
    persistDb();
    return HttpResponse.json(order);
  }),

  // ----- Perguntas dos compradores -----
  http.get(`${API}/seller/questions`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const url = new URL(request.url);
    const unanswered = url.searchParams.get("unanswered") === "true";
    const page = num(url.searchParams.get("page"), 1)!;
    const pageSize = num(url.searchParams.get("pageSize"), 20)!;
    let items = sellerQuestions(seller.id);
    if (unanswered) items = items.filter((q) => !q.answer);
    items.sort((a, b) => {
      if (Boolean(a.answer) !== Boolean(b.answer)) return a.answer ? 1 : -1;
      return a.answer
        ? b.answer!.answeredAt.localeCompare(a.answer.answeredAt)
        : a.askedAt.localeCompare(b.askedAt);
    });
    return HttpResponse.json(paginate(items, page, pageSize));
  }),

  http.post(`${API}/seller/questions/:id/answer`, async ({ request, params }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    const body = (await request.json()) as AnswerQuestionRequest;
    const text = body.text?.trim() ?? "";
    if (text.length < 2) return validation({ text: ["Escreva a resposta."] });
    if (text.length > 1000) return validation({ text: ["Resposta muito longa (máximo 1000 caracteres)."] });
    const target = sellerQuestions(seller.id).find((q) => q.id === params.id);
    if (!target) return notFound("Pergunta");
    const answer = { text, answeredAt: nowIso() };
    // Perguntas das fixtures viram "respondidas" via db (sobrescreve a resposta original para a sessão).
    const stored = db.questions.find((q) => q.id === target.id);
    if (stored) stored.answer = answer;
    else db.questions.unshift({ ...toPlainQuestion(target), answer });
    persistDb();
    return HttpResponse.json({ ...target, answer });
  }),

  // ----- Repasses -----
  http.get(`${API}/seller/payouts`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    settlePendingPayments();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as PayoutStatus | null;
    const page = num(url.searchParams.get("page"), 1)!;
    const pageSize = num(url.searchParams.get("pageSize"), 20)!;
    let items = sellerPayouts(seller.id);
    if (status) items = items.filter((p) => p.status === status);
    return HttpResponse.json(paginate(items, page, pageSize));
  }),

  http.get(`${API}/seller/payouts/summary`, async ({ request }) => {
    await simulateLatency();
    const seller = requireSeller(request);
    if (isResponse(seller)) return seller;
    settlePendingPayments();
    const items = sellerPayouts(seller.id);
    const total = (s: PayoutStatus) =>
      sum(items.filter((p) => p.status === s).map((p) => p.net), "BRL");
    const body: SellerPayoutSummaryDto = {
      scheduled: total("Agendado"),
      processing: total("Processando"),
      paid: total("Pago"),
      failed: total("Falhou"),
      scheduledCount: items.filter((p) => p.status === "Agendado").length,
    };
    return HttpResponse.json(body);
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
