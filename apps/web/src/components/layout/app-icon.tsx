import Image from "next/image";

import { cn } from "@/lib/utils";

interface AppIconProps {
  /** Lado em px. */
  size: number;
  className?: string;
}

/**
 * O ícone do app instalado (o mesmo PNG do manifest, gerado por `pnpm --filter web icons`): tile
 * Marinho com a sacola, cantos arredondados e fundo transparente. Decorativo.
 */
export function AppIcon({ size, className }: AppIconProps) {
  return (
    <Image
      src="/icons/mania-192.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    />
  );
}
