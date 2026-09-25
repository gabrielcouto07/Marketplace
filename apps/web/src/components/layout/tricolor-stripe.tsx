import { cn } from "@/lib/utils";

/** Faixa fina vermelho/branco/azul — detalhe de marca sob o header e na splash. */
export function TricolorStripe({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("tricolor-stripe w-full", className)} />;
}
