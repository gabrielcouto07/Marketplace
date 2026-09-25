"use client";

import { useFormatter, useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/store-shell";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { RatingStars } from "@/components/shared/rating-stars";
import { OfficialBadge, ReputationMeter, SellerAvatar } from "@/components/shared/seller-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProductSearch } from "@/features/catalog/api";
import { useSeller, useSellerReviews } from "@/features/seller/api";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const CARD = "rounded-lg border border-border bg-surface p-4 shadow-xs";
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/** Anos completos desde a data informada (0 quando a loja tem menos de um ano). */
function yearsSince(iso: string): number {
  const elapsed = new Date().getTime() - new Date(iso).getTime();
  return Math.max(0, Math.floor(elapsed / YEAR_MS));
}

/**
 * Página da loja: card de identidade (avatar, nome + selo, cidade, reputação em barra e
 * mini-stats 2×2) e abas Produtos / Avaliações / Políticas. Sem banner colorido: a confiança
 * vem dos dados, não da cor.
 */
export function SellerView({ slug }: { slug: string }) {
  const t = useTranslations("seller");
  const tt = useTranslations("trust");
  const format = useFormatter();
  const { data, isPending, isError, error, refetch } = useSeller(slug);

  if (isError) {
    return (
      <PageContainer className="py-4">
        <ErrorState error={error} onRetry={() => refetch()} className="min-h-[60vh]" />
      </PageContainer>
    );
  }

  if (isPending) return <SellerSkeleton />;

  const seller = data;
  const metrics = [
    {
      value: format.number(seller.metrics.salesCount, {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
      label: t("metricSales"),
    },
    { value: `${seller.metrics.positiveRatingPercent}%`, label: t("metricPositive") },
    { value: `${seller.metrics.onTimeShippingPercent}%`, label: t("metricOnTime") },
    { value: `~${seller.metrics.avgResponseTimeHours}h`, label: t("metricResponse") },
  ];

  return (
    <PageContainer className="flex flex-col gap-4 py-4 lg:py-6">
      <section aria-labelledby="seller-name" className={cn(CARD, "flex flex-col gap-4")}>
        <div className="flex items-center gap-4">
          <SellerAvatar seller={seller} size="xl" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 id="seller-name" className="flex items-center gap-2 text-title-2 text-foreground">
              <span className="min-w-0 truncate">{seller.name}</span>
              {seller.isOfficialStore ? <OfficialBadge className="size-5" /> : null}
            </h1>
            <p className="text-caption text-foreground-secondary">
              {t("location", { city: seller.city })} ·{" "}
              {t("yearsOnMarketplace", { years: yearsSince(seller.memberSince) })}
            </p>
          </div>
        </div>

        <p className="text-body-sm leading-relaxed text-foreground-secondary">
          {seller.description}
        </p>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-2 text-caption">
            <span className="text-foreground-secondary">{tt("reputationLabel")}</span>
            <span className="font-medium text-foreground">
              {t(`reputationLabels.${seller.reputationLevel}`)}
            </span>
          </div>
          <ReputationMeter level={seller.reputationLevel} />
          <RatingStars
            value={seller.rating}
            count={seller.reviewCount}
            variant="compact"
            size="xs"
            className="mt-1"
          />
        </div>

        <ul
          aria-label={t("metricsTitle")}
          className="grid grid-cols-2 gap-4 border-t border-border pt-4"
        >
          {metrics.map(({ value, label }) => (
            <li key={label} className="flex flex-col">
              <span className="text-title-3 text-foreground tabular-nums">{value}</span>
              <span className="text-caption text-foreground-muted">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      <Tabs defaultValue="products" className="gap-4">
        <TabsList>
          <TabsTrigger value="products">{t("tabProducts")}</TabsTrigger>
          <TabsTrigger value="reviews">{t("tabReviews")}</TabsTrigger>
          <TabsTrigger value="policies">{t("tabPolicies")}</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          {seller.productCount === 0 ? (
            <EmptyState illustration="bag" title={t("noProducts")} />
          ) : (
            <SellerProducts slug={seller.slug} />
          )}
        </TabsContent>

        <TabsContent value="reviews">
          <SellerReviews slug={seller.slug} />
        </TabsContent>

        <TabsContent value="policies" className="flex flex-col gap-4">
          <section aria-labelledby="exchange-title" className={cn(CARD, "flex flex-col gap-4")}>
            <h2 id="exchange-title" className="text-title-3 text-foreground">
              {t("exchangeTitle")}
            </h2>
            <p className="text-body-sm leading-relaxed text-foreground-secondary">
              {seller.exchangePolicy}
            </p>
            <dl className="flex flex-col divide-y divide-border border-t border-border">
              <div className="flex justify-between gap-4 py-3 text-body-sm">
                <dt className="text-foreground-secondary">{t("ruc")}</dt>
                <dd className="font-medium text-foreground tabular-nums">{seller.ruc}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3 text-body-sm">
                <dt className="text-foreground-secondary">{t("metricResponse")}</dt>
                <dd className="font-medium text-foreground tabular-nums">
                  ~{seller.metrics.avgResponseTimeHours}h
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3 pb-0 text-body-sm">
                <dt className="text-foreground-secondary">{t("memberSinceLabel")}</dt>
                <dd className="text-right font-medium text-foreground">
                  {format.dateTime(new Date(seller.memberSince), "long")}
                </dd>
              </div>
            </dl>
          </section>
          {seller.categories.length > 0 ? (
            <section aria-labelledby="categories-title" className={cn(CARD, "flex flex-col gap-4")}>
              <h2 id="categories-title" className="text-title-3 text-foreground">
                {t("categoriesSold")}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {seller.categories.map((c) => (
                  <li key={c.id}>
                    <Button
                      variant="soft"
                      size="sm"
                      render={<Link href={`/categoria/${c.slug}`} />}
                    >
                      {c.name}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

/** Grade de produtos da loja (2 colunas no mobile), paginada com "Carregar mais". */
function SellerProducts({ slug }: { slug: string }) {
  const t = useTranslations("catalog");
  const tc = useTranslations("common");
  const search = useProductSearch({ sellerSlug: slug, sort: "relevance" });
  const items = search.data?.pages.flatMap((p) => p.items) ?? [];

  if (search.isError) {
    return <ErrorState error={search.error} onRetry={() => search.refetch()} />;
  }

  if (search.isPending) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        illustration="search"
        title={t("noResultsTitle")}
        description={t("noResultsDescription")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p, i) => (
          <ProductCard key={p.id} product={p} priority={i < 4} />
        ))}
      </div>
      {search.hasNextPage ? (
        <Button
          variant="secondary"
          className="self-center"
          loading={search.isFetchingNextPage}
          onClick={() => search.fetchNextPage()}
        >
          {tc("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}

function SellerReviews({ slug }: { slug: string }) {
  const t = useTranslations("seller");
  const tp = useTranslations("product");
  const tc = useTranslations("common");
  const format = useFormatter();
  const reviews = useSellerReviews(slug);
  const items = reviews.data?.pages.flatMap((p) => p.items) ?? [];

  if (reviews.isPending) {
    return (
      <ul className={cn(CARD, "flex flex-col divide-y divide-border")}>
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-10 w-full" />
          </li>
        ))}
      </ul>
    );
  }
  if (reviews.isError)
    return <ErrorState error={reviews.error} compact onRetry={() => reviews.refetch()} />;
  if (items.length === 0) return <EmptyState illustration="check" title={t("noReviews")} />;

  return (
    <div className="flex flex-col gap-4">
      <ul className={cn(CARD, "flex flex-col divide-y divide-border")}>
        {items.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-body-sm font-medium text-foreground">
                {r.authorName}
              </span>
              <time dateTime={r.createdAt} className="shrink-0 text-caption text-foreground-muted">
                {format.dateTime(new Date(r.createdAt), "short")}
              </time>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RatingStars value={r.rating} showValue={false} size="xs" />
              {r.verifiedPurchase ? (
                <Badge variant="success">{tp("verifiedPurchase")}</Badge>
              ) : null}
            </div>
            {r.title ? <p className="text-body-sm font-medium text-foreground">{r.title}</p> : null}
            <p className="text-body-sm leading-relaxed text-foreground-secondary">{r.comment}</p>
          </li>
        ))}
      </ul>
      {reviews.hasNextPage ? (
        <Button
          variant="secondary"
          className="self-center"
          loading={reviews.isFetchingNextPage}
          onClick={() => reviews.fetchNextPage()}
        >
          {tc("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}

/** Skeleton no formato exato: card de identidade, abas e grade 2 colunas. */
function SellerSkeleton() {
  return (
    <PageContainer className="flex flex-col gap-4 py-4 lg:py-6">
      <div className={cn(CARD, "flex flex-col gap-4")}>
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </PageContainer>
  );
}
