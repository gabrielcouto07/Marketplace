"use client";

import type { ProductSummaryDto } from "@marketplace/contracts";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useFavoritesStore, useIsFavorite } from "@/features/catalog/favorites-store";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  product: ProductSummaryDto;
  className?: string;
  /** `sm`: pill de 36 px (cards, alvo de toque estendido a 44) · `md`: pill de 44 px (galeria). */
  size?: "sm" | "md";
}

/** Coração em pill translúcida com backdrop-blur; persistido, "pula" ao marcar e avisa por toast. */
export function FavoriteButton({ product, className, size = "sm" }: FavoriteButtonProps) {
  const t = useTranslations("catalog");
  const isFavorite = useIsFavorite(product.id);
  const toggle = useFavoritesStore((s) => s.toggle);
  const [pops, setPops] = useState(0);

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={isFavorite ? t("removeFavorite") : t("addFavorite")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const added = toggle(product);
        if (added) setPops((n) => n + 1);
        toast(added ? t("favoriteAdded") : t("favoriteRemoved"), { duration: 1500 });
      }}
      className={cn(
        "relative flex pressable items-center justify-center rounded-full bg-surface/85 text-foreground shadow-xs focus-ring backdrop-blur-md transition-colors before:absolute before:-inset-1 hover:bg-surface",
        size === "sm" ? "size-9" : "size-11",
        className,
      )}
    >
      <Heart
        key={pops}
        className={cn(
          "size-5",
          pops > 0 && "animate-pop",
          isFavorite ? "fill-cta text-cta" : "text-foreground",
        )}
        strokeWidth={1.75}
        aria-hidden
      />
    </button>
  );
}
