"use client";

import { BadgeCheck, Loader2, ThumbsUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { RatingStars } from "@/components/shared/rating-stars";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductReviews, useReviewSummary } from "@/features/catalog/api";
import { cn } from "@/lib/utils";

/** Card de avaliações: média grande + distribuição por estrelas e lista paginada. */
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
      className={cn("flex flex-col gap-4 rounded-3xl bg-card p-4.5 shadow-card", className)}
    >
      <h2 id="reviews-title" className="text-base font-extrabold tracking-tight">
        {t("reviewsTitle")}
      </h2>

      {summary.isPending ? (
        <div className="flex items-center gap-4.5">
          <Skeleton className="size-24 rounded-2xl" />
          <div className="flex flex-1 flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-1.5 rounded-full" />
            ))}
          </div>
        </div>
      ) : summary.isError ? (
        <ErrorState error={summary.error} compact onRetry={() => summary.refetch()} />
      ) : (
        <div className="flex items-center gap-4.5">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[40px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
              {summary.data.average.toFixed(1).replace(".", ",")}
            </span>
            <RatingStars value={summary.data.average} showValue={false} size="sm" />
            <span className="text-[11.5px] text-muted-foreground">
              {t("reviewsCount", { count: summary.data.total })}
            </span>
          </div>
          <ul className="flex flex-1 flex-col-reverse gap-[5px]" aria-label={t("reviewsTitle")}>
            {summary.data.distribution.map((count, i) => {
              const pct = summary.data.total ? Math.round((count / summary.data.total) * 100) : 0;
              return (
                <li key={i} className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
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
                      className="block h-full rounded-full bg-star transition-[width] duration-500"
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
        <div className="flex flex-col gap-3.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 border-t border-border pt-3.5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : reviews.isError ? (
        <ErrorState error={reviews.error} compact onRetry={() => reviews.refetch()} />
      ) : (
        <ul className="flex flex-col">
          {items.map((r, i) => (
            <li
              key={r.id}
              className="flex animate-rise flex-col gap-1.5 border-t border-border pt-3.5 pb-3.5 last:pb-0"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[13.5px] font-bold">{r.authorName}</span>
                <time dateTime={r.createdAt} className="shrink-0 text-xs text-muted-foreground">
                  {format.dateTime(new Date(r.createdAt), "short")}
                </time>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <RatingStars value={r.rating} showValue={false} size="xs" />
                {r.verifiedPurchase ? (
                  <span className="inline-flex items-center gap-1 rounded-[5px] bg-success-soft px-1.5 py-0.5 text-[11px] font-bold text-success">
                    <BadgeCheck className="size-3" aria-hidden /> {t("verifiedPurchase")}
                  </span>
                ) : null}
              </div>
              {r.title ? <p className="text-[13.5px] font-bold">{r.title}</p> : null}
              <p className="text-[13.5px] leading-relaxed text-body">{r.comment}</p>
              {r.helpfulCount > 0 ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ThumbsUp className="size-3.5" aria-hidden />{" "}
                  {t("helpful", { count: r.helpfulCount })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {reviews.hasNextPage ? (
        <Button
          variant="soft"
          size="sm"
          onClick={() => reviews.fetchNextPage()}
          disabled={reviews.isFetchingNextPage}
          className="self-center"
        >
          {reviews.isFetchingNextPage ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : null}
          {tc("loadMore")}
        </Button>
      ) : null}
    </section>
  );
}
