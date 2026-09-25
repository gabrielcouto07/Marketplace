"use client";

import { useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/store-shell";
import { CategoryTile } from "@/components/shared/category-tile";
import { ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/features/catalog/api";

/** Página de departamentos: título grande, subtítulo com a contagem e grade de tiles tintados. */
export function CategoriesView() {
  const t = useTranslations("catalog");
  const { data, isPending, isError, error, refetch } = useCategories();

  return (
    <PageContainer className="flex flex-col gap-4 pt-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">{t("categoriesTitle")}</h1>
        {isPending ? (
          <Skeleton className="h-4 w-56 rounded-md" />
        ) : (
          <p className="text-[13.5px] text-muted-foreground">
            {t("categoriesSubtitle", { count: data?.length ?? 0 })}
          </p>
        )}
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {isPending
            ? Array.from({ length: 8 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-[132px] rounded-[22px]" />
                </li>
              ))
            : data.map((c, i) => (
                <li key={c.id} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                  <CategoryTile category={c} variant="card" />
                </li>
              ))}
        </ul>
      )}
    </PageContainer>
  );
}
