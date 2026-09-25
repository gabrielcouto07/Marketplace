"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  /** Quando true, no mínimo mostra ícone de lixeira (remover). */
  allowRemove?: boolean;
  onRemove?: () => void;
  size?: "sm" | "md";
  className?: string;
  label?: string;
}

export function QuantityStepper({ value, min = 1, max = 99, onChange, allowRemove, onRemove, size = "md", className, label }: QuantityStepperProps) {
  const t = useTranslations("common");
  const atMin = value <= min;
  const atMax = value >= max;
  const btn = cn(
    "flex items-center justify-center text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
    size === "md" ? "size-11" : "size-9",
  );

  return (
    <div
      role="group"
      aria-label={label ?? t("quantity")}
      className={cn("inline-flex items-center overflow-hidden rounded-lg border border-input bg-background", className)}
    >
      <button
        type="button"
        className={btn}
        aria-label={atMin && allowRemove ? t("remove") : t("decrease")}
        disabled={atMin && !allowRemove}
        onClick={() => (atMin && allowRemove ? onRemove?.() : onChange(Math.max(min, value - 1)))}
      >
        {atMin && allowRemove ? <Trash2 className="size-4 text-destructive" /> : <Minus className="size-4" />}
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={t("quantity")}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.floor(n))));
        }}
        className={cn("w-10 border-x border-input bg-transparent text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", size === "md" ? "h-11" : "h-9")}
      />
      <button type="button" className={btn} aria-label={t("increase")} disabled={atMax} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}
