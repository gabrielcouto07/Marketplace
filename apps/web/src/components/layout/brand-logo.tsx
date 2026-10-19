import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * A arte da folha da marca com fundo transparente (recorte sem halo: serve em claro, no Azul do header
 * e no Marinho). Nunca é recolorida, nem no dark mode (DESIGN.md › Apêndice B, item 14). O nome do
 * arquivo muda quando a arte muda: `/_next/image` fica em CacheFirst no service worker.
 */
const ART = {
  /** Sacola + "Mania Paraguai" em duas linhas: 773 × 259 px. */
  logo: { src: "/brand/logo-mania-paraguai-v2.png", ratio: 773 / 259 },
  /** Só a sacola com a alça e as linhas de velocidade: 321 × 259 px. */
  symbol: { src: "/brand/sacola-mania-paraguai.png", ratio: 321 / 259 },
} as const;

interface BrandLogoProps {
  /** Altura em px. */
  height?: number;
  /** `symbol`: só a sacola, sem o wordmark. */
  variant?: keyof typeof ART;
  /** Texto acessível; sem `title` a logo é decorativa. */
  title?: string;
  priority?: boolean;
  className?: string;
}

/** A logo Mania Paraguai (ou só a sacola) em qualquer superfície. */
export function BrandLogo({ height = 48, variant = "logo", title, priority, className }: BrandLogoProps) {
  const art = ART[variant];
  return (
    <span className={cn("inline-flex shrink-0", className)} role={title ? "img" : undefined} aria-label={title}>
      <Image
        src={art.src}
        alt=""
        aria-hidden
        width={Math.round(height * art.ratio)}
        height={height}
        priority={priority}
        className="block"
      />
    </span>
  );
}
