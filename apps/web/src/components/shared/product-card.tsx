import type { ProductSummaryDto } from "@marketplace/contracts";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";

import { FavoriteButton } from "@/components/shared/favorite-button";
import { PriceTag } from "@/components/shared/price-tag";
import { RatingStars } from "@/components/shared/rating-stars";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { BLUR_DATA_URL } from "@/lib/images";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: ProductSummaryDto;
  /** "grid" (2 colunas mobile) ou "row" (carrossel horizontal, largura fixa de 160 px). */
  layout?: "grid" | "row";
  priority?: boolean;
  className?: string;
}

/**
 * Card de produto (DESIGN.md › ProductCard): imagem 1:1 em object-contain sobre surface-muted,
 * coração em pill translúcida, título em 2 linhas, preço com centavos sobrescritos e % em verde,
 * parcelamento, "Frete grátis" em success-soft e origem discreta. Eleva de xs para sm no hover/press.
 */
export function ProductCard({ product, layout = "grid", priority, className }: ProductCardProps) {
  const t = useTranslations("catalog");
  const format = useFormatter();
  const soldOut = product.stock <= 0;

  return (
    <article
      className={cn(
        "group relative flex pressable flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition-shadow hover:shadow-sm",
        layout === "row" && "w-40 shrink-0",
        className,
      )}
    >
      <Link
        href={`/produto/${product.slug}`}
        className="flex flex-1 flex-col rounded-lg focus-ring"
      >
        <div className="relative aspect-square w-full bg-surface-muted">
          <Image
            src={product.thumbnailUrl}
            alt={product.name}
            fill
            sizes={
              layout === "row" ? "160px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            }
            priority={priority}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className={cn(
              "object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]",
              soldOut && "opacity-50 grayscale",
            )}
          />
          {product.isNew && !soldOut ? (
            <Badge variant="soft" className="absolute top-2 left-2">
              {t("newBadge")}
            </Badge>
          ) : null}
          {soldOut ? (
            <Badge variant="inverse" className="absolute bottom-2 left-2">
              {t("soldOut")}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="line-clamp-2 min-h-10 text-body-sm font-medium text-foreground">
            {product.name}
          </h3>
          {product.reviewCount > 0 || product.soldCount > 0 ? (
            <p className="flex items-center gap-1 text-caption text-foreground-muted">
              {product.reviewCount > 0 ? (
                <RatingStars value={product.rating} size="xs" variant="compact" />
              ) : null}
              {product.reviewCount > 0 && product.soldCount > 0 ? <span aria-hidden>·</span> : null}
              {product.soldCount > 0 ? (
                <span>
                  {t("soldCompact", {
                    count: format.number(product.soldCount, { notation: "compact" }),
                  })}
                </span>
              ) : null}
            </p>
          ) : null}
          <PriceTag
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            size="sm"
            installments="short"
            showDiscountBadge
            className="mt-auto pt-1"
          />
          {product.freeShipping ? (
            <Badge variant="success" className="mt-1">
              {t("freeShipping")}
            </Badge>
          ) : null}
          <p className="text-caption text-foreground-muted">
            {t("shippedFrom", { city: product.seller.city })}
          </p>
        </div>
      </Link>
      <FavoriteButton product={product} className="absolute top-2 right-2" />
    </article>
  );
}

export function ProductCardSkeleton({ layout = "grid" }: { layout?: "grid" | "row" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xs",
        layout === "row" && "w-40 shrink-0",
      )}
    >
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="mt-1 h-3 w-1/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    </div>
  );
}
