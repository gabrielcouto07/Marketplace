import { cn } from "@/lib/utils";

/**
 * Assinatura tricolor: 3 px Vermelho | branco | Azul, as faixas da sacola do logo. Só faz sentido
 * sobre brand-deep (header do painel, splash), onde o branco é visível. Em superfícies claras e na
 * base do footer a marca usa a faixa das quatro cores (`brand-quartet`).
 */
export function TricolorStripe({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("tricolor-stripe w-full", className)} />;
}
