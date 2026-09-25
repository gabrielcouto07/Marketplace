import { cn } from "@/lib/utils";

/**
 * Assinatura tricolor: 3 px vermelho | branco | azul. Só faz sentido sobre superfícies escuras
 * ou azuis (splash, hero, footer, header do painel), onde o branco é visível — nunca sobre fundo claro.
 */
export function TricolorStripe({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("tricolor-stripe w-full", className)} />;
}
