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
  className?: string;
}

/** Encontra a variante que casa exatamente com a seleção (todas as opções). */
export function findVariant(
  variants: ProductVariantDto[],
  selection: Record<string, string>,
  options: ProductVariantOptionDto[],
): ProductVariantDto | null {
  if (options.length === 0) return null;
  if (options.some((o) => !selection[o.name])) return null;
  return (
    variants.find((v) => options.every((o) => v.attributes[o.name] === selection[o.name])) ?? null
  );
}

/** Existe alguma variante com estoque compatível com a seleção parcial + este valor? */
function hasStockFor(
  variants: ProductVariantDto[],
  partial: Record<string, string>,
  optionName: string,
  value: string,
): boolean {
  return variants.some(
    (v) =>
      v.stock > 0 &&
      v.attributes[optionName] === value &&
      Object.entries(partial).every(([k, val]) => k === optionName || v.attributes[k] === val),
  );
}

/**
 * Chips por opção (raio 12, borda fina). Selecionado: borda e texto primary sobre primary-soft.
 * Combinações sem estoque ficam riscadas e esmaecidas, mas continuam selecionáveis (o estoque
 * da variante é mostrado no bloco de compra).
 */
export function VariantSelector({
  options,
  variants,
  selection,
  onChange,
  className,
}: VariantSelectorProps) {
  const t = useTranslations("product");
  if (options.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {options.map((opt) => {
        const selected = selection[opt.name];
        return (
          <fieldset key={opt.name} className="flex flex-col gap-2">
            <legend className="mb-2 text-body-sm font-medium text-foreground">
              {selected ? (
                <>
                  {opt.name}: <span className="text-foreground-secondary">{selected}</span>
                </>
              ) : (
                t("selectVariant", { name: opt.name })
              )}
            </legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={opt.name}>
              {opt.values.map((value) => {
                const active = selected === value;
                const available = hasStockFor(variants, selection, opt.name, value);
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange({ ...selection, [opt.name]: value })}
                    className={cn(
                      "flex h-10 min-w-14 pressable items-center justify-center rounded-md border px-4 text-body-sm font-medium focus-ring transition-colors",
                      active
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-surface text-foreground hover:border-border-strong",
                      !available && "line-through opacity-50",
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
