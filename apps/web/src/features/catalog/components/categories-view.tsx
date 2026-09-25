"use client";

import { useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/store-shell";
import { CategoryTile } from "@/components/shared/category-tile";
import { ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/features/catalog/api";

/**
 * Página de departamentos: o título vem do Header (StoreShell `title`) no mobile e aparece como h1
 * no desktop; abaixo, a contagem e a grade de tiles.
 */
export function CategoriesView() {
  const t = useTranslations("catalog");
  const { data, isPending, isError, error, refetch } = useCategories();

  return (
    <PageContainer className="flex flex-col gap-4 pt-4 md:pt-8">
      <div className="flex flex-col gap-1">
        <h1 className="hidden text-title-1 text-foreground md:block">{t("categoriesTitle")}</h1>
        {isPending ? (
          <Skeleton className="h-5 w-64" />
        ) : (
          <p className="text-body-sm text-foreground-secondary">
            {t("categoriesSubtitle", { count: data?.length ?? 0 })}
          </p>
        )}
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {isPending
            ? Array.from({ length: 8 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-32 rounded-lg" />
                </li>
              ))
            : data.map((c) => (
                <li key={c.id}>
                  <CategoryTile category={c} variant="card" />
                </li>
              ))}
        </ul>
      )}
    </PageContainer>
  );
}
