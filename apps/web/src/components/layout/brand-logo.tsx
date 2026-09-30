import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

interface BrandLogoProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Lado em px (o SVG é quadrado). Define também o nível de detalhe do desenho. */
  size?: number;
  /** Texto acessível; sem `title` o SVG é decorativo (`aria-hidden`). */
  title?: string;
}

/*
 * Cores do asset (DESIGN.md › Apêndice A). São do logo, não tokens de UI: o logo nunca é
 * recolorido, nem no dark mode (o tile Manteiga é a própria moldura).
 */
const TILE = "#FFF1C9";
const INK = "#26253A";
const CORAL = "#FF8B7B";
const PERVINCA = "#7F9BFF";
const MENTA = "#5DCB94";
const MANTEIGA = "#FFD15C";
const STAR = "#FFC53D";
const WHITE = "#FFFFFF";

/**
 * Detalhe por tamanho, como na identidade: completo a partir de 42 px; sem a estrela abaixo
 * disso; em ícones pequenos (< 28 px) some também o barbante e o círculo da etiqueta, e a alça
 * engrossa para continuar legível.
 */
function detailFor(size: number): "full" | "medium" | "small" {
  if (size >= 42) return "full";
  if (size >= 28) return "medium";
  return "small";
}

/**
 * Logo A · "Etiqueta": sacola nas faixas do Paraguai (Coral · branco com estrela · Pervinca) com a
 * etiqueta do Brasil (Menta, losango Manteiga, círculo Pervinca) presa na alça, sobre o tile
 * Manteiga de cantos 25 %. Mesma geometria de `public/logo.svg`.
 */
export function BrandLogo({ size = 40, title, className, ...props }: BrandLogoProps) {
  const detail = detailFor(size);
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <rect width="120" height="120" rx="30" fill={TILE} />
      <path
        d="M45 49V40a15 15 0 0 1 30 0v9"
        fill="none"
        stroke={INK}
        strokeWidth={detail === "small" ? 8 : 6}
        strokeLinecap="round"
      />
      <path d="M34 48H86Q90 48 90.3 52L91.36 65H28.64L29.7 52Q30 48 34 48Z" fill={CORAL} />
      <path d="M28.64 65H91.36L92.64 81H27.36Z" fill={WHITE} />
      <path d="M27.36 81H92.64L93.5 92Q94 98 88 98H32Q26 98 26.5 92Z" fill={PERVINCA} />
      {detail === "full" ? (
        <path
          d="M60 67.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z"
          fill={STAR}
        />
      ) : null}
      {detail === "small" ? null : (
        <path d="M75 44L81 55" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      )}
      <g transform="translate(78 53) rotate(16)">
        <rect width="28" height="20" rx="4" fill={MENTA} />
        <path d="M14 3L25 10L14 17L3 10Z" fill={MANTEIGA} />
        {detail === "small" ? null : <circle cx="14" cy="10" r="4.2" fill={PERVINCA} />}
      </g>
    </svg>
  );
}
