import {
  Dumbbell,
  Gamepad2,
  Laptop,
  Package,
  Shirt,
  Smartphone,
  Sofa,
  SprayCan,
  Tv,
  Wine,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  tv: Tv,
  "spray-can": SprayCan,
  laptop: Laptop,
  smartphone: Smartphone,
  "gamepad-2": Gamepad2,
  // Categoria antiga (bebidas alcoólicas são oferta vedada): mantida para bancos que ainda a tenham inativa.
  wine: Wine,
  sofa: Sofa,
  dumbbell: Dumbbell,
  shirt: Shirt,
};

/** Mapeia CategoryDto.iconKey → ícone lucide (fallback: pacote). */
export function CategoryIcon({ iconKey, className }: { iconKey: string; className?: string }) {
  const Icon = ICONS[iconKey] ?? Package;
  return <Icon className={className} aria-hidden />;
}
