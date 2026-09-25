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

/** Chips por opção (borda 2 px; selecionado = azul sobre fundo selecionado); combinações sem estoque ficam riscadas. */
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
    <div className={cn("flex flex-col gap-3.5", className)}>
      {options.map((opt) => {
        const selected = selection[opt.name];
        return (
          <fieldset key={opt.name} className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-bold">
              {selected ? (
                <>
                  {opt.name}:{" "}
                  <span className="font-semibold text-muted-foreground">{selected}</span>
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
                    aria-disabled={!available}
                    onClick={() => onChange({ ...selection, [opt.name]: value })}
                    className={cn(
                      "flex h-10.5 min-w-14 pressable items-center justify-center rounded-md border-2 px-3.5 text-[13.5px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active
                        ? "border-primary bg-selected text-primary"
                        : "border-line-200 bg-card text-foreground hover:border-line-300",
                      !available && "border-dashed text-muted-foreground line-through opacity-60",
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
