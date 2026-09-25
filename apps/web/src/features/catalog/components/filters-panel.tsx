"use client";

import type { ProductSearchFacetsDto } from "@marketplace/contracts";
import { cva, type VariantProps } from "class-variance-authority";
import { Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { RemovableFilterKey, SearchFilters } from "./search-filters";

/** Nota mínima do atalho "bem avaliados" (a URL guarda uma casa decimal). */
export const TOP_RATING = 4.5;

/** Notas mínimas oferecidas como chips na seção "Avaliação". */
const RATING_OPTIONS = [3, 4, TOP_RATING] as const;

/** Faixas de preço em centavos (BRL). */
const PRICE_RANGES: Array<{ key: string; min?: number; max?: number }> = [
  { key: "a", max: 30_000 },
  { key: "b", min: 30_000, max: 100_000 },
  { key: "c", min: 100_000, max: 200_000 },
  { key: "d", min: 200_000 },
];

/* ---------------------------------- Chip ---------------------------------- */

const filterChipVariants = cva(
  "inline-flex shrink-0 pressable items-center gap-1.5 rounded-full border whitespace-nowrap transition-colors select-none focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      size: {
        sm: "h-8 px-3 text-caption [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-10 px-4 text-body-sm font-medium [&_svg:not([class*='size-'])]:size-4",
      },
      active: {
        true: "border-primary bg-primary-soft text-primary",
        false: "border-border-strong bg-surface text-foreground hover:bg-surface-muted",
      },
    },
    defaultVariants: { size: "md", active: false },
  },
);

interface FilterChipProps
  extends
    Omit<ComponentProps<"button">, "type">,
    Omit<VariantProps<typeof filterChipVariants>, "active"> {
  /** Estado de seleção (`aria-pressed`). Omitido em chips que só navegam (sugestões). */
  active?: boolean;
}

/** Chip pill: borda forte em repouso, azul suave quando ativo. Usado em filtros rápidos, facetas e sugestões. */
export function FilterChip({ active, size, className, children, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active === undefined ? undefined : active}
      className={cn(filterChipVariants({ size, active: Boolean(active) }), className)}
      {...props}
    >
      {children}
    </button>
  );
}

/* --------------------------------- Painel --------------------------------- */

interface FiltersPanelProps {
  value: SearchFilters;
  facets?: ProductSearchFacetsDto;
  /** Filtros fixados pelo contexto (ex.: categoria na página de categoria) — não exibidos. */
  locked?: RemovableFilterKey[];
  onChange: (next: SearchFilters) => void;
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

/**
 * Seções de filtro (preço, frete/ofertas, avaliação, categoria, loja). Sem rodapé: quem compõe
 * decide as ações — bottom sheet no mobile (rascunho + "Ver N produtos") ou card na sidebar.
 */
export function FiltersPanel({
  value,
  facets,
  locked = [],
  onChange,
  className,
}: FiltersPanelProps) {
  const t = useTranslations("catalog");
  const format = useFormatter();
  const ids = useId();

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
  ];
  const visibleToggles = toggles.filter((tg) => show(tg.key));

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Preço */}
      <FilterSection title={t("filterPrice")}>
        <div className="flex flex-wrap gap-2">
          {PRICE_RANGES.map((r) => {
            const active = value.minPrice === r.min && value.maxPrice === r.max;
            return (
              <FilterChip
                key={r.key}
                size="sm"
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
        <div className="grid grid-cols-2 gap-3">
          <PriceInput
            id={`${ids}-min`}
            label={t("filterMinPrice")}
            placeholder={money(0)}
            value={minText}
            onChange={setMinText}
            onCommit={commitPrice}
          />
          <PriceInput
            id={`${ids}-max`}
            label={t("filterMaxPrice")}
            placeholder={money(0)}
            value={maxText}
            onChange={setMaxText}
            onCommit={commitPrice}
          />
        </div>
      </FilterSection>

      {/* Frete grátis / só ofertas */}
      {visibleToggles.length > 0 ? (
        <FilterSection title={t("filterShipping")}>
          <ul className="flex flex-col divide-y divide-border">
            {visibleToggles.map((tg) => (
              <li key={tg.key}>
                <label className="flex cursor-pointer items-center gap-3 py-3 select-none">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-sm font-medium text-foreground">{tg.label}</span>
                    <span className="text-caption font-normal text-foreground-secondary">
                      {tg.hint}
                    </span>
                  </span>
                  <Switch
                    checked={tg.checked}
                    onCheckedChange={(checked) => tg.onChange(checked)}
                  />
                </label>
              </li>
            ))}
          </ul>
        </FilterSection>
      ) : null}

      {/* Avaliação */}
      {show("minRating") ? (
        <FilterSection title={t("filterRating")}>
          <div className="flex flex-wrap gap-2">
            {RATING_OPTIONS.map((stars) => {
              const active = value.minRating === stars;
              const label = format.number(stars, { maximumFractionDigits: 1 });
              return (
                <FilterChip
                  key={stars}
                  size="sm"
                  active={active}
                  aria-label={t("filterRatingMin", { stars: label })}
                  onClick={() => set({ minRating: active ? undefined : stars })}
                >
                  <Star className="fill-gold text-gold" strokeWidth={1.75} aria-hidden />
                  <span className="tabular-nums">{label}+</span>
                </FilterChip>
              );
            })}
          </div>
        </FilterSection>
      ) : null}

      {/* Categoria */}
      {show("categorySlug") && facets?.categories.length ? (
        <FacetChips
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
        <FacetChips
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
    </div>
  );
}

/** Seção com título em body-sm semibold; `role="group"` no lugar de fieldset para não brigar com o flex. */
function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section role="group" aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-body-sm font-semibold text-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function PriceInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  onCommit,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit();
          }
        }}
        className="tabular-nums"
      />
    </div>
  );
}

function FacetChips({
  title,
  items,
  onToggle,
}: {
  title: string;
  items: Array<{ key: string; name: string; count: number; active: boolean }>;
  onToggle: (key: string, active: boolean) => void;
}) {
  return (
    <FilterSection title={title}>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <FilterChip
              size="sm"
              active={item.active}
              onClick={() => onToggle(item.key, item.active)}
            >
              <span className="max-w-40 truncate">{item.name}</span>
              <span className="tabular-nums opacity-70">{item.count}</span>
            </FilterChip>
          </li>
        ))}
      </ul>
    </FilterSection>
  );
}
