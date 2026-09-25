import type { ProductSearchQuery, ProductSort } from "@marketplace/contracts";

/** Filtros da busca espelhados na URL (query string) — compartilháveis. */
export interface SearchFilters {
  q?: string;
  categorySlug?: string;
  sellerSlug?: string;
  /** Em centavos (BRL). */
  minPrice?: number;
  maxPrice?: number;
  freeShipping?: boolean;
  onlyOffers?: boolean;
  minRating?: number;
  sort?: ProductSort;
}

export const SORT_OPTIONS: ProductSort[] = ["relevance", "priceAsc", "priceDesc", "newest", "bestSelling", "rating"];

type ParamsLike = { get(name: string): string | null };

function numParam(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

export function parseSearchFilters(params: ParamsLike): SearchFilters {
  const sort = params.get("sort") as ProductSort | null;
  return {
    q: params.get("q")?.trim() || undefined,
    categorySlug: params.get("categorySlug") || undefined,
    sellerSlug: params.get("sellerSlug") || undefined,
    minPrice: numParam(params.get("minPrice")),
    maxPrice: numParam(params.get("maxPrice")),
    freeShipping: params.get("freeShipping") === "true" || undefined,
    onlyOffers: params.get("onlyOffers") === "true" || undefined,
    minRating: numParam(params.get("minRating")),
    sort: sort && SORT_OPTIONS.includes(sort) ? sort : undefined,
  };
}

export function filtersToSearchParams(filters: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.categorySlug) p.set("categorySlug", filters.categorySlug);
  if (filters.sellerSlug) p.set("sellerSlug", filters.sellerSlug);
  if (filters.minPrice !== undefined) p.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== undefined) p.set("maxPrice", String(filters.maxPrice));
  if (filters.freeShipping) p.set("freeShipping", "true");
  if (filters.onlyOffers) p.set("onlyOffers", "true");
  if (filters.minRating !== undefined) p.set("minRating", String(filters.minRating));
  if (filters.sort && filters.sort !== "relevance") p.set("sort", filters.sort);
  return p;
}

export function filtersToQuery(filters: SearchFilters): Omit<ProductSearchQuery, "page"> {
  return {
    q: filters.q,
    categorySlug: filters.categorySlug,
    sellerSlug: filters.sellerSlug,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    freeShipping: filters.freeShipping,
    onlyOffers: filters.onlyOffers,
    minRating: filters.minRating,
    sort: filters.sort ?? "relevance",
    pageSize: 20,
  };
}

/** Filtros "removíveis" (exclui q, sort e os fixos pelo contexto da página). */
export type RemovableFilterKey = Exclude<keyof SearchFilters, "q" | "sort">;

export function countActiveFilters(filters: SearchFilters, locked: RemovableFilterKey[] = []): number {
  const keys: RemovableFilterKey[] = ["categorySlug", "sellerSlug", "minPrice", "maxPrice", "freeShipping", "onlyOffers", "minRating"];
  return keys.filter((k) => !locked.includes(k) && filters[k] !== undefined && filters[k] !== false).length;
}
