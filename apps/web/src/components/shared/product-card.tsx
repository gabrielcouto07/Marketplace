import type { ProductSummaryDto } from "@marketplace/contracts";
import { Truck } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { FavoriteButton } from "@/components/shared/favorite-button";
import { PriceTag } from "@/components/shared/price-tag";
import { RatingStars } from "@/components/shared/rating-stars";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: ProductSummaryDto;
  /** "grid" (2 colunas mobile) ou "row" (carrossel horizontal, largura fixa). */
  layout?: "grid" | "row";
  priority?: boolean;
  className?: string;
}

/** Card denso e legível: imagem quadrada, selos, preço BRL + PYG, avaliação, loja. */
export function ProductCard({ product, layout = "grid", priority, className }: ProductCardProps) {
  const t = useTranslations("catalog");
  const soldOut = product.stock <= 0;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md",
        layout === "row" && "w-40 shrink-0 sm:w-44",
        className,
      )}
    >
      <Link href={`/produto/${product.slug}`} className="flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        <div className="relative aspect-square w-full overflow-hidden bg-surface">
          <Image
            src={product.thumbnailUrl}
            alt={product.name}
            fill
            sizes={layout === "row" ? "176px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"}
            priority={priority}
            className={cn("object-cover transition-transform duration-300 group-hover:scale-[1.03]", soldOut && "opacity-60")}
          />
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {product.discountPercent > 0 ? (
              <span className="rounded-md bg-cta px-1.5 py-0.5 text-[11px] font-bold text-cta-foreground shadow-sm">
                -{product.discountPercent}%
              </span>
            ) : null}
            {product.isNew ? (
              <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground shadow-sm">{t("newBadge")}</span>
            ) : null}
          </div>
          {soldOut ? (
            <span className="absolute inset-x-0 bottom-0 bg-neutral-900/80 py-1 text-center text-xs font-semibold text-white">{t("soldOut")}</span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm leading-tight font-medium text-foreground">{product.name}</h3>
          <PriceTag price={product.price} compareAtPrice={product.compareAtPrice} referencePrice={product.referencePrice} size="sm" />
          {product.freeShipping ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
              <Truck className="size-3.5" aria-hidden /> {t("freeShipping")}
            </span>
          ) : null}
          <div className="mt-auto flex flex-col gap-0.5 pt-1">
            {product.reviewCount > 0 ? <RatingStars value={product.rating} count={product.reviewCount} size="xs" /> : null}
            <span className="truncate text-[11px] text-muted-foreground">{product.seller.name}</span>
          </div>
        </div>
      </Link>
      <FavoriteButton product={product} className="absolute top-2 right-2" />
    </article>
  );
}

export function ProductCardSkeleton({ layout = "grid" }: { layout?: "grid" | "row" }) {
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-xl border border-border bg-card", layout === "row" && "w-40 shrink-0 sm:w-44")}>
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="mt-1 h-5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
