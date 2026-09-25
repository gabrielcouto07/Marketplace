import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Botões do marketplace: cantos 16 px, peso 700, alvo de toque ≥ 44 px e feedback
 * "pressable". Variantes de marca: `cta` (vermelho, compra), `outline` (azul, ação
 * secundária), `soft` (azul suave), `ink` (escuro) e `white` (flutuante sobre imagens).
 */
const buttonVariants = cva(
  "group/button pressable inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-bold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        cta: "bg-cta text-cta-foreground shadow-cta hover:bg-cta-hover focus-visible:ring-cta/40",
        outline: "border-2 border-primary bg-card text-primary hover:bg-accent",
        soft: "bg-accent text-accent-foreground hover:bg-brand-blue-100",
        secondary: "bg-secondary text-secondary-foreground hover:bg-surface-strong",
        ghost: "text-foreground hover:bg-muted aria-expanded:bg-muted",
        white: "bg-card text-foreground shadow-float hover:bg-surface",
        ink: "bg-ink text-ink-foreground hover:bg-ink/90",
        destructive:
          "bg-destructive-soft text-destructive hover:bg-brand-red-100 focus-visible:ring-destructive/20",
        success:
          "bg-success text-success-foreground hover:bg-success/90 focus-visible:ring-success/40",
        link: "rounded-none text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-12 gap-2 px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-8 gap-1 rounded-sm px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-10 gap-1.5 rounded-md px-3.5 text-[13px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-13 gap-2 px-6 text-[15px] has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11 rounded-lg [&_svg:not([class*='size-'])]:size-5",
        "icon-xs": "size-8 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-10 rounded-md",
        "icon-lg": "size-13 rounded-2xl [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      render={render}
      // Com `render={<Link/>}` o elemento final não é <button>; avisa o Base UI para não exigir semântica nativa.
      nativeButton={nativeButton ?? render === undefined}
      {...props}
    />
  );
}

export { Button, buttonVariants };
