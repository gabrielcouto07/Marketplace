"use client";

import type { ProductSort } from "@marketplace/contracts";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { BackButton } from "@/components/shared/back-button";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useProductSearch } from "@/features/catalog/api";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
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

/* ------------------------- Buscas recentes (localStorage) ------------------------- */

const RECENT_KEY = "mktpy.search.recent";
const RECENT_MAX = 5;
const recentListeners = new Set<() => void>();

function readRecentRaw(): string {
  try {
    return localStorage.getItem(RECENT_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseRecent(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  recentListeners.forEach((l) => l());
}

function subscribeRecent(cb: () => void): () => void {
  recentListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    recentListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function addRecentSearch(term: string): void {
  const clean = term.trim();
  if (!clean) return;
  const rest = parseRecent(readRecentRaw()).filter((x) => x.toLowerCase() !== clean.toLowerCase());
  writeRecent([clean, ...rest].slice(0, RECENT_MAX));
}

function useRecentSearches(): string[] {
  const raw = useSyncExternalStore(subscribeRecent, readRecentRaw, () => "[]");
  return useMemo(() => parseRecent(raw), [raw]);
}

/** Conteúdo estático de exemplo ("em alta"); virá do backend quando existir. */
const TRENDING = ["iPhone", "air fryer", "perfume importado", "notebook gamer", "whisky 12 anos"];

/* ----------------------------------- View ----------------------------------- */

interface SearchViewProps {
  /** Filtros fixados pelo contexto da página (ex.: { categorySlug: "celulares" }). */
  fixed?: Partial<Pick<SearchFilters, "categorySlug" | "sellerSlug">>;
  /** Oculta o título "Resultados para …" (desktop). */
  hideHeading?: boolean;
  className?: string;
}

/**
 * Busca/listagem com filtros na URL, infinite scroll e filtros em bottom sheet (mobile) / sidebar (desktop).
 * Na página de categoria, desenha o nome da categoria na barra fixa do topo.
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

  const isCategoryPage = Boolean(fixed.categorySlug);
  // Sugestões só na busca livre (não em categoria, loja ou quando há termo/filtros).
  const showSuggestions = !isCategoryPage && !fixed.sellerSlug && !filters.q && activeCount === 0;

  // Histórico de buscas: registra o termo aplicado na URL.
  const recent = useRecentSearches();
  useEffect(() => {
    if (filters.q) addRecentSearch(filters.q);
  }, [filters.q]);

  // Campo de busca (mobile): estado derivado da URL, sincronizado sem effect.
  const urlQuery = filters.q ?? "";
  const [input, setInput] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (syncedQuery !== urlQuery) {
    setSyncedQuery(urlQuery);
    setInput(urlQuery);
  }
  const inputRef = useRef<HTMLInputElement>(null);
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate({ ...filters, q: input.trim() || undefined });
  };

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
  const topRated = filters.minRating !== undefined && filters.minRating >= TOP_RATING;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Topo fixo (mobile): voltar + busca / nome da categoria, e a linha de chips */}
      <div
        className={cn(
          "z-30 flex flex-col gap-3",
          // Embutida (ex.: aba Produtos da loja) não tem barra de topo nem fica fixa.
          !hideHeading &&
            "sticky top-0 bg-background/95 pt-safe backdrop-blur-md supports-backdrop-filter:bg-background/90 md:static md:bg-transparent md:backdrop-blur-none",
        )}
      >
        <PageContainer
          className={cn("flex flex-col gap-3 pb-2.5", hideHeading ? "px-0" : "pt-3 md:pt-6")}
        >
          {hideHeading ? null : (
            <div className="flex items-center gap-2">
              <BackButton className="md:hidden" />
              {isCategoryPage ? (
                <>
                  <CategoryHeader
                    slug={fixed.categorySlug!}
                    resultCount={isPending ? undefined : totalCount}
                  />
                  <Button
                    variant="white"
                    size="icon"
                    className="md:hidden"
                    render={<Link href="/busca" aria-label={tn("openSearch")} />}
                  >
                    <Search strokeWidth={2.2} />
                  </Button>
                </>
              ) : (
                <>
                  <form
                    role="search"
                    onSubmit={submitSearch}
                    className="flex h-[46px] flex-1 items-center gap-2 rounded-lg bg-card px-3 ring-2 ring-primary md:hidden"
                  >
                    <Search
                      className="size-[19px] shrink-0 text-primary"
                      strokeWidth={2.2}
                      aria-hidden
                    />
                    <label htmlFor="mobile-search" className="sr-only">
                      {tn("searchLabel")}
                    </label>
                    <input
                      id="mobile-search"
                      ref={inputRef}
                      type="search"
                      inputMode="search"
                      enterKeyHint="search"
                      autoComplete="off"
                      autoFocus={!filters.q}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={tn("searchPlaceholder")}
                      className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-placeholder [&::-webkit-search-cancel-button]:hidden"
                    />
                    {input ? (
                      <button
                        type="button"
                        aria-label={tn("clearSearch")}
                        onClick={() => {
                          setInput("");
                          if (filters.q) navigate({ ...filters, q: undefined });
                          inputRef.current?.focus();
                        }}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-strong text-foreground hover:bg-line-200"
                      >
                        <X className="size-[13px]" strokeWidth={2.6} aria-hidden />
                      </button>
                    ) : null}
                    <button type="submit" className="sr-only">
                      {t("searchSubmit")}
                    </button>
                  </form>
                  {!hideHeading ? (
                    <h1 className="hidden text-[28px] font-extrabold tracking-[-0.03em] md:block">
                      {filters.q ? t("resultsFor", { query: filters.q }) : t("searchTitle")}
                    </h1>
                  ) : null}
                </>
              )}
            </div>
          )}

          {!showSuggestions ? (
            <div className="-mx-4 scrollbar-none flex gap-2 overflow-x-auto px-4">
              <Button
                variant="ink"
                size="sm"
                className="h-[38px] shrink-0 gap-1.5 px-3"
                onClick={() => openSheet(true)}
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
              >
                <SlidersHorizontal className="size-4" strokeWidth={2.2} />
                {t("filters")}
                {activeCount > 0 ? (
                  <span
                    className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-cta px-1.5 text-[11px] font-extrabold text-cta-foreground"
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
                    navigate({ ...filters, freeShipping: filters.freeShipping ? undefined : true })
                  }
                  className="h-[38px] px-3 text-[13px]"
                >
                  {t("quickFreeShipping")}
                </FilterChip>
              ) : null}
              <FilterChip
                active={Boolean(filters.onlyOffers)}
                onClick={() =>
                  navigate({ ...filters, onlyOffers: filters.onlyOffers ? undefined : true })
                }
                className="h-[38px] px-3 text-[13px]"
              >
                {t("quickOffers")}
              </FilterChip>
              <FilterChip
                active={topRated}
                onClick={() =>
                  navigate({ ...filters, minRating: topRated ? undefined : TOP_RATING })
                }
                className="h-[38px] px-3 text-[13px]"
              >
                {t("quickRatingTop")}
              </FilterChip>
            </div>
          ) : null}
        </PageContainer>
      </div>

      {showSuggestions ? (
        <Suggestions
          recent={recent}
          onPick={(term) => navigate({ ...filters, q: term })}
          onClearRecent={() => writeRecent([])}
        />
      ) : (
        <PageContainer className="flex gap-6 pt-1">
          {/* Sidebar desktop */}
          <aside className="hidden w-64 shrink-0 md:block">
            <div className="sticky top-20 rounded-3xl bg-card p-5 shadow-card">
              <h2 className="mb-4 text-lg font-extrabold tracking-tight">{t("filters")}</h2>
              <FiltersPanel
                value={filters}
                facets={facets}
                locked={locked}
                onChange={navigate}
                onClear={clearAll}
              />
            </div>
          </aside>

          <section
            className="flex min-w-0 flex-1 flex-col gap-3"
            aria-live="polite"
            aria-busy={isPending || isPlaceholderData}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-semibold text-muted-foreground tabular-nums">
                {isPending ? tc("loading") : t("resultsCount", { count: totalCount })}
              </p>
              <label className="relative flex h-9 shrink-0 items-center text-[13px] font-bold text-primary">
                <span className="sr-only">{t("sort")}</span>
                <select
                  value={filters.sort ?? "relevance"}
                  onChange={(e) => navigate({ ...filters, sort: e.target.value as ProductSort })}
                  className="h-9 cursor-pointer appearance-none rounded-md bg-transparent pr-5 text-right text-[13px] font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {SORT_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`sortOptions.${s}`)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden
                  className="pointer-events-none absolute right-0 size-4"
                  strokeWidth={2.4}
                />
              </label>
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
                className="animate-rise"
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
                <ProductGrid className={cn(isPlaceholderData && "opacity-60 transition-opacity")}>
                  {items.map((p, i) => (
                    <div
                      key={p.id}
                      className="animate-rise"
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    >
                      <ProductCard product={p} priority={i < 4} />
                    </div>
                  ))}
                </ProductGrid>
                <div ref={sentinelRef} className="flex justify-center py-6">
                  {isFetchingNextPage ? (
                    <Loader2
                      className="size-6 animate-spin text-muted-foreground"
                      aria-label={tc("loading")}
                    />
                  ) : hasNextPage ? (
                    <Button variant="outline" onClick={() => fetchNextPage()}>
                      {tc("loadMore")}
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </PageContainer>
      )}

      {/* Bottom sheet mobile */}
      <Sheet open={sheetOpen} onOpenChange={openSheet}>
        <SheetContent side="bottom" showCloseButton={false} className="md:hidden">
          <div className="flex items-center justify-between px-4 pt-1 pb-3">
            <SheetTitle className="text-xl">{t("filters")}</SheetTitle>
            <SheetDescription className="sr-only">{t("filters")}</SheetDescription>
            <SheetClose
              render={<Button variant="secondary" size="icon-sm" aria-label={t("closeFilters")} />}
            >
              <X strokeWidth={2.4} />
            </SheetClose>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <FiltersPanel
              value={draft}
              facets={facets}
              locked={locked}
              draft
              resultCount={totalCount}
              onChange={setDraft}
              onClear={() => setDraft({ q: filters.q, sort: filters.sort })}
              onApply={() => {
                navigate(draft);
                setSheetOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ProductGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

/** Estado sem termo nem filtros: buscas recentes (localStorage) e lista "em alta". */
function Suggestions({
  recent,
  onPick,
  onClearRecent,
}: {
  recent: string[];
  onPick: (term: string) => void;
  onClearRecent: () => void;
}) {
  const t = useTranslations("catalog");
  return (
    <PageContainer className="flex flex-col gap-[22px] pt-2 md:max-w-2xl">
      {recent.length > 0 ? (
        <section className="flex animate-rise flex-col gap-2.5" aria-labelledby="recent-searches">
          <div className="flex items-center justify-between">
            <h2
              id="recent-searches"
              className="text-[13px] font-bold tracking-[0.06em] text-muted-foreground uppercase"
            >
              {t("recentSearches")}
            </h2>
            <button
              type="button"
              onClick={onClearRecent}
              className="rounded-md py-1 text-[13px] font-bold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {t("clearRecent")}
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {recent.map((term, i) => (
              <li key={term} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                <button
                  type="button"
                  onClick={() => onPick(term)}
                  className="flex h-[38px] pressable items-center gap-1.5 rounded-md bg-card px-3 text-[13.5px] font-semibold shadow-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Clock className="size-3.5 text-muted-foreground" strokeWidth={2.2} aria-hidden />
                  {term}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className="flex animate-rise flex-col rounded-2xl bg-card px-3.5 py-2 shadow-card"
        style={{ animationDelay: "80ms" }}
        aria-labelledby="trending-searches"
      >
        <h2
          id="trending-searches"
          className="py-2 text-[13px] font-bold tracking-[0.06em] text-muted-foreground uppercase"
        >
          {t("trending")}
        </h2>
        <ol className="flex flex-col">
          {TRENDING.map((term, i) => (
            <li key={term} className="border-t border-border">
              <button
                type="button"
                onClick={() => onPick(term)}
                aria-label={t("trendingItem", { term })}
                className="flex w-full items-center gap-3 py-2.5 text-left text-[14.5px] font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "flex size-[26px] shrink-0 items-center justify-center rounded-[8px] text-[12.5px] font-extrabold tabular-nums",
                    i < 3 ? "bg-destructive-soft text-cta" : "bg-surface text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="flex-1">{term}</span>
                <ChevronRight className="size-4 text-chevron" strokeWidth={2.2} aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      </section>
    </PageContainer>
  );
}
