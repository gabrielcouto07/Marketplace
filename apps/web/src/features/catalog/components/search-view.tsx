"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowUpDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { BackButton } from "@/components/shared/back-button";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { catalogApi, useProductSearch } from "@/features/catalog/api";
import { usePathname, useRouter } from "@/i18n/navigation";
import { queryKeys } from "@/lib/api/query-keys";
import { cn } from "@/lib/utils";

import { CategoryHeader } from "./category-header";
import { FilterChip, FiltersPanel, TOP_RATING } from "./filters-panel";
import {
  SORT_OPTIONS,
  countActiveFilters,
  filtersToQuery,
  filtersToSearchParams,
  parseSearchFilters,
  type RemovableFilterKey,
  type SearchFilters,
} from "./search-filters";
import { SearchSuggestions, addRecentSearch } from "./search-suggestions";

interface SearchViewProps {
  /** Filtros fixados pelo contexto da página (ex.: { categorySlug: "celulares" }). */
  fixed?: Partial<Pick<SearchFilters, "categorySlug" | "sellerSlug">>;
  /** Embutida (ex.: aba Produtos da loja): sem barra de topo nem título; só chips e resultados. */
  hideHeading?: boolean;
  className?: string;
}

/**
 * Busca/listagem com filtros na URL, infinite scroll e filtros em bottom sheet (mobile) / sidebar (≥ lg).
 * - `/busca`: barra sticky própria (voltar + input pill); a página passa `hideMobileBar` ao StoreShell.
 * - `/categoria/[slug]`: o Header padrão (voltar + pill) e o `CategoryHeader` como h1.
 * - embutida (`hideHeading`): só a linha de chips e a grade.
 * Precisa estar dentro de <Suspense> (usa useSearchParams).
 */
export function SearchView({ fixed = {}, hideHeading, className }: SearchViewProps) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const locked = useMemo(
    () => Object.keys(fixed).filter((k) => fixed[k as keyof typeof fixed]) as RemovableFilterKey[],
    [fixed],
  );
  const filters = useMemo<SearchFilters>(
    () => ({ ...parseSearchFilters(searchParams), ...fixed }),
    [searchParams, fixed],
  );

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
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPlaceholderData,
  } = useProductSearch(query);

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const totalCount = data?.pages[0]?.totalCount ?? 0;
  const facets = data?.pages[0]?.facets;
  const activeCount = countActiveFilters(filters, locked);

  const mode: "search" | "category" | "embedded" = hideHeading
    ? "embedded"
    : fixed.categorySlug
      ? "category"
      : "search";
  // Sugestões só na busca livre sem termo nem filtros.
  const showSuggestions = mode === "search" && !fixed.sellerSlug && !filters.q && activeCount === 0;

  // Histórico de buscas: registra o termo aplicado na URL.
  useEffect(() => {
    if (filters.q) addRecentSearch(filters.q);
  }, [filters.q]);

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

  // Bottom sheet (mobile) com rascunho; a contagem do botão "Ver N produtos" segue o rascunho.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const openSheet = (open: boolean) => {
    if (open) setDraft(filters); // sincroniza o rascunho com a URL ao abrir
    setSheetOpen(open);
  };
  const draftQuery = useMemo(() => ({ ...filtersToQuery(draft), pageSize: 1, page: 1 }), [draft]);
  const preview = useQuery({
    queryKey: queryKeys.products.search(draftQuery),
    queryFn: () => catalogApi.search(draftQuery),
    enabled: sheetOpen,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
  const draftCount = preview.data?.totalCount ?? totalCount;
  const draftActiveCount = countActiveFilters(draft, locked);

  const clearAll = () => navigate({ q: filters.q, sort: filters.sort });
  const topRated = filters.minRating !== undefined && filters.minRating >= TOP_RATING;

  const sortItems = useMemo(
    () => Object.fromEntries(SORT_OPTIONS.map((s) => [s, t(`sortOptions.${s}`)])),
    [t],
  );

  return (
    <div className={cn("flex flex-col", className)}>
      {mode === "search" ? (
        <div className="sticky top-0 z-30 border-b border-border bg-surface/85 pt-safe backdrop-blur-md supports-backdrop-filter:bg-surface/80 md:hidden">
          <PageContainer className="flex h-16 items-center gap-3">
            <BackButton className="-ml-2" />
            <SearchField
              value={filters.q ?? ""}
              onSubmit={(q) => navigate({ ...filters, q: q || undefined })}
              autoFocus={!filters.q}
            />
          </PageContainer>
        </div>
      ) : null}

      {showSuggestions ? (
        <SearchSuggestions onPick={(term) => navigate({ ...filters, q: term })} />
      ) : (
        <PageContainer
          className={cn("flex flex-col gap-4", mode === "embedded" ? "pt-4" : "pt-4 md:pt-8")}
        >
          {mode === "search" ? (
            <h1 className="hidden text-title-1 text-foreground md:block">
              {filters.q ? t("resultsFor", { query: filters.q }) : t("searchTitle")}
            </h1>
          ) : null}
          {mode === "category" ? (
            <CategoryHeader
              slug={fixed.categorySlug!}
              resultCount={isPending ? undefined : totalCount}
            />
          ) : null}

          <div className="flex items-start gap-8">
            {/* Sidebar (≥ lg) */}
            <aside className="hidden w-64 shrink-0 lg:block">
              <div className="sticky top-20 flex flex-col gap-6 rounded-lg border border-border bg-surface p-4 shadow-xs">
                <h2 className="text-title-3 text-foreground">{t("filters")}</h2>
                <FiltersPanel value={filters} facets={facets} locked={locked} onChange={navigate} />
                <Button variant="ghost" onClick={clearAll} disabled={activeCount === 0}>
                  {t("clearFilters")}
                </Button>
              </div>
            </aside>

            <section
              className="flex min-w-0 flex-1 flex-col gap-4"
              aria-live="polite"
              aria-busy={isPending || isPlaceholderData}
            >
              {/* Filtros rápidos */}
              <div className="-mx-4 scrollbar-none flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0 lg:hidden"
                  onClick={() => openSheet(true)}
                  aria-haspopup="dialog"
                  aria-expanded={sheetOpen}
                >
                  <SlidersHorizontal data-icon="inline-start" strokeWidth={1.75} />
                  {t("filters")}
                  {activeCount > 0 ? (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-caption text-primary-foreground tabular-nums"
                      aria-label={t("activeFilters", { count: activeCount })}
                    >
                      {activeCount}
                    </span>
                  ) : null}
                </Button>
                {!locked.includes("freeShipping") ? (
                  <FilterChip
                    active={Boolean(filters.freeShipping)}
                    onClick={() =>
                      navigate({
                        ...filters,
                        freeShipping: filters.freeShipping ? undefined : true,
                      })
                    }
                  >
                    {t("quickFreeShipping")}
                  </FilterChip>
                ) : null}
                <FilterChip
                  active={Boolean(filters.onlyOffers)}
                  onClick={() =>
                    navigate({ ...filters, onlyOffers: filters.onlyOffers ? undefined : true })
                  }
                >
                  {t("quickOffers")}
                </FilterChip>
                <FilterChip
                  active={topRated}
                  onClick={() =>
                    navigate({ ...filters, minRating: topRated ? undefined : TOP_RATING })
                  }
                >
                  {t("quickRatingTop")}
                </FilterChip>
              </div>

              {/* Contagem (na categoria ela já está no cabeçalho) + ordenação */}
              <div className="flex items-center justify-between gap-3">
                {mode !== "category" ? (
                  <p className="text-body-sm text-foreground-secondary tabular-nums">
                    {isPending ? tc("loading") : t("resultsCount", { count: totalCount })}
                  </p>
                ) : null}
                <Select
                  value={filters.sort ?? "relevance"}
                  onValueChange={(value) => {
                    const sort = SORT_OPTIONS.find((s) => s === value);
                    if (sort) navigate({ ...filters, sort });
                  }}
                  items={sortItems}
                >
                  <SelectTrigger size="sm" aria-label={t("sort")} className="ml-auto shrink-0">
                    <ArrowUpDown
                      className="text-foreground-secondary"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" alignItemWithTrigger={false}>
                    {SORT_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {sortItems[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  illustration="search"
                  title={t("noResultsTitle")}
                  description={t("noResultsDescription")}
                  action={
                    activeCount > 0 ? (
                      <Button onClick={clearAll}>{t("clearFilters")}</Button>
                    ) : filters.q ? (
                      <Button onClick={() => navigate({ sort: filters.sort })}>
                        {tn("clearSearch")}
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <ProductGrid
                    className={cn("transition-opacity", isPlaceholderData && "opacity-60")}
                  >
                    {items.map((p, i) => (
                      <ProductCard key={p.id} product={p} priority={i < 4} />
                    ))}
                  </ProductGrid>
                  <div ref={sentinelRef} className="flex justify-center py-4">
                    {hasNextPage ? (
                      <Button
                        variant="secondary"
                        loading={isFetchingNextPage}
                        onClick={() => fetchNextPage()}
                      >
                        {tc("loadMore")}
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </section>
          </div>
        </PageContainer>
      )}

      {/* Filtros no mobile: bottom sheet com rascunho */}
      <BottomSheet open={sheetOpen} onOpenChange={openSheet}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>{t("filters")}</BottomSheetTitle>
            <BottomSheetDescription>{t("filtersDescription")}</BottomSheetDescription>
          </BottomSheetHeader>
          <BottomSheetBody className="py-4">
            <FiltersPanel value={draft} facets={facets} locked={locked} onChange={setDraft} />
          </BottomSheetBody>
          <BottomSheetFooter>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                disabled={draftActiveCount === 0}
                onClick={() => setDraft({ ...fixed, q: filters.q, sort: filters.sort })}
              >
                {t("clear")}
              </Button>
              <Button
                className="flex-1"
                loading={preview.isPending && sheetOpen}
                onClick={() => {
                  navigate(draft);
                  setSheetOpen(false);
                }}
              >
                {t("applyFilters", { count: draftCount })}
              </Button>
            </div>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}

/* --------------------------------- Partes --------------------------------- */

/** Input pill de 48 px (mesmo desenho do header): ícone de busca, limpar e envio por Enter. */
function SearchField({
  value,
  onSubmit,
  autoFocus,
}: {
  value: string;
  onSubmit: (query: string) => void;
  autoFocus?: boolean;
}) {
  const t = useTranslations("catalog");
  const tn = useTranslations("nav");
  const inputRef = useRef<HTMLInputElement>(null);
  // Estado derivado da URL, sincronizado sem effect.
  const [input, setInput] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setInput(value);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(input.trim());
  };

  return (
    <form role="search" onSubmit={submit} className="relative min-w-0 flex-1">
      <label htmlFor="mobile-search" className="sr-only">
        {tn("searchLabel")}
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-foreground-secondary"
        strokeWidth={1.75}
      />
      <input
        id="mobile-search"
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={tn("searchPlaceholder")}
        className="h-12 w-full rounded-full border border-transparent bg-surface-muted pr-12 pl-12 text-body text-foreground transition-colors outline-none placeholder:text-foreground-muted hover:bg-border focus-visible:border-primary focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-focus-ring/25 [&::-webkit-search-cancel-button]:hidden"
      />
      {input ? (
        <button
          type="button"
          aria-label={tn("clearSearch")}
          onClick={() => {
            setInput("");
            if (value) onSubmit("");
            inputRef.current?.focus();
          }}
          className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-foreground-secondary focus-ring transition-colors hover:bg-border hover:text-foreground"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
      <button type="submit" className="sr-only">
        {t("searchSubmit")}
      </button>
    </form>
  );
}

function ProductGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}
