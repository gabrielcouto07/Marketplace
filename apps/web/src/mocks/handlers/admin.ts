import type {
  AdminAuditLogDto,
  AdminDisputeResolveRequest,
  AdminOrderDetailDto,
  AdminOrderListItemDto,
  AdminOrderTransitionRequest,
  AdminOverviewDto,
  AdminPaymentListItemDto,
  AdminProductListItemDto,
  AdminProductUpdateRequest,
  AdminSellerDetailDto,
  AdminSellerListItemDto,
  AdminSellerUpdateRequest,
  AdminStatusCountDto,
  AdminUserDetailDto,
  AdminUserListItemDto,
  AdminUserUpdateRequest,
  ConsentDto,
  CouponDto,
  CouponInput,
  CurrencyCode,
  ExchangeRateDto,
  ExchangeRateInput,
  Money,
  OrderDto,
  OrderStatus,
  PayoutDto,
  PayoutStatus,
  PlatformSettingsDto,
  ProductDetailDto,
  SellerDto,
  UserProfileDto,
} from "@marketplace/contracts";
import { ORDER_STATUSES } from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { multiplyBasisPoints, sum } from "@/lib/money";

import {
  allProducts,
  allSellers,
  findProduct,
  findSellerById,
  findSellerBySlug,
  productStatus,
  sellerStatus,
} from "../catalog-state";
import { db, persistDb } from "../db";
import { DEMO_ACCOUNTS, DEMO_USER } from "../fixtures/account";
import {
  EXCHANGE_RATES,
  categoryById,
  guid,
  isoDaysAgo,
  seeded,
  hashString,
} from "../fixtures/base";
import { advanceOrder, settlePendingPayments } from "./orders";
import {
  API,
  addDays,
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

const ZERO: Money = { amount: 0, currency: "BRL" };
const isResponse = (value: unknown): value is Response => value instanceof Response;

function requireAdmin(request: Request): UserProfileDto | Response {
  if (!isAuthorized(request)) return unauthorized();
  if (!db.user.roles.includes("Admin"))
    return problem(403, "FORBIDDEN", "Acesso restrito a administradores.");
  return db.user;
}

function log(action: string, target: string | null): void {
  db.audit.push({
    id: (db.audit.at(-1)?.id ?? 0) + 1,
    userId: db.user.id,
    userEmail: db.user.email,
    action,
    target,
    occurredAt: nowIso(),
    ipAddress: "200.150.10.21",
  });
}

function daysAgoDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

const isPaid = (o: OrderDto) =>
  o.payment.status === "Aprovado" && !["Cancelado", "Reembolsado"].includes(o.status);
const sellerGross = (o: OrderDto): Money => ({
  amount: o.totals.subtotal.amount + o.totals.shipping.amount,
  currency: "BRL",
});

// ---------------------------------------------------------------------------
// Pessoas (usuários)
// ---------------------------------------------------------------------------

interface Person {
  user: UserProfileDto;
  ordersCount: number;
  totalSpent: Money;
  cpf: string | null;
}

const EXTRA_BUYERS: Array<[name: string, email: string]> = [
  ["Carlos Eduardo Lima", "carlos.lima@exemplo.com"],
  ["Juliana Prado", "juliana.prado@exemplo.com"],
  ["Rafael Monteiro", "rafael.monteiro@exemplo.com"],
  ["Fernanda Lopes", "fernanda.lopes@exemplo.com"],
  ["Bruno Almeida", "bruno.almeida@exemplo.com"],
  ["Patrícia Rocha", "patricia.rocha@exemplo.com"],
];

function people(): Person[] {
  const demoOrders = db.orders;
  const list: Person[] = DEMO_ACCOUNTS.map(({ user }) => ({
    user,
    cpf: user.cpf,
    ordersCount: user.id === DEMO_USER.id ? demoOrders.length : 0,
    totalSpent:
      user.id === DEMO_USER.id ? sum(demoOrders.filter(isPaid).map((o) => o.totals.total)) : ZERO,
  }));
  if (!list.some((p) => p.user.id === db.user.id)) {
    list.unshift({ user: db.user, cpf: db.user.cpf, ordersCount: 0, totalSpent: ZERO });
  }
  EXTRA_BUYERS.forEach(([fullName, email], i) => {
    const rnd = seeded(hashString(email));
    list.push({
      user: {
        id: guid(`user:buyer:${i}`),
        fullName,
        email,
        phone: `119${String(Math.floor(rnd() * 1e8)).padStart(8, "0")}`,
        cpf: null,
        avatarUrl: null,
        roles: ["Comprador"],
        createdAt: isoDaysAgo(15 + Math.floor(rnd() * 400)),
      },
      cpf: null,
      ordersCount: 1 + Math.floor(rnd() * 9),
      totalSpent: { amount: 25000 + Math.floor(rnd() * 900000), currency: "BRL" },
    });
  });
  return list;
}

function sellerNameFor(userId: string): string | null {
  const slug = db.sellerByUser[userId];
  return slug ? (findSellerBySlug(slug)?.name ?? null) : null;
}

function toUserItem(p: Person): AdminUserListItemDto {
  const state = db.userStates[p.user.id];
  const anonymized = Boolean(state?.anonymizedAt);
  return {
    id: p.user.id,
    fullName: anonymized ? "Usuário anonimizado" : (state?.fullName ?? p.user.fullName),
    email: anonymized ? `anon-${p.user.id.slice(0, 8)}@anon.local` : p.user.email,
    phone: anonymized ? null : state?.phone === undefined ? p.user.phone : state.phone,
    roles: state?.roles ?? p.user.roles,
    createdAt: p.user.createdAt,
    blockedAt: state?.blockedAt ?? null,
    anonymizedAt: state?.anonymizedAt ?? null,
    ordersCount: p.ordersCount,
    totalSpent: p.totalSpent,
    sellerName: sellerNameFor(p.user.id),
  };
}

function findPerson(id: string): Person | undefined {
  return people().find((p) => p.user.id === id);
}

function consentsFor(user: UserProfileDto): ConsentDto[] {
  return [
    {
      type: "TermosDeUso",
      version: db.settings.termsVersion,
      acceptedAt: user.createdAt,
      revokedAt: null,
    },
    {
      type: "PoliticaDePrivacidade",
      version: db.settings.privacyPolicyVersion,
      acceptedAt: user.createdAt,
      revokedAt: null,
    },
    {
      type: "Marketing",
      version: db.settings.termsVersion,
      acceptedAt: user.createdAt,
      revokedAt: user.id === DEMO_USER.id ? null : isoDaysAgo(40),
    },
  ];
}

function toUserDetail(p: Person): AdminUserDetailDto {
  const isBuyer = p.user.id === DEMO_USER.id;
  const state = db.userStates[p.user.id];
  return {
    summary: toUserItem(p),
    cpf: state?.anonymizedAt ? null : p.cpf,
    emailVerified: true,
    hasPassword: true,
    hasGoogle: false,
    blockedReason: state?.blockedReason ?? null,
    addresses: isBuyer ? db.addresses : [],
    recentOrders: isBuyer ? db.orders.slice(0, 5).map(toOrderItem) : [],
    consents: consentsFor(p.user),
    recentActivity: [...db.audit]
      .filter((a) => a.userId === p.user.id)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Pedidos, pagamentos e repasses
// ---------------------------------------------------------------------------

function toOrderItem(o: OrderDto): AdminOrderListItemDto {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    buyerId: DEMO_USER.id,
    buyerName: DEMO_USER.fullName,
    buyerEmail: DEMO_USER.email,
    sellerId: o.seller.id,
    sellerName: o.seller.name,
    total: o.totals.total,
    paymentId: o.payment.id,
    paymentMethod: o.payment.method,
    paymentStatus: o.payment.status,
    trackingCode: o.trackingCode,
    itemsCount: o.items.reduce((acc, i) => acc + i.quantity, 0),
  };
}

function payoutFor(o: OrderDto): PayoutDto | null {
  if (o.payment.status !== "Aprovado" && o.payment.status !== "Estornado") return null;
  const payment = db.payments.find((p) => p.id === o.payment.id);
  const paidAt = payment?.paidAt ?? o.createdAt;
  const scheduledFor = addDays(paidAt, db.settings.payoutHoldDays);
  const gross = sellerGross(o);
  const platformFee = multiplyBasisPoints(o.totals.subtotal, db.settings.platformFeeBasisPoints);
  const paymentFee = multiplyBasisPoints(o.totals.total, db.settings.paymentFeeBasisPoints);
  const net: Money = {
    amount: Math.max(0, gross.amount - platformFee.amount - paymentFee.amount),
    currency: "BRL",
  };

  let status: PayoutStatus = "Agendado";
  let failureReason: string | null = null;
  let paidOut: string | null = null;
  if (["Concluido", "Entregue"].includes(o.status)) {
    status = new Date(scheduledFor) <= new Date() ? "Pago" : "Processando";
    paidOut = status === "Pago" ? scheduledFor : null;
  } else if (["Reembolsado", "Devolvido", "Cancelado"].includes(o.status)) {
    status = "Falhou";
    failureReason = "Pedido reembolsado ou cancelado antes do repasse.";
  }
  const override = db.payoutOverrides[o.id];
  if (override) {
    status = override.status;
    paidOut = override.paidAt;
    failureReason = override.failureReason;
  }
  return {
    id: guid(`payout:${o.id}`),
    sellerId: o.seller.id,
    sellerName: o.seller.name,
    orderId: o.id,
    orderNumber: o.number,
    period: { min: paidAt, max: scheduledFor },
    gross,
    platformFee,
    paymentFee,
    net,
    status,
    scheduledFor,
    paidAt: paidOut,
    failureReason,
  };
}

function allPayouts(): PayoutDto[] {
  return db.orders
    .map(payoutFor)
    .filter((p): p is PayoutDto => Boolean(p))
    .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
}

function toPaymentItem(paymentId: string): AdminPaymentListItemDto | null {
  const payment = db.payments.find((p) => p.id === paymentId);
  if (!payment) return null;
  const orders = db.orders.filter((o) => o.purchaseId === payment.purchaseId);
  return {
    id: payment.id,
    purchaseId: payment.purchaseId,
    method: payment.method,
    status: payment.status,
    amount: payment.amount,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
    gateway: "Fake",
    gatewayPaymentId: `fake_${payment.id.replace(/-/g, "").slice(0, 16)}`,
    buyerEmail: DEMO_USER.email,
    orderNumbers: orders.map((o) => o.number),
    failureReason:
      payment.status === "Recusado"
        ? "Cartão recusado pelo emissor (saldo/limite)."
        : payment.status === "Expirado"
          ? "Pix expirado sem pagamento."
          : null,
  };
}

// ---------------------------------------------------------------------------
// Lojas e produtos
// ---------------------------------------------------------------------------

function toSellerItem(s: SellerDto): AdminSellerListItemDto {
  const ownerUserId =
    Object.entries(db.sellerByUser).find(([, slug]) => slug === s.slug)?.[0] ?? null;
  const owner = ownerUserId ? findPerson(ownerUserId) : undefined;
  const orders = db.orders.filter((o) => o.seller.id === s.id);
  const since = daysAgoDate(30);
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    ruc: s.ruc,
    city: s.city,
    status: sellerStatus(s.id),
    reputationLevel: s.reputationLevel,
    isOfficialStore: s.isOfficialStore,
    logoUrl: s.logoUrl,
    ownerUserId,
    ownerEmail: owner?.user.email ?? null,
    memberSince: s.memberSince,
    productCount: allProducts().filter(
      (p) => p.seller.id === s.id && productStatus(p.id) !== "Arquivado",
    ).length,
    ordersCount: orders.length,
    gross30d: sum(
      orders.filter((o) => isPaid(o) && new Date(o.createdAt) >= since).map(sellerGross),
    ),
    openDisputes: orders.filter((o) => o.status === "EmDisputa").length,
  };
}

function toSellerDetail(s: SellerDto): AdminSellerDetailDto {
  const orders = db.orders.filter((o) => o.seller.id === s.id);
  return {
    summary: toSellerItem(s),
    description: s.description,
    exchangePolicy: s.exchangePolicy,
    bannerUrl: s.bannerUrl,
    rating: s.rating,
    reviewCount: s.reviewCount,
    categories: s.categories,
    recentOrders: orders.slice(0, 5).map(toOrderItem),
    recentPayouts: allPayouts()
      .filter((p) => p.sellerId === s.id)
      .slice(0, 5),
  };
}

function toProductItem(p: ProductDetailDto): AdminProductListItemDto {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    thumbnailUrl: p.thumbnailUrl,
    price: p.price,
    stock: p.stock,
    status: productStatus(p.id),
    sellerId: p.seller.id,
    sellerName: p.seller.name,
    categoryName: categoryById(p.categoryId)?.name ?? "—",
    soldCount: p.soldCount,
    updatedAt: db.productOverrides[p.id]?.updatedAt ?? p.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Câmbio
// ---------------------------------------------------------------------------

const MINOR_UNITS: Record<CurrencyCode, number> = { BRL: 100, USD: 100, PYG: 1 };
const SYMBOL: Record<CurrencyCode, string> = { BRL: "R$", USD: "US$", PYG: "₲" };

function displayRate(input: ExchangeRateInput): string {
  const perUnit =
    (input.numerator / input.denominator) * (MINOR_UNITS[input.from] / MINOR_UNITS[input.to]);
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: input.to === "PYG" ? 0 : 2,
    minimumFractionDigits: input.to === "PYG" ? 0 : 2,
  }).format(perUnit);
  const one = input.from === "PYG" ? "1" : "1,00";
  return `${SYMBOL[input.from]} ${one} = ${SYMBOL[input.to]} ${formatted}`;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const adminHandlers = [
  http.get(`${API}/admin/overview`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    settlePendingPayments();

    const since = daysAgoDate(30);
    const users = people().map(toUserItem);
    const sellers = allSellers();
    const products = allProducts();
    const orders = db.orders;
    const paid = orders.filter(isPaid);
    const paid30 = paid.filter((o) => new Date(o.createdAt) >= since);
    const payouts = allPayouts();
    const pending = payouts.filter((p) => p.status === "Agendado" || p.status === "Processando");

    const byStatus: AdminStatusCountDto[] = ORDER_STATUSES.map((status) => ({
      status,
      count: orders.filter((o) => o.status === status).length,
    })).filter((s) => s.count > 0);

    const salesByDay = Array.from({ length: 30 }, (_, i) => {
      const day = daysAgoDate(29 - i);
      const key = day.toISOString().slice(0, 10);
      const dayOrders = paid.filter((o) => o.createdAt.slice(0, 10) === key);
      return {
        date: key,
        amount: sum(dayOrders.map((o) => o.totals.total)),
        orders: dayOrders.length,
      };
    });

    const body: AdminOverviewDto = {
      period: { min: since.toISOString(), max: nowIso() },
      totalUsers: users.length,
      newUsers30d: users.filter((u) => new Date(u.createdAt) >= since).length,
      blockedUsers: users.filter((u) => u.blockedAt).length,
      totalSellers: sellers.length,
      pendingSellers: sellers.filter((s) => sellerStatus(s.id) === "Pendente").length,
      suspendedSellers: sellers.filter((s) => sellerStatus(s.id) === "Suspenso").length,
      activeProducts: products.filter((p) => productStatus(p.id) === "Ativo").length,
      draftProducts: products.filter((p) => productStatus(p.id) === "Rascunho").length,
      totalOrders: orders.length,
      orders30d: orders.filter((o) => new Date(o.createdAt) >= since).length,
      ordersInTransit: orders.filter(
        (o) => o.status === "Enviado" || o.status === "EmTransitoInternacional",
      ).length,
      ordersAwaitingShipment: orders.filter(
        (o) => o.status === "Pago" || o.status === "EmPreparacao",
      ).length,
      openDisputes: orders.filter((o) => o.status === "EmDisputa").length,
      gmv30d: sum(paid30.map((o) => o.totals.total)),
      gmvTotal: sum(paid.map((o) => o.totals.total)),
      importTaxCollected30d: sum(paid30.map((o) => o.totals.importTax)),
      platformFees30d: sum(
        paid30.map((o) =>
          multiplyBasisPoints(o.totals.subtotal, db.settings.platformFeeBasisPoints),
        ),
      ),
      pendingPayouts: sum(pending.map((p) => p.net)),
      pendingPayoutsCount: pending.length,
      ordersByStatus: byStatus,
      salesByDay,
      recentOrders: [...orders]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8)
        .map(toOrderItem),
    };
    return HttpResponse.json(body);
  }),

  // ----- Usuários -----
  http.get(`${API}/admin/users`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const role = url.searchParams.get("role");
    const blocked = url.searchParams.get("blocked");
    let items = people().map(toUserItem);
    if (q) items = items.filter((u) => `${u.fullName} ${u.email}`.toLowerCase().includes(q));
    if (role)
      items = items.filter((u) => u.roles.includes(role as AdminUserListItemDto["roles"][number]));
    if (blocked === "true") items = items.filter((u) => u.blockedAt);
    if (blocked === "false") items = items.filter((u) => !u.blockedAt);
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(
      paginate(
        items,
        num(url.searchParams.get("page"), 1)!,
        num(url.searchParams.get("pageSize"), 20)!,
      ),
    );
  }),

  http.get(`${API}/admin/users/:id`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const person = findPerson(String(params.id));
    return person ? HttpResponse.json(toUserDetail(person)) : notFound("Usuário");
  }),

  http.put(`${API}/admin/users/:id`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const person = findPerson(String(params.id));
    if (!person) return notFound("Usuário");
    const body = (await request.json()) as AdminUserUpdateRequest;
    if (body.fullName !== undefined && body.fullName.trim().length < 3)
      return validation({ fullName: ["Informe o nome completo."] });
    const state = db.userStates[person.user.id] ?? {
      blockedAt: null,
      blockedReason: null,
      anonymizedAt: null,
    };
    db.userStates[person.user.id] = {
      ...state,
      fullName: body.fullName?.trim() ?? state.fullName,
      phone: body.phone === undefined ? state.phone : body.phone.replace(/\D/g, "") || null,
      roles: body.roles ?? state.roles,
    };
    if (person.user.id === db.user.id && body.roles) db.user = { ...db.user, roles: body.roles };
    log("user.update", person.user.email);
    persistDb();
    return HttpResponse.json(toUserDetail(person));
  }),

  http.post(`${API}/admin/users/:id/block`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const person = findPerson(String(params.id));
    if (!person) return notFound("Usuário");
    if (person.user.id === db.user.id)
      return problem(409, "SELF_BLOCK", "Você não pode bloquear a própria conta.");
    const body = (await request.json().catch(() => ({}))) as { reason?: string | null };
    const state = db.userStates[person.user.id] ?? {
      blockedAt: null,
      blockedReason: null,
      anonymizedAt: null,
    };
    db.userStates[person.user.id] = {
      ...state,
      blockedAt: nowIso(),
      blockedReason: body.reason?.trim() || null,
    };
    log("user.block", person.user.email);
    persistDb();
    return HttpResponse.json(toUserDetail(person));
  }),

  http.post(`${API}/admin/users/:id/unblock`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const person = findPerson(String(params.id));
    if (!person) return notFound("Usuário");
    const state = db.userStates[person.user.id] ?? {
      blockedAt: null,
      blockedReason: null,
      anonymizedAt: null,
    };
    db.userStates[person.user.id] = { ...state, blockedAt: null, blockedReason: null };
    log("user.unblock", person.user.email);
    persistDb();
    return HttpResponse.json(toUserDetail(person));
  }),

  http.delete(`${API}/admin/users/:id`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const person = findPerson(String(params.id));
    if (!person) return notFound("Usuário");
    if (person.user.id === db.user.id)
      return problem(409, "SELF_DELETE", "Você não pode anonimizar a própria conta.");
    const state = db.userStates[person.user.id] ?? {
      blockedAt: null,
      blockedReason: null,
      anonymizedAt: null,
    };
    db.userStates[person.user.id] = { ...state, anonymizedAt: nowIso() };
    log("user.anonymize", person.user.id);
    persistDb();
    return new HttpResponse(null, { status: 204 });
  }),

  // ----- Lojas -----
  http.get(`${API}/admin/sellers`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const status = url.searchParams.get("status");
    let items = allSellers().map(toSellerItem);
    if (q) items = items.filter((s) => `${s.name} ${s.ruc} ${s.city}`.toLowerCase().includes(q));
    if (status) items = items.filter((s) => s.status === status);
    return HttpResponse.json(
      paginate(
        items,
        num(url.searchParams.get("page"), 1)!,
        num(url.searchParams.get("pageSize"), 20)!,
      ),
    );
  }),

  http.get(`${API}/admin/sellers/:id`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const seller = findSellerById(String(params.id));
    return seller ? HttpResponse.json(toSellerDetail(seller)) : notFound("Loja");
  }),

  http.put(`${API}/admin/sellers/:id`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const seller = findSellerById(String(params.id));
    if (!seller) return notFound("Loja");
    const body = (await request.json()) as AdminSellerUpdateRequest;
    const level = body.reputationLevel;
    if (level !== undefined && (level < 1 || level > 5))
      return validation({ reputationLevel: ["Reputação de 1 a 5."] });
    db.sellerOverrides[seller.id] = {
      ...db.sellerOverrides[seller.id],
      name: body.name?.trim() || undefined,
      city: body.city?.trim() || undefined,
      description: body.description?.trim() || undefined,
      status: body.status,
      reputationLevel: level as SellerDto["reputationLevel"] | undefined,
      isOfficialStore: body.isOfficialStore,
    };
    log(body.status ? `seller.${body.status.toLowerCase()}` : "seller.update", seller.slug);
    persistDb();
    return HttpResponse.json(toSellerDetail(findSellerById(seller.id)!));
  }),

  // ----- Produtos -----
  http.get(`${API}/admin/products`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const status = url.searchParams.get("status");
    const sellerId = url.searchParams.get("sellerId");
    let items = allProducts().map(toProductItem);
    if (q) items = items.filter((p) => `${p.name} ${p.sellerName}`.toLowerCase().includes(q));
    if (status) items = items.filter((p) => p.status === status);
    if (sellerId) items = items.filter((p) => p.sellerId === sellerId);
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return HttpResponse.json(
      paginate(
        items,
        num(url.searchParams.get("page"), 1)!,
        num(url.searchParams.get("pageSize"), 20)!,
      ),
    );
  }),

  http.put(`${API}/admin/products/:id`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const product = findProduct(String(params.id));
    if (!product) return notFound("Produto");
    const body = (await request.json()) as AdminProductUpdateRequest;
    if (body.priceAmount !== undefined && body.priceAmount <= 0)
      return validation({ priceAmount: ["Preço inválido."] });
    if (body.stock !== undefined && body.stock < 0)
      return validation({ stock: ["Estoque inválido."] });
    db.productOverrides[product.id] = {
      ...db.productOverrides[product.id],
      name: body.name?.trim() || db.productOverrides[product.id]?.name,
      priceAmount: body.priceAmount ?? db.productOverrides[product.id]?.priceAmount,
      stock: body.stock ?? db.productOverrides[product.id]?.stock,
      status: body.status ?? db.productOverrides[product.id]?.status,
      updatedAt: nowIso(),
    };
    log("product.update", product.slug);
    persistDb();
    return HttpResponse.json(toProductItem(findProduct(product.id)!));
  }),

  // ----- Pedidos -----
  http.get(`${API}/admin/orders`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    settlePendingPayments();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const status = url.searchParams.get("status");
    const sellerId = url.searchParams.get("sellerId");
    const userId = url.searchParams.get("userId");
    const inTransit = url.searchParams.get("inTransit");
    let items = [...db.orders]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toOrderItem);
    if (q)
      items = items.filter((o) =>
        `${o.number} ${o.buyerName} ${o.buyerEmail} ${o.sellerName} ${o.trackingCode ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    if (status) items = items.filter((o) => o.status === status);
    if (sellerId) items = items.filter((o) => o.sellerId === sellerId);
    if (userId) items = items.filter((o) => o.buyerId === userId);
    if (inTransit === "true")
      items = items.filter((o) => o.status === "Enviado" || o.status === "EmTransitoInternacional");
    return HttpResponse.json(
      paginate(
        items,
        num(url.searchParams.get("page"), 1)!,
        num(url.searchParams.get("pageSize"), 20)!,
      ),
    );
  }),

  http.get(`${API}/admin/orders/:id`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const order = db.orders.find((o) => o.id === params.id);
    if (!order) return notFound("Pedido");
    const payment = db.payments.find((p) => p.id === order.payment.id);
    if (!payment) return notFound("Pagamento");
    const buyer = findPerson(DEMO_USER.id)!;
    const body: AdminOrderDetailDto = {
      order,
      buyer: toUserItem(buyer),
      payment,
      payout: payoutFor(order),
    };
    return HttpResponse.json(body);
  }),

  http.post(`${API}/admin/orders/:id/transition`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const order = db.orders.find((o) => o.id === params.id);
    if (!order) return notFound("Pedido");
    const body = (await request.json()) as AdminOrderTransitionRequest;
    if (!ORDER_STATUSES.includes(body.status)) return validation({ status: ["Status inválido."] });
    if (body.status === order.status)
      return problem(409, "SAME_STATUS", "O pedido já está neste status.");
    if (body.status === "Enviado" && !body.trackingCode && !order.trackingCode)
      return validation({
        trackingCode: ["Informe o código de rastreio para marcar como enviado."],
      });
    if (body.trackingCode) order.trackingCode = body.trackingCode.trim().toUpperCase();
    if (body.carrier)
      order.shippingOption = { ...order.shippingOption, carrier: body.carrier.trim() };
    advanceOrder(order, body.status as OrderStatus);
    if (body.note?.trim()) {
      const last = order.timeline[order.timeline.length - 1];
      if (last) last.description = body.note.trim();
    }
    if (body.status === "Cancelado" || body.status === "Reembolsado") {
      const payment = db.payments.find((p) => p.id === order.payment.id);
      if (payment && payment.status === "Aprovado") {
        payment.status = "Estornado";
        order.payment = { ...order.payment, status: "Estornado" };
      }
    }
    log("order.transition", `${order.number} → ${body.status}`);
    persistDb();
    return HttpResponse.json(order);
  }),

  http.post(`${API}/admin/orders/:id/disputes/resolve`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const order = db.orders.find((o) => o.id === params.id);
    if (!order) return notFound("Pedido");
    if (order.status !== "EmDisputa")
      return problem(409, "NOT_IN_DISPUTE", "Este pedido não está em disputa.");
    const body = (await request.json()) as AdminDisputeResolveRequest;
    advanceOrder(order, body.outcome);
    if (body.note?.trim()) {
      const last = order.timeline[order.timeline.length - 1];
      if (last) last.description = body.note.trim();
    }
    if (body.outcome === "Reembolsado") {
      const payment = db.payments.find((p) => p.id === order.payment.id);
      if (payment) payment.status = "Estornado";
      order.payment = { ...order.payment, status: "Estornado" };
    }
    log("dispute.resolve", `${order.number} → ${body.outcome}`);
    persistDb();
    return HttpResponse.json(order);
  }),

  // ----- Pagamentos -----
  http.get(`${API}/admin/payments`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    settlePendingPayments();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const status = url.searchParams.get("status");
    let items = db.payments
      .map((p) => toPaymentItem(p.id))
      .filter((p): p is AdminPaymentListItemDto => Boolean(p))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (q)
      items = items.filter((p) =>
        `${p.id} ${p.purchaseId} ${p.buyerEmail} ${p.orderNumbers.join(" ")} ${p.gatewayPaymentId ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    if (status) items = items.filter((p) => p.status === status);
    return HttpResponse.json(
      paginate(
        items,
        num(url.searchParams.get("page"), 1)!,
        num(url.searchParams.get("pageSize"), 20)!,
      ),
    );
  }),

  http.post(`${API}/admin/payments/:id/refund`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const payment = db.payments.find((p) => p.id === params.id);
    if (!payment) return notFound("Pagamento");
    if (payment.status !== "Aprovado")
      return problem(409, "NOT_REFUNDABLE", "Só pagamentos aprovados podem ser estornados.");
    payment.status = "Estornado";
    for (const order of db.orders) {
      if (
        order.purchaseId === payment.purchaseId &&
        !["Reembolsado", "Cancelado"].includes(order.status)
      ) {
        advanceOrder(order, "Reembolsado");
        order.payment = { ...order.payment, status: "Estornado" };
      }
    }
    log("payment.refund", payment.id);
    persistDb();
    return HttpResponse.json(payment);
  }),

  // ----- Repasses -----
  http.get(`${API}/admin/payouts`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const sellerId = url.searchParams.get("sellerId");
    let items = allPayouts();
    if (status) items = items.filter((p) => p.status === status);
    if (sellerId) items = items.filter((p) => p.sellerId === sellerId);
    return HttpResponse.json(
      paginate(
        items,
        num(url.searchParams.get("page"), 1)!,
        num(url.searchParams.get("pageSize"), 20)!,
      ),
    );
  }),

  http.post(`${API}/admin/payouts/:id/:action`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const payout = allPayouts().find((p) => p.id === params.id);
    if (!payout) return notFound("Repasse");
    const action = String(params.action);
    const next: PayoutStatus | null =
      action === "mark-paid"
        ? "Pago"
        : action === "retry" || action === "processing"
          ? "Processando"
          : null;
    if (!next) return notFound("Ação");
    db.payoutOverrides[payout.orderId] = {
      status: next,
      paidAt: next === "Pago" ? nowIso() : null,
      failureReason: null,
    };
    log(`payout.${action}`, payout.orderNumber);
    persistDb();
    return HttpResponse.json(allPayouts().find((p) => p.id === payout.id)!);
  }),

  // ----- Cupons -----
  http.get(`${API}/admin/coupons`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    return HttpResponse.json(db.coupons);
  }),

  http.post(`${API}/admin/coupons`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const body = (await request.json()) as CouponInput;
    const invalid = validateCoupon(body, null);
    if (invalid) return invalid;
    const coupon: CouponDto = { ...normalizeCoupon(body), id: crypto.randomUUID(), usedCount: 0 };
    db.coupons.unshift(coupon);
    log("coupon.create", coupon.code);
    persistDb();
    return HttpResponse.json(coupon, { status: 201 });
  }),

  http.put(`${API}/admin/coupons/:id`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const index = db.coupons.findIndex((c) => c.id === params.id);
    if (index < 0) return notFound("Cupom");
    const body = (await request.json()) as CouponInput;
    const invalid = validateCoupon(body, String(params.id));
    if (invalid) return invalid;
    db.coupons[index] = { ...db.coupons[index], ...normalizeCoupon(body) };
    log("coupon.update", db.coupons[index].code);
    persistDb();
    return HttpResponse.json(db.coupons[index]);
  }),

  http.delete(`${API}/admin/coupons/:id`, async ({ request, params }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const coupon = db.coupons.find((c) => c.id === params.id);
    if (!coupon) return notFound("Cupom");
    db.coupons = db.coupons.filter((c) => c.id !== coupon.id);
    log("coupon.delete", coupon.code);
    persistDb();
    return new HttpResponse(null, { status: 204 });
  }),

  // ----- Câmbio -----
  http.get(`${API}/admin/exchange-rates`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    return HttpResponse.json([...EXCHANGE_RATES]);
  }),

  http.post(`${API}/admin/exchange-rates`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const body = (await request.json()) as ExchangeRateInput;
    const errors: Record<string, string[]> = {};
    if (!body.from || !body.to || body.from === body.to) errors.to = ["Escolha moedas diferentes."];
    if (!Number.isInteger(body.numerator) || body.numerator <= 0)
      errors.numerator = ["Numerador inválido."];
    if (!Number.isInteger(body.denominator) || body.denominator <= 0)
      errors.denominator = ["Denominador inválido."];
    if (Object.keys(errors).length) return validation(errors);
    const now = nowIso();
    const rate: ExchangeRateDto = {
      id: crypto.randomUUID(),
      from: body.from,
      to: body.to,
      numerator: body.numerator,
      denominator: body.denominator,
      displayRate: displayRate(body),
      quotedAt: now,
      expiresAt: body.expiresAt ?? addDays(now, 1),
    };
    EXCHANGE_RATES.unshift(rate);
    db.customRates.unshift(rate);
    log("exchange-rate.create", `${rate.from}→${rate.to} ${rate.displayRate}`);
    persistDb();
    return HttpResponse.json(rate, { status: 201 });
  }),

  // ----- Configurações -----
  http.get(`${API}/admin/settings`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    return HttpResponse.json(db.settings);
  }),

  http.put(`${API}/admin/settings`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const body = (await request.json()) as PlatformSettingsDto;
    const errors: Record<string, string[]> = {};
    const bp = (v: number) => Number.isInteger(v) && v >= 0 && v <= 10000;
    if (!bp(body.importTaxBasisPoints))
      errors.importTaxBasisPoints = ["Use pontos-base entre 0 e 10000."];
    if (!bp(body.platformFeeBasisPoints))
      errors.platformFeeBasisPoints = ["Use pontos-base entre 0 e 10000."];
    if (!bp(body.paymentFeeBasisPoints))
      errors.paymentFeeBasisPoints = ["Use pontos-base entre 0 e 10000."];
    if (!bp(body.icmsBasisPoints)) errors.icmsBasisPoints = ["Use pontos-base entre 0 e 10000."];
    if (body.freeShippingThresholdAmount < 0)
      errors.freeShippingThresholdAmount = ["Valor inválido."];
    if (body.quoteLockMinutes < 1) errors.quoteLockMinutes = ["Mínimo de 1 minuto."];
    if (body.pixExpirationMinutes < 5) errors.pixExpirationMinutes = ["Mínimo de 5 minutos."];
    if (body.boletoDueDays < 1) errors.boletoDueDays = ["Mínimo de 1 dia."];
    if (body.payoutHoldDays < 0) errors.payoutHoldDays = ["Valor inválido."];
    if (Object.keys(errors).length) return validation(errors);
    db.settings = { ...db.settings, ...body, updatedAt: nowIso() };
    log("settings.update", "platform_settings");
    persistDb();
    return HttpResponse.json(db.settings);
  }),

  // ----- Auditoria -----
  http.get(`${API}/admin/audit`, async ({ request }) => {
    await simulateLatency();
    const admin = requireAdmin(request);
    if (isResponse(admin)) return admin;
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    let items: AdminAuditLogDto[] = [...db.audit].sort((a, b) =>
      b.occurredAt.localeCompare(a.occurredAt),
    );
    if (q)
      items = items.filter((a) =>
        `${a.action} ${a.target ?? ""} ${a.userEmail ?? ""}`.toLowerCase().includes(q),
      );
    return HttpResponse.json(
      paginate(
        items,
        num(url.searchParams.get("page"), 1)!,
        num(url.searchParams.get("pageSize"), 40)!,
      ),
    );
  }),
];

function normalizeCoupon(body: CouponInput): CouponInput {
  return {
    code: body.code.trim().toUpperCase(),
    discountBasisPoints: body.discountBasisPoints,
    minSubtotalAmount: body.minSubtotalAmount ?? null,
    expiresAt: body.expiresAt ?? null,
    maxUses: body.maxUses ?? null,
    active: body.active,
  };
}

function validateCoupon(body: CouponInput, id: string | null) {
  const errors: Record<string, string[]> = {};
  const code = body.code?.trim().toUpperCase() ?? "";
  if (!/^[A-Z0-9]{3,20}$/.test(code)) errors.code = ["Use de 3 a 20 letras ou números."];
  if (db.coupons.some((c) => c.code === code && c.id !== id))
    errors.code = ["Já existe um cupom com este código."];
  if (
    !Number.isInteger(body.discountBasisPoints) ||
    body.discountBasisPoints <= 0 ||
    body.discountBasisPoints > 10000
  )
    errors.discountBasisPoints = ["Desconto entre 0,01% e 100%."];
  if (
    body.minSubtotalAmount !== null &&
    body.minSubtotalAmount !== undefined &&
    body.minSubtotalAmount < 0
  )
    errors.minSubtotalAmount = ["Valor mínimo inválido."];
  if (body.maxUses !== null && body.maxUses !== undefined && body.maxUses < 1)
    errors.maxUses = ["Limite de usos inválido."];
  return Object.keys(errors).length ? validation(errors) : null;
}
