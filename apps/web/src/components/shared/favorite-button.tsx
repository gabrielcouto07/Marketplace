"use client";

import type { ProductSummaryDto } from "@marketplace/contracts";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useFavoritesStore, useIsFavorite } from "@/features/catalog/favorites-store";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  product: ProductSummaryDto;
  className?: string;
  size?: "sm" | "md";
}

export function FavoriteButton({ product, className, size = "sm" }: FavoriteButtonProps) {
  const t = useTranslations("catalog");
  const isFavorite = useIsFavorite(product.id);
  const toggle = useFavoritesStore((s) => s.toggle);

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? t("removeFavorite") : t("addFavorite")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggle(product);
        toast(added ? t("favoriteAdded") : t("favoriteRemoved"), { duration: 1500 });
      }}
      className={cn(
        "flex items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-sm ring-1 ring-black/5 transition hover:bg-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95 dark:bg-neutral-800/90 dark:text-neutral-100",
        size === "sm" ? "size-9" : "size-11",
        className,
      )}
    >
      <Heart className={cn(size === "sm" ? "size-4.5" : "size-5", isFavorite && "fill-brand-red-500 text-brand-red-500")} />
    </button>
  );
}
