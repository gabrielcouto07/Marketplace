import type { CategoryDto } from "@marketplace/contracts";
import { useTranslations } from "next-intl";

import { CategoryIcon } from "@/components/shared/category-icon";
import { Link } from "@/i18n/navigation";
import { categoryHue, hueStyle } from "@/lib/palette";
import { cn } from "@/lib/utils";

interface CategoryTileProps {
  category: CategoryDto;
  /** `icon`: quadrado tintado de 64 px + rótulo (home) · `card`: tile grande com contagem (página de categorias). */
  variant?: "icon" | "card";
  className?: string;
}

/**
 * Atalho de categoria. O `icon` é o único lugar com tinta por categoria (DESIGN.md › Apêndice B,
 * item 4); o `card` usa surface-muted com ícone em primary.
 */
export function CategoryTile({ category, variant = "icon", className }: CategoryTileProps) {
  const t = useTranslations("catalog");
  const href = `/categoria/${category.slug}`;

  if (variant === "icon") {
    return (
      <Link
        href={href}
        style={hueStyle(categoryHue(category.slug))}
        className={cn(
          "flex pressable flex-col items-center gap-2 rounded-sm focus-ring",
          className,
        )}
      >
        <span className="flex size-16 items-center justify-center rounded-lg tint-bg tint-fg">
          <CategoryIcon iconKey={category.iconKey} className="size-6" />
        </span>
        <span className="line-clamp-1 text-center text-caption text-foreground">
          {category.name}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex h-32 pressable flex-col justify-between rounded-lg bg-surface-muted p-4 focus-ring",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-md bg-surface text-primary shadow-xs">
        <CategoryIcon iconKey={category.iconKey} className="size-5" />
      </span>
      <span className="flex flex-col">
        <span className="truncate text-body font-semibold text-foreground">{category.name}</span>
        <span className="text-caption text-foreground-secondary">
          {t("categoryProducts", { count: category.productCount })}
        </span>
      </span>
    </Link>
  );
}
