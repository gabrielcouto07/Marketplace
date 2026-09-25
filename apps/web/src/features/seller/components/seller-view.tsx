"use client";

import { BadgeCheck, Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Suspense } from "react";

import { BackButton } from "@/components/shared/back-button";
import { RatingStars } from "@/components/shared/rating-stars";
import { ReputationMeter, SellerAvatar } from "@/components/shared/seller-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/store-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchView } from "@/features/catalog/components/search-view";
import { useSeller, useSellerReviews } from "@/features/seller/api";
import { Link } from "@/i18n/navigation";
import { sellerColor } from "@/lib/palette";

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/** Anos completos desde a data informada (0 quando a loja tem menos de um ano). */
function yearsSince(iso: string): number {
  const elapsed = new Date().getTime() - new Date(iso).getTime();
  return Math.max(0, Math.floor(elapsed / YEAR_MS));
}

export function SellerView({ slug }: { slug: string }) {
  const t = useTranslations("seller");
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
  const color = sellerColor(seller.slug);
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
  ];

  return (
    <div className="flex flex-col">
      {/* Hero na cor da loja, com círculos decorativos e botão voltar flutuante. */}
      <div className="relative h-[150px] w-full overflow-hidden" style={{ backgroundColor: color }}>
        <span
          aria-hidden
          className="absolute -top-[60px] -right-[50px] size-[220px] rounded-full bg-white/10"
        />
        <span
          aria-hidden
          className="absolute -bottom-[70px] left-[40%] size-[160px] rounded-full bg-white/[0.07]"
        />
        <div className="mx-auto w-full max-w-6xl px-3 pt-3">
          <BackButton className="relative z-10" />
        </div>
      </div>

      <PageContainer className="relative -mt-10 flex flex-col gap-3">
        <section className="flex animate-rise flex-col gap-3.5 rounded-3xl bg-card p-4 shadow-card">
          <div className="-mt-11 flex items-end gap-3">
            <SellerAvatar seller={seller} size="xl" />
            {seller.isOfficialStore ? (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11.5px] font-extrabold text-accent-foreground">
                <BadgeCheck className="size-[13px]" strokeWidth={2.4} aria-hidden />
                {t("officialStore")}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-0.5">
            <h1 className="text-[22px] leading-tight font-extrabold tracking-[-0.02em]">
              {seller.name}
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {t("locationShort", { city: seller.city })} ·{" "}
              {t("yearsOnMarketplace", { years: yearsSince(seller.memberSince) })}
            </p>
          </div>

          <p className="text-[13.5px] leading-relaxed text-body">{seller.description}</p>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="font-bold">{t("reputation")}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <RatingStars value={seller.rating} variant="compact" size="xs" />
                <span>· {t("reviewsCount", { count: seller.reviewCount })}</span>
              </span>
            </div>
            <ReputationMeter level={seller.reputationLevel} />
          </div>

          <ul aria-label={t("metricsTitle")} className="grid grid-cols-3 gap-2">
            {metrics.map(({ value, label }) => (
              <li key={label} className="flex flex-col gap-0.5 rounded-lg bg-surface p-2.5">
                <span className="text-[15px] font-extrabold tabular-nums">{value}</span>
                <span className="text-[11.5px] leading-tight text-muted-foreground">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <Tabs defaultValue="products" className="gap-3">
          <TabsList className="rounded-lg">
            <TabsTrigger value="products" className="h-[38px] rounded-[11px]">
              {t("tabProducts")}
            </TabsTrigger>
            <TabsTrigger value="reviews" className="h-[38px] rounded-[11px]">
              {t("tabReviews")}
            </TabsTrigger>
            <TabsTrigger value="policies" className="h-[38px] rounded-[11px]">
              {t("tabPolicies")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="-mx-4">
            {seller.productCount === 0 ? (
              <div className="px-4">
                <EmptyState title={t("noProducts")} />
              </div>
            ) : (
              <Suspense fallback={null}>
                <SearchView fixed={{ sellerSlug: seller.slug }} hideHeading className="pt-0" />
              </Suspense>
            )}
          </TabsContent>

          <TabsContent value="reviews">
            <SellerReviews slug={seller.slug} />
          </TabsContent>

          <TabsContent value="policies" className="flex flex-col gap-3">
            <section className="flex flex-col gap-3 rounded-3xl bg-card p-4 text-[13.5px] leading-relaxed text-body shadow-card">
              <h2 className="text-[15px] font-extrabold text-foreground">{t("exchangeTitle")}</h2>
              <p>{seller.exchangePolicy}</p>
              <div className="flex justify-between gap-3 border-t border-border pt-2.5">
                <span className="text-muted-foreground">{t("ruc")}</span>
                <b className="text-foreground">{seller.ruc}</b>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2.5">
                <span className="text-muted-foreground">{t("metricResponse")}</span>
                <b className="text-foreground">~{seller.metrics.avgResponseTimeHours}h</b>
              </div>
              <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
                {t("memberSince", { date: format.dateTime(new Date(seller.memberSince), "long") })}
              </p>
            </section>
            {seller.categories.length > 0 ? (
              <section className="flex flex-col gap-3 rounded-3xl bg-card p-4 shadow-card">
                <h2 className="text-[15px] font-extrabold">{t("categoriesSold")}</h2>
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
    </div>
  );
}

function SellerSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="h-[150px] rounded-none" />
      <PageContainer className="relative -mt-10 flex flex-col gap-3">
        <div className="flex flex-col gap-3.5 rounded-3xl bg-card p-4 shadow-card">
          <div className="-mt-11 flex items-end gap-3">
            <Skeleton className="size-[76px] rounded-3xl ring-[5px] ring-card" />
            <Skeleton className="mb-1 h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[58px] rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="h-[46px] rounded-lg" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[300px] rounded-2xl" />
          ))}
        </div>
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
      <div className="flex flex-col gap-3.5 rounded-3xl bg-card p-4 shadow-card">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }
  if (reviews.isError)
    return <ErrorState error={reviews.error} compact onRetry={() => reviews.refetch()} />;
  if (items.length === 0) return <EmptyState title={t("noReviews")} />;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col rounded-3xl bg-card p-4 shadow-card">
        {items.map((r, i) => (
          <li
            key={r.id}
            className="flex animate-rise flex-col gap-1.5 border-t border-border py-3.5 first:border-t-0 first:pt-0 last:pb-0"
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13.5px] font-bold">{r.authorName}</span>
              <time dateTime={r.createdAt} className="shrink-0 text-xs text-muted-foreground">
                {format.dateTime(new Date(r.createdAt), "short")}
              </time>
            </div>
            <RatingStars value={r.rating} showValue={false} size="xs" />
            {r.title ? <p className="text-[13.5px] font-bold">{r.title}</p> : null}
            <p className="text-[13.5px] leading-relaxed text-body">{r.comment}</p>
            {r.verifiedPurchase ? (
              <p className="text-xs font-semibold text-success">{tp("verifiedPurchase")}</p>
            ) : null}
          </li>
        ))}
      </ul>
      {reviews.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          disabled={reviews.isFetchingNextPage}
          onClick={() => reviews.fetchNextPage()}
        >
          {reviews.isFetchingNextPage ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : null}
          {tc("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}
