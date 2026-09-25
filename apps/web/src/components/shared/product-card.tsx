import type { ProductSummaryDto } from "@marketplace/contracts";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";

import { FavoriteButton } from "@/components/shared/favorite-button";
import { PriceTag } from "@/components/shared/price-tag";
import { RatingStars } from "@/components/shared/rating-stars";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: ProductSummaryDto;
  /** "grid" (2 colunas mobile) ou "row" (carrossel horizontal, largura fixa de 160 px). */
  layout?: "grid" | "row";
  priority?: boolean;
  className?: string;
}

/**
 * Card branco sem borda (cantos 20 px) com imagem arredondada, selos em pílula,
 * nome em 2 linhas, nota + vendidos, preço em destaque, parcela e frete grátis.
 * Levita no hover e encolhe ao toque.
 */
export function ProductCard({ product, layout = "grid", priority, className }: ProductCardProps) {
  const t = useTranslations("catalog");
  const format = useFormatter();
  const soldOut = product.stock <= 0;

  return (
    <article
      className={cn(
        "group relative flex pressable flex-col rounded-2xl bg-card p-1.5 pb-3 shadow-card transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-float",
        layout === "row" && "w-40 shrink-0",
        className,
      )}
    >
      <Link
        href={`/produto/${product.slug}`}
        className="flex flex-1 flex-col gap-2 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface">
          <Image
            src={product.thumbnailUrl}
            alt={product.name}
            fill
            sizes={
              layout === "row" ? "160px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            }
            priority={priority}
            className={cn(
              "object-cover transition-transform duration-500 group-hover:scale-[1.04]",
              soldOut && "opacity-60 grayscale",
            )}
          />
          <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
            {product.discountPercent > 0 ? (
              <span className="rounded-full bg-cta px-[7px] py-[3px] text-[11px] font-extrabold text-cta-foreground">
                -{product.discountPercent}%
              </span>
            ) : null}
            {product.isNew ? (
              <span className="rounded-full bg-primary px-[7px] py-[3px] text-[11px] font-extrabold text-primary-foreground">
                {t("newBadge")}
              </span>
            ) : null}
          </div>
          {soldOut ? (
            <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1 text-center text-xs font-bold text-ink-foreground">
              {t("soldOut")}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-[3px] px-1.5">
          <h3 className="line-clamp-2 min-h-[34px] text-[13px] leading-[1.3] font-medium text-foreground">
            {product.name}
          </h3>
          {product.reviewCount > 0 || product.soldCount > 0 ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
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
            className="mt-auto pt-1"
          />
          {product.freeShipping ? (
            <span className="text-[11.5px] font-bold text-success">{t("freeShipping")}</span>
          ) : null}
        </div>
      </Link>
      <FavoriteButton product={product} className="absolute top-1 right-1" />
    </article>
  );
}

export function ProductCardSkeleton({ layout = "grid" }: { layout?: "grid" | "row" }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl bg-card p-1.5 pb-3 shadow-card",
        layout === "row" && "w-40 shrink-0",
      )}
    >
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="flex flex-col gap-2 px-1.5">
        <Skeleton className="h-3.5 w-full rounded-md" />
        <Skeleton className="h-3.5 w-3/4 rounded-md" />
        <Skeleton className="mt-1 h-3 w-1/3 rounded-md" />
        <Skeleton className="h-5 w-1/2 rounded-md" />
        <Skeleton className="h-3 w-2/5 rounded-md" />
      </div>
    </div>
  );
}
