"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/store-shell";
import { CategoryIcon } from "@/components/shared/category-icon";
import { ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/features/catalog/api";
import { Link } from "@/i18n/navigation";

export function CategoriesView() {
  const t = useTranslations("catalog");
  const { data, isPending, isError, error, refetch } = useCategories();

  return (
    <PageContainer className="pt-4">
      <h1 className="mb-4 text-xl font-bold tracking-tight">{t("categoriesTitle")}</h1>
      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {isPending
            ? Array.from({ length: 8 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-[88px] rounded-xl" />
                </li>
              ))
            : data.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/categoria/${c.slug}`}
                    className="flex min-h-[88px] items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <CategoryIcon iconKey={c.iconKey} className="size-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{t("categoryProducts", { count: c.productCount })}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
        </ul>
      )}
    </PageContainer>
  );
}
