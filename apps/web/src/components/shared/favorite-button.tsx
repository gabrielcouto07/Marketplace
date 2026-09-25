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
  /** `sm`: círculo branco de 32 px em alvo de 40 px (cards) · `md`: quadrado branco de 44 px (galeria). */
  size?: "sm" | "md";
}

/** Coração persistido; "pula" ao ser marcado e avisa por toast. */
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
        "flex pressable items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        size === "sm" ? "size-10" : "size-11 rounded-lg bg-card shadow-float",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center",
          size === "sm" && "size-8 rounded-full bg-card/92",
        )}
      >
        <Heart
          key={pops}
          className={cn(
            size === "sm" ? "size-[17px]" : "size-5",
            pops > 0 && "animate-pop",
            isFavorite ? "fill-cta text-cta" : "text-foreground",
          )}
          strokeWidth={2}
        />
      </span>
    </button>
  );
}
