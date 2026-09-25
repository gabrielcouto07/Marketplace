import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badges: 24 px, texto caption (12/500), raio 8. Tons suaves por padrão — cor chapada só em
 * `cta` (oferta) e `primary` (estado ativo). `danger` sempre com ícone + texto.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2 text-caption whitespace-nowrap transition-colors focus-ring [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground",
        cta: "bg-cta text-cta-foreground",
        soft: "bg-primary-soft text-primary",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
        neutral: "bg-surface-muted text-foreground-secondary",
        outline: "border-border text-foreground-secondary",
        inverse: "bg-foreground text-background",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

function Badge({
  className,
  variant = "neutral",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">({ className: cn(badgeVariants({ variant }), className) }, props),
    render,
    state: { slot: "badge", variant },
  });
}

export { Badge, badgeVariants };
