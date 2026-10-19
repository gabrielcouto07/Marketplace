import Image from "next/image";

import { AppIcon } from "@/components/layout/app-icon";
import { cn } from "@/lib/utils";

/*
 * Cores da logo Mania Paraguai (DESIGN.md › Apêndice B, item 14). São do asset, não tokens de UI: a
 * logo nunca é recolorida, nem no dark mode.
 */
export const LOGO_COLORS = {
  /** Marinho do contorno do wordmark. */
  ink: "#041850",
  vermelho: "#E8202E",
  azul: "#1F55E0",
  branco: "#FFFFFF",
} as const;

/** public/brand/logo-mania-paraguai.png: 779 × 273 px. */
const LOGO_RATIO = 779 / 273;

interface BrandLogoProps {
  /** Altura da logo horizontal em px. */
  height?: number;
  /** Texto acessível; sem `title` a logo é decorativa. */
  title?: string;
  className?: string;
}

/**
 * Logo horizontal (sacola + "Mania Paraguai") para superfícies claras. O PNG foi recortado de um fundo
 * branco e ganha halo em fundo escuro, então no dark mode entra o ícone do app (tile Marinho).
 */
export function BrandLogo({ height = 48, title, className }: BrandLogoProps) {
  return (
    <span className={cn("inline-flex shrink-0", className)} role={title ? "img" : undefined} aria-label={title}>
      <Image
        src="/brand/logo-mania-paraguai.png"
        alt=""
        aria-hidden
        width={Math.round(height * LOGO_RATIO)}
        height={height}
        className="block dark:hidden"
      />
      <AppIcon size={height} className="hidden dark:block" />
    </span>
  );
}
