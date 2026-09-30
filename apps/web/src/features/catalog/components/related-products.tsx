"use client";

import type { ProductDetailDto } from "@marketplace/contracts";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { HorizontalScroller, SectionHeader } from "@/components/shared/states";
import { useProductSearch } from "@/features/catalog/api";
import { Link } from "@/i18n/navigation";

/**
 * "Você também pode gostar": os mais vendidos da mesma categoria, sem o produto atual.
 * Some silenciosamente quando não há nada a mostrar (categoria com um único produto ou erro).
 */
export function RelatedProducts({
  product,
  className,
}: {
  product: ProductDetailDto;
  className?: string;
}) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  const category = product.categoryPath[product.categoryPath.length - 1];
  const { data, isPending, isError } = useProductSearch({
    categorySlug: category?.slug,
    pageSize: 9,
    sort: "bestSelling",
  });
  const items = (data?.pages[0]?.items ?? []).filter((p) => p.id !== product.id).slice(0, 8);

  if (isError || (!isPending && items.length === 0)) return null;

  return (
    <section aria-label={t("relatedProducts")} className={className}>
      <SectionHeader
        title={t("relatedProducts")}
        action={
          category ? (
            <Link
              href={`/categoria/${category.slug}`}
              className="flex shrink-0 items-center gap-1 rounded-sm py-2 text-body-sm font-semibold text-primary focus-ring hover:underline"
            >
              {tc("seeAll")}
              <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
            </Link>
          ) : undefined
        }
      />
      <HorizontalScroller>
        {isPending
          ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} layout="row" />)
          : items.map((p) => <ProductCard key={p.id} product={p} layout="row" />)}
      </HorizontalScroller>
    </section>
  );
}
