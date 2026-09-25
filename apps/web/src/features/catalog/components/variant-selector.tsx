"use client";

import type { ProductVariantDto, ProductVariantOptionDto } from "@marketplace/contracts";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface VariantSelectorProps {
  options: ProductVariantOptionDto[];
  variants: ProductVariantDto[];
  /** Seleção atual: { "Cor": "Preto", ... } */
  selection: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

/** Encontra a variante que casa exatamente com a seleção (todas as opções). */
export function findVariant(variants: ProductVariantDto[], selection: Record<string, string>, options: ProductVariantOptionDto[]): ProductVariantDto | null {
  if (options.length === 0) return null;
  if (options.some((o) => !selection[o.name])) return null;
  return variants.find((v) => options.every((o) => v.attributes[o.name] === selection[o.name])) ?? null;
}

/** Existe alguma variante com estoque compatível com a seleção parcial + este valor? */
function hasStockFor(variants: ProductVariantDto[], partial: Record<string, string>, optionName: string, value: string): boolean {
  return variants.some(
    (v) =>
      v.stock > 0 &&
      v.attributes[optionName] === value &&
      Object.entries(partial).every(([k, val]) => k === optionName || v.attributes[k] === val),
  );
}

/** Botões "pill" por opção; combinações sem estoque ficam desabilitadas. */
export function VariantSelector({ options, variants, selection, onChange }: VariantSelectorProps) {
  const t = useTranslations("product");
  if (options.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {options.map((opt) => (
        <fieldset key={opt.name}>
          <legend className="mb-2 text-sm font-semibold">
            {t("selectVariant", { name: opt.name })}
            {selection[opt.name] ? <span className="ml-1 font-normal text-muted-foreground">— {selection[opt.name]}</span> : null}
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={opt.name}>
            {opt.values.map((value) => {
              const active = selection[opt.name] === value;
              const available = hasStockFor(variants, selection, opt.name, value);
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-disabled={!available}
                  onClick={() => onChange({ ...selection, [opt.name]: value })}
                  className={cn(
                    "flex h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary" : "border-border bg-background hover:border-neutral-400",
                    !available && "text-muted-foreground line-through opacity-60",
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
