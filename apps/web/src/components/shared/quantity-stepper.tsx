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

/** Trilho cinza com dois botões brancos e o número em negrito no meio (−/+; lixeira no mínimo). */
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
    "pressable flex items-center justify-center rounded-[11px] bg-card text-foreground shadow-card transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    size === "md" ? "size-10" : "size-9",
  );

  return (
    <div
      role="group"
      aria-label={label ?? t("quantity")}
      className={cn("inline-flex items-center rounded-lg bg-surface p-[3px]", className)}
    >
      <button
        type="button"
        className={btn}
        aria-label={atMin && allowRemove ? t("remove") : t("decrease")}
        disabled={atMin && !allowRemove}
        onClick={() => (atMin && allowRemove ? onRemove?.() : onChange(Math.max(min, value - 1)))}
      >
        {atMin && allowRemove ? (
          <Trash2 className="size-4 text-destructive" strokeWidth={2.2} />
        ) : (
          <Minus className="size-4" strokeWidth={2.4} />
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
          "[appearance:textfield] bg-transparent text-center text-[15px] font-extrabold tabular-nums outline-none focus-visible:text-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          size === "md" ? "h-10 w-10" : "h-9 w-8 text-sm",
        )}
      />
      <button
        type="button"
        className={btn}
        aria-label={t("increase")}
        disabled={atMax}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-4" strokeWidth={2.4} />
      </button>
    </div>
  );
}
