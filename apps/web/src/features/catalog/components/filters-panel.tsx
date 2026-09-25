"use client";

import type { ProductSearchFacetsDto } from "@marketplace/contracts";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { RemovableFilterKey, SearchFilters } from "./search-filters";

interface FiltersPanelProps {
  value: SearchFilters;
  facets?: ProductSearchFacetsDto;
  /** Filtros fixados pelo contexto (ex.: categoria na página de categoria) — não exibidos. */
  locked?: RemovableFilterKey[];
  onChange: (next: SearchFilters) => void;
  onClear: () => void;
  /** Modo "rascunho": alterações só aplicam no botão (bottom sheet). */
  draft?: boolean;
  resultCount?: number;
  onApply?: () => void;
  className?: string;
}

function centsToReais(cents?: number): string {
  return cents === undefined ? "" : String(Math.floor(cents / 100));
}

function reaisToCents(value: string): number | undefined {
  const n = Number(value.replace(",", "."));
  if (!value || !Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

/** Painel de filtros reutilizado no bottom sheet (mobile) e na sidebar (desktop). */
export function FiltersPanel({ value, facets, locked = [], onChange, onClear, draft, resultCount, onApply, className }: FiltersPanelProps) {
  const t = useTranslations("catalog");
  // Texto dos inputs de preço: reseta quando o filtro aplicado muda (estado derivado, sem effect).
  const [priceText, setPriceText] = useState({ min: value.minPrice, max: value.maxPrice, minText: centsToReais(value.minPrice), maxText: centsToReais(value.maxPrice) });
  const synced = priceText.min === value.minPrice && priceText.max === value.maxPrice;
  const minText = synced ? priceText.minText : centsToReais(value.minPrice);
  const maxText = synced ? priceText.maxText : centsToReais(value.maxPrice);
  const setMinText = (text: string) => setPriceText({ min: value.minPrice, max: value.maxPrice, minText: text, maxText });
  const setMaxText = (text: string) => setPriceText({ min: value.minPrice, max: value.maxPrice, minText, maxText: text });

  const set = (patch: Partial<SearchFilters>) => onChange({ ...value, ...patch });
  const show = (key: RemovableFilterKey) => !locked.includes(key);

  const commitPrice = () => set({ minPrice: reaisToCents(minText), maxPrice: reaisToCents(maxText) });

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* Preço */}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t("filterPrice")}</legend>
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="sr-only">{t("filterMinPrice")}</span>
            <span className="flex h-11 items-center rounded-lg border border-input px-3 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="mr-1 text-muted-foreground">R$</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder={t("filterMinPrice")}
                value={minText}
                onChange={(e) => setMinText(e.target.value)}
                onBlur={commitPrice}
                onKeyDown={(e) => e.key === "Enter" && commitPrice()}
                className="w-full min-w-0 bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </span>
          </label>
          <span aria-hidden className="text-muted-foreground">
            –
          </span>
          <label className="flex-1">
            <span className="sr-only">{t("filterMaxPrice")}</span>
            <span className="flex h-11 items-center rounded-lg border border-input px-3 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="mr-1 text-muted-foreground">R$</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder={t("filterMaxPrice")}
                value={maxText}
                onChange={(e) => setMaxText(e.target.value)}
                onBlur={commitPrice}
                onKeyDown={(e) => e.key === "Enter" && commitPrice()}
                className="w-full min-w-0 bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </span>
          </label>
        </div>
      </fieldset>

      {/* Frete / ofertas */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-semibold">{t("filterShipping")}</legend>
        {show("freeShipping") ? (
          <Label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-normal">
            <Checkbox checked={Boolean(value.freeShipping)} onCheckedChange={(checked) => set({ freeShipping: checked ? true : undefined })} />
            {t("filterFreeShipping")}
          </Label>
        ) : null}
        {show("onlyOffers") ? (
          <Label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-normal">
            <Checkbox checked={Boolean(value.onlyOffers)} onCheckedChange={(checked) => set({ onlyOffers: checked ? true : undefined })} />
            {t("filterOffers")}
          </Label>
        ) : null}
      </fieldset>

      {/* Avaliação */}
      {show("minRating") ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("filterRating")}</legend>
          <div className="flex flex-wrap gap-2">
            {[4, 3, 2].map((stars) => {
              const active = value.minRating === stars;
              return (
                <button
                  key={stars}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set({ minRating: active ? undefined : stars })}
                  className={cn(
                    "flex h-10 items-center gap-1 rounded-full border px-3 text-sm transition-colors",
                    active ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-muted",
                  )}
                >
                  <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  {t("filterRatingMin", { stars })}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {/* Categoria */}
      {show("categorySlug") && facets?.categories.length ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("filterCategory")}</legend>
          <ul className="flex flex-col">
            {facets.categories.map((c) => {
              const active = value.categorySlug === c.slug;
              return (
                <li key={c.slug}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => set({ categorySlug: active ? undefined : c.slug })}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between rounded-lg px-2 text-left text-sm hover:bg-muted",
                      active && "bg-accent font-semibold text-accent-foreground",
                    )}
                  >
                    <span>{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}

      {/* Loja */}
      {show("sellerSlug") && facets?.sellers.length ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("filterSeller")}</legend>
          <ul className="flex flex-col">
            {facets.sellers.map((s) => {
              const active = value.sellerSlug === s.slug;
              return (
                <li key={s.slug}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => set({ sellerSlug: active ? undefined : s.slug })}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between rounded-lg px-2 text-left text-sm hover:bg-muted",
                      active && "bg-accent font-semibold text-accent-foreground",
                    )}
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}

      <div className={cn("flex gap-2", draft && "sticky bottom-0 -mx-4 -mb-4 border-t border-border bg-popover p-4 pb-[calc(1rem+var(--safe-bottom))]")}>
        <Button variant="outline" className="flex-1" onClick={onClear}>
          {t("clearFilters")}
        </Button>
        {draft ? (
          <Button variant="cta" className="flex-1" onClick={onApply}>
            {t("applyFilters", { count: resultCount ?? 0 })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
