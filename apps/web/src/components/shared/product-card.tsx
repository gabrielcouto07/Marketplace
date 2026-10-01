import type { ProductSummaryDto } from "@marketplace/contracts";
import { Truck } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";

import { FavoriteButton } from "@/components/shared/favorite-button";
import { PriceTag } from "@/components/shared/price-tag";
import { RatingStars } from "@/components/shared/rating-stars";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { blurDataUrlFor, isDirectImage } from "@/lib/images";
import { discountPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: ProductSummaryDto;
  /** "grid" (2 colunas mobile) ou "row" (carrossel horizontal, largura fixa de 176 px). */
  layout?: "grid" | "row";
  priority?: boolean;
  className?: string;
}

/**
 * Card de produto (DESIGN.md › ProductCard), no padrão de loja: foto 1:1 em object-contain sobre
 * surface-muted, selo "Oferta" em Vermelho chapado (ou "Novo" em Azul), coração em pill
 * translúcida, título em 2 linhas que sublinha no hover, cinco estrelas com a contagem, preço com
 * o "-25%" em --deal e o "De:" riscado, parcelamento, "Frete grátis" em verde e a origem discreta.
 *
 * O corpo tem estrutura fixa (título → avaliação → preço → rodapé) para que, lado a lado, títulos e
 * preços fiquem alinhados mesmo quando um card tem desconto ou frete grátis e o vizinho não.
 * Levanta 4 px e vai a shadow-md no hover; encolhe para 98 % no toque (propriedades `translate` e
 * `scale`, que não brigam com animações de `transform` como o `reveal`).
 */
export function ProductCard({ product, layout = "grid", priority, className }: ProductCardProps) {
  const t = useTranslations("catalog");
  const format = useFormatter();
  const soldOut = product.stock <= 0;
  const onDeal = discountPercent(product.price, product.compareAtPrice ?? null) > 0;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition-[translate,scale,box-shadow] duration-200 ease-standard hover:-translate-y-1 hover:shadow-md active:scale-[0.98]",
        layout === "row" && "w-44 shrink-0",
        className,
      )}
    >
      <Link
        href={`/produto/${product.slug}`}
        className="flex flex-1 flex-col rounded-lg focus-ring"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
          <Image
            src={product.thumbnailUrl}
            alt={product.name}
            fill
            sizes={
              layout === "row" ? "176px" : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            }
            priority={priority}
            placeholder="blur"
            blurDataURL={blurDataUrlFor(product.thumbnailUrl)}
            unoptimized={isDirectImage(product.thumbnailUrl)}
            className={cn(
              "object-contain transition-transform duration-300 ease-standard group-hover:scale-[1.03]",
              soldOut && "opacity-50 grayscale",
            )}
          />
          {soldOut ? null : onDeal ? (
            <Badge variant="deal" className="absolute top-2 left-2">
              {t("dealBadge")}
            </Badge>
          ) : product.isNew ? (
            <Badge variant="primary" className="absolute top-2 left-2">
              {t("newBadge")}
            </Badge>
          ) : null}
          {soldOut ? (
            <Badge variant="inverse" className="absolute bottom-2 left-2">
              {t("soldOut")}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-3">
          <h3 className="line-clamp-2 min-h-10 text-body-sm font-medium text-foreground decoration-1 underline-offset-2 group-hover:text-primary group-hover:underline">
            {product.name}
          </h3>

          {/* Linha de avaliação sempre presente (altura fixa) para alinhar os preços entre cards. */}
          <div className="mt-1 flex h-4 items-center gap-1 text-caption text-foreground-muted">
            {product.reviewCount > 0 ? (
              <RatingStars
                value={product.rating}
                count={product.reviewCount}
                size="xs"
                showValue={false}
              />
            ) : product.soldCount > 0 ? (
              <span className="truncate">
                {t("soldCompact", {
                  count: format.number(product.soldCount, { notation: "compact" }),
                })}
              </span>
            ) : null}
          </div>

          <PriceTag
            price={product.price}
            compareAtPrice={product.compareAtPrice}
            size="sm"
            installments="short"
            showDiscountBadge
            className="mt-2"
          />

          <div className="mt-auto flex flex-col items-start gap-0.5 pt-2">
            {product.freeShipping ? (
              <p className="flex items-center gap-1 text-caption font-semibold text-success">
                <Truck className="size-3.5" strokeWidth={2} aria-hidden />
                {t("freeShipping")}
              </p>
            ) : null}
            <p className="max-w-full truncate text-caption text-foreground-muted">
              {t("shippedFrom", { city: product.seller.city })}
            </p>
          </div>
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
        layout === "row" && "w-44 shrink-0",
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
