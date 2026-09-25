"use client";

import { Clock, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useSyncExternalStore } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { Button } from "@/components/ui/button";

import { FilterChip } from "./filters-panel";

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

export function addRecentSearch(term: string): void {
  const clean = term.trim();
  if (!clean) return;
  const rest = parseRecent(readRecentRaw()).filter((x) => x.toLowerCase() !== clean.toLowerCase());
  writeRecent([clean, ...rest].slice(0, RECENT_MAX));
}

export function clearRecentSearches(): void {
  writeRecent([]);
}

export function useRecentSearches(): string[] {
  const raw = useSyncExternalStore(subscribeRecent, readRecentRaw, () => "[]");
  return useMemo(() => parseRecent(raw), [raw]);
}

/** Conteúdo estático de exemplo ("em alta"); virá do backend quando existir. */
const TRENDING = ["iPhone", "air fryer", "perfume importado", "notebook gamer", "whisky 12 anos"];

/* ----------------------------------- View ----------------------------------- */

interface SearchSuggestionsProps {
  onPick: (term: string) => void;
}

/** Estado sem termo nem filtros: buscas recentes (localStorage) e "em alta", ambos em chips. */
export function SearchSuggestions({ onPick }: SearchSuggestionsProps) {
  const t = useTranslations("catalog");
  const recent = useRecentSearches();

  return (
    <PageContainer className="flex flex-col gap-8 pt-4 md:max-w-2xl md:pt-8">
      {recent.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="recent-searches">
          <div className="flex h-10 items-center justify-between gap-3">
            <h2 id="recent-searches" className="text-body-sm font-semibold text-foreground">
              {t("recentSearches")}
            </h2>
            <Button variant="ghost" size="sm" className="-mr-3" onClick={clearRecentSearches}>
              {t("clearRecent")}
            </Button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {recent.map((term) => (
              <li key={term}>
                <FilterChip onClick={() => onPick(term)} aria-label={t("trendingItem", { term })}>
                  <Clock className="text-foreground-secondary" strokeWidth={1.75} aria-hidden />
                  {term}
                </FilterChip>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="trending-searches">
        <h2 id="trending-searches" className="text-body-sm font-semibold text-foreground">
          {t("trending")}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {TRENDING.map((term) => (
            <li key={term}>
              <FilterChip onClick={() => onPick(term)} aria-label={t("trendingItem", { term })}>
                <TrendingUp className="text-primary" strokeWidth={1.75} aria-hidden />
                {term}
              </FilterChip>
            </li>
          ))}
        </ul>
      </section>
    </PageContainer>
  );
}
