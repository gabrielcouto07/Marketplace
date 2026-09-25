"use client";

import type { ProductSearchFacetsDto } from "@marketplace/contracts";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { RemovableFilterKey, SearchFilters } from "./search-filters";

/** Nota mínima do atalho "bem avaliados" (a URL guarda inteiros). */
export const TOP_RATING = 4.5;

/** Faixas de preço em centavos (BRL) — espelham os chips do protótipo. */
const PRICE_RANGES: Array<{ key: string; min?: number; max?: number }> = [
  { key: "a", max: 30_000 },
  { key: "b", min: 30_000, max: 100_000 },
  { key: "c", min: 100_000, max: 200_000 },
  { key: "d", min: 200_000 },
];

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

/** Chip de seleção (preço, categoria, loja): branco com borda, azul quando ativo. */
export function FilterChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-10 shrink-0 pressable items-center gap-1.5 rounded-md border-[1.5px] px-3.5 text-[13.5px] font-bold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-line-200 bg-card text-foreground hover:border-primary/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Painel de filtros reutilizado no bottom sheet (mobile, `draft`) e na sidebar (desktop). */
export function FiltersPanel({
  value,
  facets,
  locked = [],
  onChange,
  onClear,
  draft,
  resultCount,
  onApply,
  className,
}: FiltersPanelProps) {
  const t = useTranslations("catalog");
  const format = useFormatter();
  // Texto dos inputs de preço: reseta quando o filtro aplicado muda (estado derivado, sem effect).
  const [priceText, setPriceText] = useState({
    min: value.minPrice,
    max: value.maxPrice,
    minText: centsToReais(value.minPrice),
    maxText: centsToReais(value.maxPrice),
  });
  const synced = priceText.min === value.minPrice && priceText.max === value.maxPrice;
  const minText = synced ? priceText.minText : centsToReais(value.minPrice);
  const maxText = synced ? priceText.maxText : centsToReais(value.maxPrice);
  const setMinText = (text: string) =>
    setPriceText({ min: value.minPrice, max: value.maxPrice, minText: text, maxText });
  const setMaxText = (text: string) =>
    setPriceText({ min: value.minPrice, max: value.maxPrice, minText, maxText: text });

  const set = (patch: Partial<SearchFilters>) => onChange({ ...value, ...patch });
  const show = (key: RemovableFilterKey) => !locked.includes(key);
  const commitPrice = () =>
    set({ minPrice: reaisToCents(minText), maxPrice: reaisToCents(maxText) });

  const money = (cents: number) =>
    format.number(cents / 100, { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const rangeLabel = (r: (typeof PRICE_RANGES)[number]) =>
    r.min !== undefined && r.max !== undefined
      ? t("priceBetween", { min: money(r.min), max: money(r.max) })
      : r.max !== undefined
        ? t("priceUpTo", { max: money(r.max) })
        : t("priceAbove", { min: money(r.min ?? 0) });

  const topRated = value.minRating !== undefined && value.minRating >= TOP_RATING;

  const toggles: Array<{
    key: RemovableFilterKey;
    label: string;
    hint: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }> = [
    {
      key: "freeShipping",
      label: t("filterFreeShipping"),
      hint: t("filterFreeShippingHint"),
      checked: Boolean(value.freeShipping),
      onChange: (c) => set({ freeShipping: c || undefined }),
    },
    {
      key: "onlyOffers",
      label: t("filterOffers"),
      hint: t("filterOffersHint"),
      checked: Boolean(value.onlyOffers),
      onChange: (c) => set({ onlyOffers: c || undefined }),
    },
    {
      key: "minRating",
      label: t("filterRatingTop"),
      hint: t("filterRatingTopHint"),
      checked: topRated,
      onChange: (c) => set({ minRating: c ? TOP_RATING : undefined }),
    },
  ];

  return (
    <div className={cn("flex flex-col gap-[18px]", className)}>
      {/* Preço */}
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-extrabold">{t("filterPrice")}</legend>
        <div className="flex flex-wrap gap-2">
          {PRICE_RANGES.map((r) => {
            const active = value.minPrice === r.min && value.maxPrice === r.max;
            return (
              <FilterChip
                key={r.key}
                active={active}
                onClick={() =>
                  set(
                    active
                      ? { minPrice: undefined, maxPrice: undefined }
                      : { minPrice: r.min, maxPrice: r.max },
                  )
                }
              >
                {rangeLabel(r)}
              </FilterChip>
            );
          })}
        </div>
        {!draft ? (
          <div className="flex items-center gap-2">
            <PriceInput
              label={t("filterMinPrice")}
              value={minText}
              onChange={setMinText}
              onCommit={commitPrice}
            />
            <span aria-hidden className="text-muted-foreground">
              –
            </span>
            <PriceInput
              label={t("filterMaxPrice")}
              value={maxText}
              onChange={setMaxText}
              onCommit={commitPrice}
            />
          </div>
        ) : null}
      </fieldset>

      {/* Interruptores: frete grátis / só ofertas / bem avaliados */}
      <div className="flex flex-col">
        {toggles
          .filter((tg) => show(tg.key))
          .map((tg) => (
            <label
              key={tg.key}
              className="flex cursor-pointer items-center gap-3 border-t border-border py-3.5 select-none"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-bold">{tg.label}</span>
                <span className="text-[12.5px] text-muted-foreground">{tg.hint}</span>
              </span>
              <Switch checked={tg.checked} onCheckedChange={(checked) => tg.onChange(checked)} />
            </label>
          ))}
      </div>

      {/* Categoria */}
      {show("categorySlug") && facets?.categories.length ? (
        <FacetList
          title={t("filterCategory")}
          items={facets.categories.map((c) => ({
            key: c.slug,
            name: c.name,
            count: c.count,
            active: value.categorySlug === c.slug,
          }))}
          onToggle={(slug, active) => set({ categorySlug: active ? undefined : slug })}
        />
      ) : null}

      {/* Loja */}
      {show("sellerSlug") && facets?.sellers.length ? (
        <FacetList
          title={t("filterSeller")}
          items={facets.sellers.map((s) => ({
            key: s.slug,
            name: s.name,
            count: s.count,
            active: value.sellerSlug === s.slug,
          }))}
          onToggle={(slug, active) => set({ sellerSlug: active ? undefined : slug })}
        />
      ) : null}

      {/* Rodapé */}
      <div
        className={cn(
          "grid gap-2.5",
          draft
            ? "sticky bottom-0 -mx-4 grid-cols-[1fr_2fr] border-t border-border bg-popover px-4 py-3"
            : "grid-cols-1",
        )}
      >
        <Button variant="secondary" size="lg" className="font-extrabold" onClick={onClear}>
          {draft ? t("clear") : t("clearFilters")}
        </Button>
        {draft ? (
          <Button size="lg" className="font-extrabold" onClick={onApply}>
            {t("applyFilters", { count: resultCount ?? 0 })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PriceInput({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className="flex-1">
      <span className="sr-only">{label}</span>
      <span className="flex h-11 items-center rounded-lg border-[1.5px] border-input bg-card px-3 text-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <span className="mr-1 text-muted-foreground">R$</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => e.key === "Enter" && onCommit()}
          className="w-full min-w-0 [appearance:textfield] bg-transparent outline-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </span>
    </label>
  );
}

function FacetList({
  title,
  items,
  onToggle,
}: {
  title: string;
  items: Array<{ key: string; name: string; count: number; active: boolean }>;
  onToggle: (key: string, active: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-extrabold">{title}</legend>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              aria-pressed={item.active}
              onClick={() => onToggle(item.key, item.active)}
              className={cn(
                "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                item.active && "bg-selected font-bold text-primary",
              )}
            >
              <span className="truncate">{item.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{item.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
