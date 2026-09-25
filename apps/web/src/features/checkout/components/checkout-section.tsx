import type { ReactNode } from "react";

import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/** Card de seção do checkout: título em title-3 e conteúdo com respiro de 16 px. */
export function CheckoutSection({
  id,
  title,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  /** Ação discreta à direita do título (ex.: "Novo endereço"). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-title-3 text-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Radio card: rótulo clicável com `RadioGroupItem` à esquerda. Selecionado ganha borda
 * primary e fundo primary-soft/50 (via `has-data-checked`). Use dentro de `RadioGroup`.
 */
export function OptionCard({
  value,
  disabled,
  align = "center",
  children,
  className,
}: {
  value: string;
  disabled?: boolean;
  align?: "center" | "start";
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-md border border-border bg-surface p-3 transition-colors hover:border-border-strong has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-checked:border-primary has-data-checked:bg-primary-soft/50",
        align === "center" ? "items-center" : "items-start",
        className,
      )}
    >
      <RadioGroupItem
        value={value}
        disabled={disabled}
        className={align === "start" ? "mt-0.5" : undefined}
      />
      {children}
    </label>
  );
}
