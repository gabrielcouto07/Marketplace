import type { OrderListQuery, ProductSearchQuery } from "@marketplace/contracts";

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
    suggestions: (q: string) => ["products", "suggestions", q] as const,
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
    quote: (cep: string, sellerId: string, itemsKey: string) => ["shipping", "quotes", cep, sellerId, itemsKey] as const,
    exchangeRates: ["exchange-rates"] as const,
  },
  orders: {
    list: (query: OrderListQuery) => ["orders", "list", query] as const,
    detail: (id: string) => ["orders", "detail", id] as const,
    byPurchase: (purchaseId: string) => ["orders", "purchase", purchaseId] as const,
  },
  payments: {
    detail: (id: string) => ["payments", id] as const,
  },
  me: {
    profile: ["me"] as const,
    addresses: ["me", "addresses"] as const,
  },
} as const;
