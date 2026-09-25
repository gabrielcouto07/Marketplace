import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

/**
 * Campo de texto: 48 px, 16 px de fonte (sem zoom no iOS), fundo surface-muted com borda fina;
 * no foco vira surface com borda primária e anel suave. Erro: borda danger (o texto de erro vem do FormField).
 */
const inputClassName =
  "h-12 w-full min-w-0 rounded-md border border-border bg-surface-muted px-4 text-body text-foreground transition-colors outline-none placeholder:text-foreground-muted hover:border-border-strong focus-visible:border-primary focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-focus-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/15 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-body-sm file:font-medium file:text-foreground";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputClassName, className)}
      {...props}
    />
  );
}

export { Input, inputClassName };
