import type { CategoryDto } from "@marketplace/contracts";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { CategoryIcon } from "@/components/shared/category-icon";
import { Link } from "@/i18n/navigation";
import { blurDataUrlFor } from "@/lib/images";
import { categoryHue, hueStyle } from "@/lib/palette";
import { cn } from "@/lib/utils";

interface CategoryTileProps {
  category: CategoryDto;
  /** `icon`: quadrado tintado de 64 px + rótulo (home) · `card`: capa fotográfica com nome e contagem (página de categorias). */
  variant?: "icon" | "card";
  priority?: boolean;
  className?: string;
}

/**
 * Atalho de categoria. O `icon` é o único lugar com tinta por categoria (DESIGN.md › Apêndice B,
 * item 4); o `card` usa a foto de capa da categoria com scrim em brand-deep e, sem foto, cai em
 * surface-muted com o ícone em primary.
 */
export function CategoryTile({
  category,
  variant = "icon",
  priority,
  className,
}: CategoryTileProps) {
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

  const withPhoto = Boolean(category.imageUrl);
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-36 pressable flex-col justify-end overflow-hidden rounded-lg p-4 focus-ring",
        withPhoto ? "bg-brand-deep text-white" : "bg-surface-muted text-foreground",
        className,
      )}
    >
      {category.imageUrl ? (
        <>
          <Image
            src={category.imageUrl}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 288px"
            placeholder="blur"
            blurDataURL={blurDataUrlFor(category.imageUrl)}
            className="object-cover transition-transform duration-300 ease-standard group-hover:scale-[1.03]"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-linear-to-t from-brand-deep/85 via-brand-deep/35 to-brand-deep/0"
          />
        </>
      ) : null}
      <span className="relative flex items-end justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-semibold">{category.name}</span>
          <span
            className={cn(
              "text-caption",
              withPhoto ? "text-white/80" : "text-foreground-secondary",
            )}
          >
            {t("categoryProducts", { count: category.productCount })}
          </span>
        </span>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            withPhoto ? "bg-white/15 text-white" : "bg-surface text-primary shadow-xs",
          )}
        >
          <CategoryIcon iconKey={category.iconKey} className="size-4" />
        </span>
      </span>
    </Link>
  );
}
