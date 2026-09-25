"use client";

import type { ProductSearchFacetsDto, ProductSort } from "@marketplace/contracts";
import { ChevronDown, Loader2, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useProductSearch } from "@/features/catalog/api";
import { usePathname, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

import { FiltersPanel } from "./filters-panel";
import {
  SORT_OPTIONS,
  countActiveFilters,
  filtersToQuery,
  filtersToSearchParams,
  parseSearchFilters,
  type RemovableFilterKey,
  type SearchFilters,
} from "./search-filters";

interface SearchViewProps {
  /** Filtros fixados pelo contexto da página (ex.: { categorySlug: "celulares" }). */
  fixed?: Partial<Pick<SearchFilters, "categorySlug" | "sellerSlug">>;
  /** Oculta o título "Resultados para …". */
  hideHeading?: boolean;
  className?: string;
}

/**
 * Busca/listagem com filtros na URL, infinite scroll e filtros em bottom sheet (mobile) / sidebar (desktop).
 * Precisa estar dentro de <Suspense> (usa useSearchParams).
 */
export function SearchView({ fixed = {}, hideHeading, className }: SearchViewProps) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const locked = useMemo(() => Object.keys(fixed).filter((k) => fixed[k as keyof typeof fixed]) as RemovableFilterKey[], [fixed]);
  const filters = useMemo<SearchFilters>(() => ({ ...parseSearchFilters(searchParams), ...fixed }), [searchParams, fixed]);

  const navigate = useCallback(
    (next: SearchFilters) => {
      const clean: SearchFilters = { ...next };
      for (const key of locked) delete clean[key];
      const qs = filtersToSearchParams(clean).toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, locked],
  );

  const query = useMemo(() => filtersToQuery(filters), [filters]);
  const { data, isPending, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isPlaceholderData } = useProductSearch(query);

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const totalCount = data?.pages[0]?.totalCount ?? 0;
  const facets = data?.pages[0]?.facets;
  const activeCount = countActiveFilters(filters, locked);

  // Infinite scroll via IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Bottom sheet (mobile) com rascunho
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const openSheet = (open: boolean) => {
    if (open) setDraft(filters); // sincroniza o rascunho com a URL ao abrir
    setSheetOpen(open);
  };

  const clearAll = () => navigate({ q: filters.q, sort: filters.sort });

  const chips = buildChips(filters, locked, facets, t);

  return (
    <PageContainer className={cn("pt-3", className)}>
      {!hideHeading ? (
        <h1 className="mb-1 text-xl font-bold tracking-tight">{filters.q ? t("resultsFor", { query: filters.q }) : t("searchTitle")}</h1>
      ) : null}

      {/* Barra de controle */}
      <div className="sticky top-[calc(var(--header-height)+4px)] z-30 -mx-4 mb-3 flex items-center gap-2 bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/85 md:static md:mx-0 md:px-0">
        <Button variant="outline" className="md:hidden" onClick={() => openSheet(true)} aria-haspopup="dialog" aria-expanded={sheetOpen}>
          <SlidersHorizontal data-icon="inline-start" />
          {t("filters")}
          {activeCount > 0 ? (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
        <label className="relative ml-auto flex h-11 items-center">
          <span className="sr-only">{t("sort")}</span>
          <select
            value={filters.sort ?? "relevance"}
            onChange={(e) => navigate({ ...filters, sort: e.target.value as ProductSort })}
            className="h-11 appearance-none rounded-lg border border-input bg-background py-2 pr-9 pl-3 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {t(`sortOptions.${s}`)}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-3 size-4 text-muted-foreground" />
        </label>
      </div>

      <div className="flex gap-6">
        {/* Sidebar desktop */}
        <aside className="hidden w-60 shrink-0 md:block">
          <div className="sticky top-[calc(var(--header-height)+1rem)] rounded-xl border border-border bg-card p-4">
            <h2 className="mb-4 text-base font-bold">{t("filters")}</h2>
            <FiltersPanel value={filters} facets={facets} locked={locked} onChange={navigate} onClear={clearAll} />
          </div>
        </aside>

        <section className="min-w-0 flex-1" aria-live="polite" aria-busy={isPending || isPlaceholderData}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">{isPending ? tc("loading") : t("resultsCount", { count: totalCount })}</p>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => navigate(chip.remove(filters))}
                className="flex h-8 items-center gap-1 rounded-full bg-accent px-3 text-xs font-medium text-accent-foreground hover:bg-accent/70"
                aria-label={`${t("clearFilters")}: ${chip.label}`}
              >
                {chip.label}
                <X className="size-3" aria-hidden />
              </button>
            ))}
            {chips.length > 1 ? (
              <button type="button" onClick={clearAll} className="text-xs font-medium text-primary hover:underline">
                {t("clearFilters")}
              </button>
            ) : null}
          </div>

          {isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : isPending ? (
            <ProductGrid>
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </ProductGrid>
          ) : items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t("noResultsTitle")}
              description={t("noResultsDescription")}
              action={
                activeCount > 0 ? (
                  <Button variant="outline" onClick={clearAll}>
                    {t("clearFilters")}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <ProductGrid className={cn(isPlaceholderData && "opacity-60 transition-opacity")}>
                {items.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </ProductGrid>
              <div ref={sentinelRef} className="flex justify-center py-6">
                {isFetchingNextPage ? (
                  <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label={tc("loading")} />
                ) : hasNextPage ? (
                  <Button variant="outline" onClick={() => fetchNextPage()}>
                    {tc("loadMore")}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Bottom sheet mobile */}
      <Sheet open={sheetOpen} onOpenChange={openSheet}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl md:hidden">
          <SheetHeader className="pb-0">
            <SheetTitle>{t("filters")}</SheetTitle>
            <SheetDescription className="sr-only">{t("filters")}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <FiltersPanel
              value={draft}
              facets={facets}
              locked={locked}
              draft
              resultCount={totalCount}
              onChange={setDraft}
              onClear={() => {
                setDraft({ q: filters.q, sort: filters.sort });
              }}
              onApply={() => {
                navigate(draft);
                setSheetOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </PageContainer>
  );
}

function ProductGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", className)}>{children}</div>;
}

interface Chip {
  key: string;
  label: string;
  remove: (f: SearchFilters) => SearchFilters;
}

function buildChips(
  filters: SearchFilters,
  locked: RemovableFilterKey[],
  facets: ProductSearchFacetsDto | undefined,
  t: ReturnType<typeof useTranslations<"catalog">>,
): Chip[] {
  const chips: Chip[] = [];
  const has = (k: RemovableFilterKey) => !locked.includes(k) && filters[k] !== undefined && filters[k] !== false;
  if (has("categorySlug")) {
    const name = facets?.categories.find((c) => c.slug === filters.categorySlug)?.name ?? filters.categorySlug!;
    chips.push({ key: "category", label: name, remove: (f) => ({ ...f, categorySlug: undefined }) });
  }
  if (has("sellerSlug")) {
    const name = facets?.sellers.find((s) => s.slug === filters.sellerSlug)?.name ?? filters.sellerSlug!;
    chips.push({ key: "seller", label: name, remove: (f) => ({ ...f, sellerSlug: undefined }) });
  }
  if (has("minPrice") || has("maxPrice")) {
    const min = filters.minPrice !== undefined ? formatMoney({ amount: filters.minPrice, currency: "BRL" }) : null;
    const max = filters.maxPrice !== undefined ? formatMoney({ amount: filters.maxPrice, currency: "BRL" }) : null;
    chips.push({
      key: "price",
      label: min && max ? `${min} – ${max}` : min ? `≥ ${min}` : `≤ ${max}`,
      remove: (f) => ({ ...f, minPrice: undefined, maxPrice: undefined }),
    });
  }
  if (has("freeShipping")) chips.push({ key: "free", label: t("freeShipping"), remove: (f) => ({ ...f, freeShipping: undefined }) });
  if (has("onlyOffers")) chips.push({ key: "offers", label: t("filterOffers"), remove: (f) => ({ ...f, onlyOffers: undefined }) });
  if (has("minRating"))
    chips.push({ key: "rating", label: t("filterRatingMin", { stars: filters.minRating! }), remove: (f) => ({ ...f, minRating: undefined }) });
  return chips;
}
