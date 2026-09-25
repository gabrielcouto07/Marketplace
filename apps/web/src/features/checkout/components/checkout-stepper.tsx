"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Passos do checkout em linha: número em círculo (feito: primary preenchido com check ·
 * atual: contorno primary · futuro: contorno border-strong) ligados por uma linha fina.
 */
export function CheckoutStepper({ current }: { current: 1 | 2 | 3 }) {
  const t = useTranslations("checkout");
  const steps = [t("stepAddress"), t("stepShipping"), t("stepPayment")];
  return (
    <ol className="flex items-center" aria-label={t("progressLabel")}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li
            key={label}
            className={cn("flex items-center", i < steps.length - 1 && "flex-1")}
            aria-current={active ? "step" : undefined}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-caption tabular-nums transition-colors",
                  done && "border-primary bg-primary text-white",
                  active && "border-primary bg-surface text-primary",
                  !done && !active && "border-border-strong bg-surface text-foreground-muted",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={2.5} /> : n}
              </span>
              <span
                className={cn(
                  "text-caption",
                  active ? "text-primary" : done ? "text-foreground" : "text-foreground-muted",
                )}
              >
                {label}
                {done ? <span className="sr-only"> ({t("stepDone")})</span> : null}
                {active ? <span className="sr-only"> ({t("stepCurrent")})</span> : null}
              </span>
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn("mx-2 h-px flex-1", done ? "bg-primary" : "bg-border")}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
