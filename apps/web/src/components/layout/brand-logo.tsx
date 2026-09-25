import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

interface BrandLogoProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Com `tile`, desenha o quadrado navy arredondado do ícone (superfícies claras). Sem ele, só a sacola (superfícies escuras). */
  tile?: boolean;
  /** Lado em px (o SVG é quadrado). */
  size?: number;
  /** Texto acessível; sem `title` o SVG é decorativo (`aria-hidden`). */
  title?: string;
}

/*
 * Cores do asset (DESIGN.md › Apêndice A). São do ícone, não tokens de UI:
 * navy do tile, vermelho/azul da sacola calibrados para tela e o dourado da estrela.
 */
const TILE = "#0E1B3D";
const BAG_RED = "#E4312B";
const BAG_BLUE = "#2F6BFF";
const GOLD = "#FFC629";
const WHITE = "#FFFFFF";

/**
 * Ícone principal em vetor, com a mesma geometria de `public/logo.svg`:
 * sacola tricolor (vermelho · branco com estrela dourada · azul), alça branca e dois
 * traços dourados. `tile` liga o quadrado navy de cantos ≈ 22 %.
 */
export function BrandLogo({ tile = false, size = 40, title, className, ...props }: BrandLogoProps) {
  const id = tile ? "brand-bag-tile" : "brand-bag";
  return (
    <svg
      viewBox={tile ? "0 0 1024 1024" : "180 190 664 650"}
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={id}>
          <path d="M295 400H729Q761 400 764 432L797 788Q801 820 769 820H255Q223 820 226 788L260 432Q263 400 295 400Z" />
        </clipPath>
      </defs>
      {tile ? <rect width="1024" height="1024" rx="228" fill={TILE} /> : null}
      <path
        d="M404 404V344A108 108 0 0 1 620 344V404"
        fill="none"
        stroke={WHITE}
        strokeWidth="52"
      />
      <g clipPath={`url(#${id})`}>
        <rect x="200" y="400" width="624" height="140" fill={BAG_RED} />
        <rect x="200" y="540" width="624" height="140" fill={WHITE} />
        <rect x="200" y="680" width="624" height="140" fill={BAG_BLUE} />
      </g>
      <path
        d="M512 566.5L524.4 592.6 553 596.3 532 616.1 537.4 644.5 512 630.6 486.6 644.5 492 616.1 471 596.3 499.6 592.6Z"
        fill={GOLD}
        stroke={GOLD}
        strokeWidth="14"
        strokeLinejoin="round"
      />
      <path
        d="M699 298L742 250M706 326L783 316"
        fill="none"
        stroke={GOLD}
        strokeWidth="22"
        strokeLinecap="round"
      />
    </svg>
  );
}
