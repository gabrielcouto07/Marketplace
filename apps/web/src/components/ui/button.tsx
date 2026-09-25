import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Botões (DESIGN.md › Padrões de componentes › Botões).
 * - `cta`: vermelho, 48 px, só um por tela (Comprar agora, Finalizar compra, Pagar).
 * - `primary` (padrão): azul, ações principais sem conotação de compra.
 * - `secondary`: surface + borda (Adicionar ao carrinho, ao lado do CTA).
 * - `ghost`: só texto/ícone. `soft`: azul suave (chips de ação). `link`: texto sublinhado.
 * - `destructive`: vermelho escuro suave (sempre acompanhado de ícone + texto).
 * - `floating`: branco com sombra, para flutuar sobre imagens (galeria).
 * - `inverse`: escuro sobre claro / claro sobre escuro (barras e toasts).
 * Todos com `loading` (spinner mantendo a largura), `disabled` e foco visível; toque ≥ 44 px.
 */
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent font-semibold whitespace-nowrap transition-colors select-none focus-ring pressable disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        cta: "bg-cta text-cta-foreground hover:bg-cta-hover active:bg-cta-pressed",
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "border-border-strong bg-surface text-foreground hover:bg-surface-muted",
        ghost: "text-foreground hover:bg-surface-muted aria-expanded:bg-surface-muted",
        soft: "bg-primary-soft text-primary hover:bg-primary/15",
        link: "h-auto rounded-none px-0 text-primary underline-offset-4 hover:underline",
        destructive: "bg-danger-soft text-danger hover:bg-danger/15",
        floating: "bg-surface text-foreground shadow-sm hover:bg-surface-muted",
        inverse: "bg-foreground text-background hover:bg-foreground/90",
      },
      size: {
        default:
          "h-12 px-4 text-body-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        sm: "h-10 gap-1.5 px-3 text-body-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4",
        xs: "h-8 gap-1 rounded-sm px-2 text-caption [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 px-6 text-body has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11",
        "icon-sm": "size-10 [&_svg:not([class*='size-'])]:size-5",
        "icon-xs": "size-8 rounded-sm [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-6",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Mostra um spinner centralizado mantendo a largura; desabilita o botão. */
    loading?: boolean;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  fullWidth,
  loading = false,
  disabled,
  children,
  render,
  nativeButton,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, fullWidth, className }))}
      disabled={disabled || loading}
      render={render}
      // Com `render={<Link/>}` o elemento final não é <button>; avisa o Base UI para não exigir semântica nativa.
      nativeButton={nativeButton ?? render === undefined}
      {...props}
    >
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <Loader2 className="animate-spin" />
        </span>
      ) : null}
      <span className={cn("contents", loading && "invisible")}>{children}</span>
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
