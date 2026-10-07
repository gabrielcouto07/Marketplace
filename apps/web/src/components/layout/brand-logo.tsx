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
 * recolorido, nem no dark mode.
 */
const INK = "#0F1729";
const VERMELHO = "#F2263E";
const AZUL = "#1552EB";
const VERDE = "#00B852";
const AMARELO = "#FFD20A";
const WHITE = "#FFFFFF";

/** As mesmas cores, para o wordmark (`BrandMark`) casar com o logo. */
export const LOGO_COLORS = {
  ink: INK,
  vermelho: VERMELHO,
  azul: AZUL,
  verde: VERDE,
  amarelo: AMARELO,
  branco: WHITE,
} as const;

/** 81 (largura da ponte, com as pontas arredondadas do tabuleiro) ÷ 67 (base das bandeiras). */
const FLAGS_SCALE = 1.21;

/**
 * Detalhe por tamanho: completo (cabos, círculo da etiqueta e tabuleiro) a partir de 28 px; em
 * ícones menores some o que não se lê (cabos, círculo e tabuleiro) e a alça engrossa. A
 * identidade tira os cabos e o círculo já aos 40 px, mas sem o tile o desenho é maior e eles
 * ainda aparecem no header (36–40 px).
 */
function detailFor(size: number): "full" | "small" {
  return size >= 28 ? "full" : "small";
}

/**
 * Logo "Ponte" (opção B da identidade): a sacola dividida ao meio, metade nas faixas do Paraguai
 * (Vermelho · branco · Azul) e metade na etiqueta do Brasil (Verde, losango Amarelo, círculo
 * Azul), unidas por uma alça em arco de ponte com cabos e tabuleiro. Sem tile: o `viewBox` é
 * recortado rente ao desenho, então a sacola ocupa todo o `size`.
 */
export function BrandLogo({ size = 40, title, className, ...props }: BrandLogoProps) {
  const detail = detailFor(size);
  return (
    <svg
      viewBox="18 27 84 84"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {/* As bandeiras crescem {FLAGS_SCALE}× a partir do tabuleiro (60, 48): o ponto mais largo delas
          (a base, 67 → 81) iguala a largura da ponte. */}
      <g transform={`translate(60 48) scale(${FLAGS_SCALE}) translate(-60 -48)`}>
        <path d="M34 48H60V65H28.64L29.7 52Q30 48 34 48Z" fill={VERMELHO} />
        <path d="M28.64 65H60V81H27.36Z" fill={WHITE} />
        <path d="M27.36 81H60V98H32Q26 98 26.5 92Z" fill={AZUL} />
        <path d="M60 48H86Q90 48 90.3 52L93.5 92Q94 98 88 98H60Z" fill={VERDE} />
        <path d="M76 60L90 73L76 86L62 73Z" fill={AMARELO} />
        {detail === "full" ? <circle cx="76" cy="73" r="5.5" fill={AZUL} /> : null}
      </g>
      <path
        d="M32 48Q60 14 88 48"
        fill="none"
        stroke={INK}
        strokeWidth={detail === "small" ? 8 : 6}
        strokeLinecap="round"
      />
      {detail === "full" ? (
        <path
          d="M46 38V48M60 34V48M74 38V48"
          fill="none"
          stroke={INK}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : null}
      {detail === "full" ? (
        <path d="M22 48H98" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}
