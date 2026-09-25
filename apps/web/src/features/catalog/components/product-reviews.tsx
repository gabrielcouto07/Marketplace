"use client";

import { BadgeCheck, ThumbsUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { RatingStars } from "@/components/shared/rating-stars";
import { ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductReviews, useReviewSummary } from "@/features/catalog/api";
import { cn } from "@/lib/utils";

/**
 * Avaliações do produto: média em display + distribuição por estrelas (barras com preenchimento
 * dourado) e lista `divide-y` paginada, com "Compra verificada" em badge success.
 */
export function ProductReviews({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  const format = useFormatter();
  const summary = useReviewSummary(productId);
  const reviews = useProductReviews(productId);
  const items = reviews.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <section
      aria-labelledby="reviews-title"
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs",
        className,
      )}
    >
      <h2 id="reviews-title" className="text-title-3 text-foreground">
        {t("reviewsTitle")}
      </h2>

      {summary.isPending ? (
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-1.5 rounded-full" />
            ))}
          </div>
        </div>
      ) : summary.isError ? (
        <ErrorState error={summary.error} compact onRetry={() => summary.refetch()} />
      ) : (
        <div className="flex items-center gap-6">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <span className="text-display text-foreground tabular-nums">
              {summary.data.average.toFixed(1).replace(".", ",")}
            </span>
            <RatingStars value={summary.data.average} showValue={false} size="sm" />
            <span className="text-caption text-foreground-muted">
              {t("reviewsCount", { count: summary.data.total })}
            </span>
          </div>
          <ul className="flex flex-1 flex-col-reverse gap-1" aria-label={t("reviewsTitle")}>
            {summary.data.distribution.map((count, i) => {
              const pct = summary.data.total ? Math.round((count / summary.data.total) * 100) : 0;
              return (
                <li
                  key={i}
                  className="flex items-center gap-2 text-caption text-foreground-secondary"
                >
                  <span className="w-2 text-right tabular-nums">{i + 1}</span>
                  <span
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"
                    role="meter"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${i + 1} ★`}
                  >
                    <span
                      className="block h-full rounded-full bg-gold"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {reviews.isPending ? (
        <ul className="flex flex-col divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex flex-col gap-2 py-4 last:pb-0">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-10 w-full" />
            </li>
          ))}
        </ul>
      ) : reviews.isError ? (
        <ErrorState error={reviews.error} compact onRetry={() => reviews.refetch()} />
      ) : items.length === 0 ? null : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-4 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-body-sm font-medium text-foreground">
                  {r.authorName}
                </span>
                <time
                  dateTime={r.createdAt}
                  className="shrink-0 text-caption text-foreground-muted"
                >
                  {format.dateTime(new Date(r.createdAt), "short")}
                </time>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RatingStars value={r.rating} showValue={false} size="xs" />
                {r.verifiedPurchase ? (
                  <Badge variant="success">
                    <BadgeCheck strokeWidth={1.75} aria-hidden /> {t("verifiedPurchase")}
                  </Badge>
                ) : null}
              </div>
              {r.title ? (
                <p className="text-body-sm font-medium text-foreground">{r.title}</p>
              ) : null}
              <p className="text-body-sm leading-relaxed text-foreground-secondary">{r.comment}</p>
              {r.helpfulCount > 0 ? (
                <span className="flex items-center gap-1 text-caption text-foreground-muted">
                  <ThumbsUp className="size-3.5" strokeWidth={1.75} aria-hidden />
                  {t("helpful", { count: r.helpfulCount })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {reviews.hasNextPage ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => reviews.fetchNextPage()}
          loading={reviews.isFetchingNextPage}
          className="self-center"
        >
          {tc("loadMore")}
        </Button>
      ) : null}
    </section>
  );
}
