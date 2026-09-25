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

/** Trilho com borda fina: −, número em tabular-nums e +. Lixeira no mínimo quando `allowRemove`. */
export function QuantityStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  allowRemove,
  onRemove,
  size = "md",
  className,
  label,
}: QuantityStepperProps) {
  const t = useTranslations("common");
  const atMin = value <= min;
  const atMax = value >= max;
  const btn = cn(
    "flex pressable items-center justify-center rounded-sm text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40 focus-ring",
    size === "md" ? "size-10" : "size-8",
  );

  return (
    <div
      role="group"
      aria-label={label ?? t("quantity")}
      className={cn(
        "inline-flex items-center rounded-md border border-border-strong bg-surface p-0.5",
        className,
      )}
    >
      <button
        type="button"
        className={btn}
        aria-label={atMin && allowRemove ? t("remove") : t("decrease")}
        disabled={atMin && !allowRemove}
        onClick={() => (atMin && allowRemove ? onRemove?.() : onChange(Math.max(min, value - 1)))}
      >
        {atMin && allowRemove ? (
          <Trash2 className="size-5 text-danger" strokeWidth={1.75} />
        ) : (
          <Minus className="size-5" strokeWidth={1.75} />
        )}
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
        className={cn(
          "[appearance:textfield] bg-transparent text-center text-body font-semibold tabular-nums outline-none focus-visible:text-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          size === "md" ? "h-10 w-10" : "h-8 w-8",
        )}
      />
      <button
        type="button"
        className={btn}
        aria-label={t("increase")}
        disabled={atMax}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
