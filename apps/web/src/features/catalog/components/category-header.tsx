"use client";

import { useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/store-shell";
import { CategoryIcon } from "@/components/shared/category-icon";
import { ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategory } from "@/features/catalog/api";

export function CategoryHeader({ slug }: { slug: string }) {
  const t = useTranslations("catalog");
  const { data, isPending, isError, error, refetch } = useCategory(slug);

  return (
    <PageContainer className="pt-4">
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} compact />
      ) : isPending ? (
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <CategoryIcon iconKey={data.iconKey} className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{data.name}</h1>
            <p className="text-xs text-muted-foreground">{t("categoryProducts", { count: data.productCount })}</p>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
