"use client";

import { BadgeCheck, Clock, Loader2, MapPin, Package, Star, ThumbsUp } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { Suspense } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { RatingStars } from "@/components/shared/rating-stars";
import { ReputationMeter } from "@/components/shared/seller-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchView } from "@/features/catalog/components/search-view";
import { useSeller, useSellerReviews } from "@/features/seller/api";
import { Link } from "@/i18n/navigation";

export function SellerView({ slug }: { slug: string }) {
  const t = useTranslations("seller");
  const format = useFormatter();
  const { data, isPending, isError, error, refetch } = useSeller(slug);

  if (isError) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={() => refetch()} className="min-h-[60vh]" />
      </PageContainer>
    );
  }

  if (isPending) {
    return (
      <div>
        <Skeleton className="h-32 rounded-none sm:h-44" />
        <PageContainer>
          <div className="-mt-8 flex items-end gap-3">
            <Skeleton className="size-20 rounded-xl ring-4 ring-background" />
            <div className="flex flex-col gap-2 pb-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </PageContainer>
      </div>
    );
  }

  const seller = data;
  const metrics = [
    { icon: Package, value: format.number(seller.metrics.salesCount), label: t("metricSales") },
    { icon: ThumbsUp, value: `${seller.metrics.positiveRatingPercent}%`, label: t("metricPositive") },
    { icon: Star, value: `${seller.metrics.onTimeShippingPercent}%`, label: t("metricOnTime") },
    { icon: Clock, value: `~${seller.metrics.avgResponseTimeHours}h`, label: t("metricResponse") },
  ];

  return (
    <div>
      <div className="relative h-32 w-full bg-brand-blue-700 sm:h-44">
        {seller.bannerUrl ? <Image src={seller.bannerUrl} alt="" fill priority sizes="100vw" className="object-cover" /> : null}
      </div>
      <PageContainer>
        <header className="-mt-8 flex items-end gap-3">
          <Image
            src={seller.logoUrl ?? "/logo.svg"}
            alt=""
            width={80}
            height={80}
            className="size-20 shrink-0 rounded-xl bg-card shadow-md ring-4 ring-background"
          />
          <div className="min-w-0 pb-1">
            <h1 className="flex items-center gap-1.5 text-xl font-bold tracking-tight">
              <span className="truncate">{seller.name}</span>
              {seller.isOfficialStore ? <BadgeCheck className="size-5 shrink-0 text-primary" aria-label={t("officialStore")} /> : null}
            </h1>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" aria-hidden /> {t("location", { city: seller.city })}
            </p>
          </div>
        </header>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <ReputationMeter level={seller.reputationLevel} />
            <span className="text-xs font-medium">{t(`reputationLabels.${seller.reputationLevel}`)}</span>
          </div>
          <RatingStars value={seller.rating} count={seller.reviewCount} size="sm" />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("memberSince", { date: format.dateTime(new Date(seller.memberSince), "long") })} · {t("ruc")} {seller.ruc}
        </p>

        <section aria-label={t("metricsTitle")} className="mt-4">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metrics.map(({ icon: Icon, value, label }) => (
              <li key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="text-base leading-tight font-bold">{value}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{label}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <Tabs defaultValue="products" className="mt-5">
          <TabsList variant="line" className="w-full justify-start border-b border-border">
            <TabsTrigger value="products" className="h-11 flex-none px-3">
              {t("tabProducts")} ({seller.productCount})
            </TabsTrigger>
            <TabsTrigger value="reviews" className="h-11 flex-none px-3">
              {t("tabReviews")}
            </TabsTrigger>
            <TabsTrigger value="policies" className="h-11 flex-none px-3">
              {t("tabPolicies")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="products" className="-mx-4">
            {seller.productCount === 0 ? (
              <EmptyState title={t("noProducts")} />
            ) : (
              <Suspense fallback={null}>
                <SearchView fixed={{ sellerSlug: seller.slug }} hideHeading className="pt-1" />
              </Suspense>
            )}
          </TabsContent>
          <TabsContent value="reviews" className="pt-3">
            <SellerReviews slug={seller.slug} />
          </TabsContent>
          <TabsContent value="policies" className="flex flex-col gap-5 pt-3">
            <section>
              <h2 className="mb-1 text-base font-bold">{t("aboutStore")}</h2>
              <p className="text-sm leading-relaxed text-foreground/90">{seller.description}</p>
            </section>
            <section>
              <h2 className="mb-1 text-base font-bold">{t("exchangePolicy")}</h2>
              <p className="text-sm leading-relaxed text-foreground/90">{seller.exchangePolicy}</p>
            </section>
            <section>
              <h2 className="mb-2 text-base font-bold">{t("categoriesSold")}</h2>
              <ul className="flex flex-wrap gap-2">
                {seller.categories.map((c) => (
                  <li key={c.id}>
                    <Button variant="outline" size="sm" render={<Link href={`/categoria/${c.slug}`} />}>
                      {c.name}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          </TabsContent>
        </Tabs>
      </PageContainer>
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
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }
  if (reviews.isError) return <ErrorState error={reviews.error} compact onRetry={() => reviews.refetch()} />;
  if (items.length === 0) return <EmptyState title={t("noReviews")} />;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-border">
        {items.map((r) => (
          <li key={r.id} className="py-4 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <RatingStars value={r.rating} showValue={false} size="xs" />
              <time dateTime={r.createdAt} className="text-xs text-muted-foreground">
                {format.dateTime(new Date(r.createdAt), "short")}
              </time>
            </div>
            {r.title ? <p className="mt-1 text-sm font-semibold">{r.title}</p> : null}
            <p className="mt-1 text-sm text-foreground/90">{r.comment}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {r.authorName}
              {r.verifiedPurchase ? ` · ${tp("verifiedPurchase")}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {reviews.hasNextPage ? (
        <Button variant="outline" className="self-center" disabled={reviews.isFetchingNextPage} onClick={() => reviews.fetchNextPage()}>
          {reviews.isFetchingNextPage ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {tc("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
