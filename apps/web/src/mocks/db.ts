import type {
  AddressDto,
  AdminAuditLogDto,
  CouponDto,
  DayRange,
  ExchangeRateDto,
  OrderDto,
  PaymentDto,
  PayoutStatus,
  PlatformSettingsDto,
  ProductAttributeDto,
  ProductDetailDto,
  ProductStatus,
  QuestionDto,
  SellerDto,
  SellerProductImageDto,
  SellerStatus,
  SellerSummaryDto,
  UserProfileDto,
  UserRole,
} from "@marketplace/contracts";

import { ADMIN_USER, DEMO_ADDRESSES, DEMO_USER, SELLER_USER } from "./fixtures/account";
import { guid, isoDaysAgo } from "./fixtures/base";
import { SEED_DATA } from "./fixtures/orders";

/**
 * "Banco de dados" do mock. Vive em memória e, no navegador, é espelhado em
 * localStorage para que pedidos criados sobrevivam a um refresh.
 * NUNCA importar isto fora de src/mocks.
 */

/** Ajustes feitos no painel do vendedor/admin sobre um produto (do catálogo fixo ou criado). */
export interface ProductOverride {
  name?: string;
  description?: string;
  categoryId?: string;
  priceAmount?: number;
  compareAtAmount?: number | null;
  stock?: number;
  status?: ProductStatus;
  freeShipping?: boolean;
  warrantyMonths?: number | null;
  handlingDays?: DayRange;
  attributes?: ProductAttributeDto[];
  images?: SellerProductImageDto[];
  updatedAt: string;
}

/** Ajustes feitos sobre uma loja (perfil do vendedor ou moderação do admin). */
export interface SellerOverride {
  name?: string;
  city?: string;
  description?: string;
  status?: SellerStatus;
  reputationLevel?: SellerSummaryDto["reputationLevel"];
  isOfficialStore?: boolean;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  exchangePolicy?: string;
  categoryIds?: string[];
}

export interface PayoutOverride {
  status: PayoutStatus;
  paidAt: string | null;
  failureReason: string | null;
}

/** Imagem enviada pelo painel (base64 para sobreviver ao reload; limitada pelo localStorage). */
export interface StoredUpload {
  contentType: string;
  base64: string;
  createdAt: string;
}

/** Estado de moderação de um usuário (admin). */
export interface UserState {
  fullName?: string;
  phone?: string | null;
  roles?: UserRole[];
  blockedAt: string | null;
  blockedReason: string | null;
  anonymizedAt: string | null;
}

interface MockDb {
  user: UserProfileDto;
  addresses: AddressDto[];
  orders: OrderDto[];
  payments: PaymentDto[];
  questions: QuestionDto[];
  /** Tokens de sessão válidos emitidos pelo mock. */
  tokens: string[];
  /** Loja de cada usuário com papel Vendedor (id do usuário → slug). */
  sellerByUser: Record<string, string>;
  /** Lojas criadas via /seller/register. */
  customSellers: SellerDto[];
  sellerOverrides: Record<string, SellerOverride>;
  /** Produtos criados no painel do vendedor (entram no catálogo público). */
  customProducts: ProductDetailDto[];
  productOverrides: Record<string, ProductOverride>;
  uploads: Record<string, StoredUpload>;
  userStates: Record<string, UserState>;
  payoutOverrides: Record<string, PayoutOverride>;
  coupons: CouponDto[];
  customRates: ExchangeRateDto[];
  settings: PlatformSettingsDto;
  audit: AdminAuditLogDto[];
}

const STORAGE_KEY = "mktpy.mockdb.v2";

function defaultCoupons(): CouponDto[] {
  const in30d = new Date();
  in30d.setDate(in30d.getDate() + 30);
  return [
    {
      id: guid("coupon:paraguai10"),
      code: "PARAGUAI10",
      discountBasisPoints: 1000,
      minSubtotalAmount: null,
      expiresAt: null,
      maxUses: null,
      usedCount: 128,
      active: true,
    },
    {
      id: guid("coupon:bemvindo5"),
      code: "BEMVINDO5",
      discountBasisPoints: 500,
      minSubtotalAmount: 20000,
      expiresAt: in30d.toISOString(),
      maxUses: 500,
      usedCount: 37,
      active: true,
    },
    {
      id: guid("coupon:black40"),
      code: "BLACK40",
      discountBasisPoints: 4000,
      minSubtotalAmount: 50000,
      expiresAt: isoDaysAgo(60),
      maxUses: 100,
      usedCount: 100,
      active: false,
    },
  ];
}

function defaultSettings(): PlatformSettingsDto {
  return {
    importTaxMode: "Flat",
    importTaxBasisPoints: 6000,
    icmsBasisPoints: 1700,
    platformFeeBasisPoints: 1000,
    paymentFeeBasisPoints: 349,
    freeShippingThresholdAmount: 30000,
    quoteLockMinutes: 15,
    pixExpirationMinutes: 30,
    boletoDueDays: 3,
    payoutHoldDays: 7,
    autoCompleteDays: 7,
    termsVersion: "2026-09",
    privacyPolicyVersion: "2026-09",
    updatedAt: isoDaysAgo(12),
  };
}

function defaultAudit(): AdminAuditLogDto[] {
  const admin = ADMIN_USER;
  return [
    {
      id: 1,
      userId: admin.id,
      userEmail: admin.email,
      action: "settings.update",
      target: "platform_settings",
      occurredAt: isoDaysAgo(12, 15),
      ipAddress: "200.150.10.21",
    },
    {
      id: 2,
      userId: admin.id,
      userEmail: admin.email,
      action: "seller.approve",
      target: "moda-guarani",
      occurredAt: isoDaysAgo(9, 11),
      ipAddress: "200.150.10.21",
    },
    {
      id: 3,
      userId: SELLER_USER.id,
      userEmail: SELLER_USER.email,
      action: "order.ship",
      target: "PY-2026-100104",
      occurredAt: isoDaysAgo(6, 16),
      ipAddress: "181.120.44.9",
    },
    {
      id: 4,
      userId: admin.id,
      userEmail: admin.email,
      action: "coupon.create",
      target: "BEMVINDO5",
      occurredAt: isoDaysAgo(3, 10),
      ipAddress: "200.150.10.21",
    },
  ];
}

function defaults(): MockDb {
  return {
    user: structuredClone(DEMO_USER),
    addresses: structuredClone(DEMO_ADDRESSES),
    orders: structuredClone(SEED_DATA.orders),
    payments: structuredClone(SEED_DATA.payments),
    questions: [],
    tokens: [],
    sellerByUser: { [SELLER_USER.id]: "tecnocentro-cde" },
    customSellers: [],
    sellerOverrides: {},
    customProducts: [],
    productOverrides: {},
    uploads: {},
    userStates: {},
    payoutOverrides: {},
    coupons: defaultCoupons(),
    customRates: [],
    settings: defaultSettings(),
    audit: defaultAudit(),
  };
}

function load(): MockDb {
  if (typeof window === "undefined") return defaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<MockDb>;
    const base = defaults();
    // Mantém os pedidos seed e acrescenta os criados pelo usuário.
    const seedIds = new Set(base.orders.map((o) => o.id));
    const userOrders = (parsed.orders ?? []).filter((o) => !seedIds.has(o.id));
    const seedPayIds = new Set(base.payments.map((p) => p.id));
    const userPayments = (parsed.payments ?? []).filter((p) => !seedPayIds.has(p.id));
    return {
      ...base,
      user: parsed.user ?? base.user,
      addresses: parsed.addresses ?? base.addresses,
      orders: [...userOrders, ...base.orders],
      payments: [...userPayments, ...base.payments],
      questions: parsed.questions ?? [],
      tokens: parsed.tokens ?? [],
      sellerByUser: { ...base.sellerByUser, ...(parsed.sellerByUser ?? {}) },
      customSellers: parsed.customSellers ?? [],
      sellerOverrides: parsed.sellerOverrides ?? {},
      customProducts: parsed.customProducts ?? [],
      productOverrides: parsed.productOverrides ?? {},
      uploads: parsed.uploads ?? {},
      userStates: parsed.userStates ?? {},
      payoutOverrides: parsed.payoutOverrides ?? {},
      coupons: parsed.coupons ?? base.coupons,
      customRates: parsed.customRates ?? [],
      settings: parsed.settings ?? base.settings,
      audit: parsed.audit?.length ? parsed.audit : base.audit,
    };
  } catch {
    return defaults();
  }
}

export const db: MockDb = load();

export function persistDb(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // quota / modo privado — descarta uploads (o maior item) e tenta de novo
    try {
      db.uploads = {};
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      /* ignora */
    }
  }
}

export function resetDb(): void {
  Object.assign(db, defaults());
  persistDb();
}
