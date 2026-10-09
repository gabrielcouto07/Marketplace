import Image from "next/image";

import { cn } from "@/lib/utils";

interface AppIconProps {
  /** Lado em px. */
  size: number;
  className?: string;
}

/**
 * O ícone do app instalado (o mesmo PNG do manifest, gerado por `pnpm --filter web icons`): tile
 * branco com a sacola. O contorno segura o tile branco sobre a superfície clara. Decorativo.
 */
export function AppIcon({ size, className }: AppIconProps) {
  return (
    <Image
      src="/icons/sacola-192.png"
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded-[25%] ring-1 ring-border", className)}
    />
  );
}
