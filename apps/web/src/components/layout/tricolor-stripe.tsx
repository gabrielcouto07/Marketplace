import { cn } from "@/lib/utils";

/**
 * Assinatura tricolor: 3 px Coral | branco | Pervinca, as faixas da sacola do logo. Só faz sentido
 * sobre brand-deep (header do painel, footer, splash), onde o branco é visível. Em superfícies
 * claras a marca usa a fita Pervinca (`brand-ribbon`) do header.
 */
export function TricolorStripe({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("tricolor-stripe w-full", className)} />;
}
