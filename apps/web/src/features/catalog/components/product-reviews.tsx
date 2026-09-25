"use client";

import { BadgeCheck, Loader2, ThumbsUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { RatingStars } from "@/components/shared/rating-stars";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductReviews, useReviewSummary } from "@/features/catalog/api";

export function ProductReviews({ productId }: { productId: string }) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  const format = useFormatter();
  const summary = useReviewSummary(productId);
  const reviews = useProductReviews(productId);
  const items = reviews.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section aria-labelledby="reviews-title" className="flex flex-col gap-4">
      <h2 id="reviews-title" className="text-lg font-bold">
        {t("reviewsTitle")}
      </h2>

      {summary.isPending ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : summary.isError ? (
        <ErrorState error={summary.error} compact onRetry={() => summary.refetch()} />
      ) : (
        <div className="flex gap-5 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col items-center justify-center">
            <span className="text-4xl leading-none font-bold">{summary.data.average.toFixed(1)}</span>
            <RatingStars value={summary.data.average} showValue={false} size="sm" className="mt-1" />
            <span className="mt-1 text-xs text-muted-foreground">{t("reviewsCount", { count: summary.data.total })}</span>
          </div>
          <ul className="flex flex-1 flex-col-reverse gap-1" aria-label={t("reviewsTitle")}>
            {summary.data.distribution.map((count, i) => {
              const pct = summary.data.total ? Math.round((count / summary.data.total) * 100) : 0;
              return (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-right tabular-nums">{i + 1}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${i + 1} ★`}>
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-8 text-right text-muted-foreground tabular-nums">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {reviews.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : reviews.isError ? (
        <ErrorState error={reviews.error} compact onRetry={() => reviews.refetch()} />
      ) : (
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
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{r.authorName}</span>
                {r.verifiedPurchase ? (
                  <span className="flex items-center gap-1 text-success">
                    <BadgeCheck className="size-3.5" aria-hidden /> {t("verifiedPurchase")}
                  </span>
                ) : null}
                <span className="flex items-center gap-1">
                  <ThumbsUp className="size-3.5" aria-hidden /> {t("helpful", { count: r.helpfulCount })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {reviews.hasNextPage ? (
        <Button variant="outline" onClick={() => reviews.fetchNextPage()} disabled={reviews.isFetchingNextPage} className="self-center">
          {reviews.isFetchingNextPage ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {tc("loadMore")}
        </Button>
      ) : null}
    </section>
  );
}
