import type {
  AdminAuditListQuery,
  AdminOrderListQuery,
  AdminPaymentListQuery,
  AdminPayoutListQuery,
  AdminProductListQuery,
  AdminSellerListQuery,
  AdminUserListQuery,
  OrderListQuery,
  ProductSearchQuery,
  SellerProductListQuery,
} from "@marketplace/contracts";

/**
 * Chaves do TanStack Query centralizadas (facilita invalidação e prefetch).
 * Padrão: [dominio, recurso, ...params]
 */
export const queryKeys = {
  home: ["home"] as const,
  categories: {
    all: ["categories"] as const,
    detail: (slug: string) => ["categories", slug] as const,
  },
  products: {
    search: (query: ProductSearchQuery) => ["products", "search", query] as const,
    detail: (slug: string) => ["products", "detail", slug] as const,
    reviews: (id: string) => ["products", id, "reviews"] as const,
    reviewSummary: (id: string) => ["products", id, "reviews", "summary"] as const,
    questions: (id: string) => ["products", id, "questions"] as const,
  },
  sellers: {
    all: ["sellers"] as const,
    detail: (slug: string) => ["sellers", slug] as const,
    reviews: (slug: string) => ["sellers", slug, "reviews"] as const,
  },
  shipping: {
    postalCode: (cep: string) => ["postal-codes", cep] as const,
    exchangeRates: ["exchange-rates"] as const,
  },
  orders: {
    list: (query: OrderListQuery) => ["orders", "list", query] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
    tracking: (id: string) => ["orders", "detail", id, "tracking"] as const,
    byPurchase: (purchaseId: string) => ["orders", "purchase", purchaseId] as const,
  },
  payments: {
    detail: (id: string) => ["payments", id] as const,
  },
  me: {
    profile: ["me"] as const,
    addresses: ["me", "addresses"] as const,
  },
  admin: {
    overview: ["admin", "overview"] as const,
    users: (query: AdminUserListQuery) => ["admin", "users", query] as const,
    user: (id: string) => ["admin", "users", "detail", id] as const,
    sellers: (query: AdminSellerListQuery) => ["admin", "sellers", query] as const,
    seller: (id: string) => ["admin", "sellers", "detail", id] as const,
    products: (query: AdminProductListQuery) => ["admin", "products", query] as const,
    orders: (query: AdminOrderListQuery) => ["admin", "orders", query] as const,
    order: (id: string) => ["admin", "orders", "detail", id] as const,
    payments: (query: AdminPaymentListQuery) => ["admin", "payments", query] as const,
    payouts: (query: AdminPayoutListQuery) => ["admin", "payouts", query] as const,
    coupons: ["admin", "coupons"] as const,
    rates: ["admin", "rates"] as const,
    settings: ["admin", "settings"] as const,
    audit: (query: AdminAuditListQuery) => ["admin", "audit", query] as const,
  },
  sellerPanel: {
    profile: ["seller", "profile"] as const,
    dashboard: ["seller", "dashboard"] as const,
    cities: ["seller", "cities"] as const,
    products: (query: SellerProductListQuery) => ["seller", "products", query] as const,
    product: (id: string) => ["seller", "products", "detail", id] as const,
    orders: (query: OrderListQuery) => ["seller", "orders", query] as const,
  },
} as const;
