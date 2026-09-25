import * as React from "react";

import { cn } from "@/lib/utils";

/** Área de texto com o mesmo desenho do Input (16 px, surface-muted, foco primário). */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-md border border-border bg-surface-muted px-4 py-3 text-body text-foreground transition-colors outline-none placeholder:text-foreground-muted hover:border-border-strong focus-visible:border-primary focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-focus-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/15",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
