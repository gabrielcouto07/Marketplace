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

/** Atalho de categoria com tinta própria (matiz por slug, ver lib/palette.ts). */
export function CategoryTile({ category, variant = "icon", className }: CategoryTileProps) {
  const t = useTranslations("catalog");
  const style = hueStyle(categoryHue(category.slug));
  const href = `/categoria/${category.slug}`;

  if (variant === "icon") {
    return (
      <Link
        href={href}
        style={style}
        className={cn(
          "group flex pressable flex-col items-center gap-[7px] rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
      >
        <span className="flex size-16 items-center justify-center rounded-[22px] tint-bg tint-fg transition-transform group-hover:-translate-y-0.5">
          <CategoryIcon iconKey={category.iconKey} className="size-[26px]" />
        </span>
        <span className="line-clamp-1 text-xs font-semibold text-foreground">{category.name}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      style={style}
      className={cn(
        "relative flex h-[132px] pressable flex-col justify-between overflow-hidden rounded-[22px] tint-bg p-3.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute -right-6 -bottom-6 size-24 rounded-full tint-bg-strong"
      />
      <span className="relative flex size-11 items-center justify-center rounded-lg bg-card tint-fg">
        <CategoryIcon iconKey={category.iconKey} className="size-[22px]" />
      </span>
      <span className="relative flex flex-col gap-px">
        <span className="text-base font-extrabold text-foreground">{category.name}</span>
        <span className="text-xs text-body">
          {t("categoryProducts", { count: category.productCount })}
        </span>
      </span>
    </Link>
  );
}
