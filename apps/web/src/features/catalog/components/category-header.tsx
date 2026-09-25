"use client";

import { useTranslations } from "next-intl";

import { ErrorState, SectionHeader } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategory } from "@/features/catalog/api";
import { cn } from "@/lib/utils";

interface CategoryHeaderProps {
  slug: string;
  /** Total de resultados da listagem atual (com filtros); sem ele usa a contagem da categoria. */
  resultCount?: number;
  className?: string;
}

/** Cabeçalho da página de categoria: nome como h1 (title-2) + contagem em texto secundário. */
export function CategoryHeader({ slug, resultCount, className }: CategoryHeaderProps) {
  const t = useTranslations("catalog");
  const { data, isPending, isError, error, refetch } = useCategory(slug);

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} compact className={className} />;
  }

  if (isPending) {
    return (
      <div className={cn("flex h-7 items-center justify-between gap-3", className)} aria-hidden>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  const count = resultCount ?? data.productCount;
  return (
    <SectionHeader
      as="h1"
      title={data.name}
      className={cn("mb-0", className)}
      action={
        <p className="shrink-0 text-body-sm text-foreground-secondary tabular-nums">
          {t("resultsCount", { count })}
        </p>
      }
    />
  );
}
