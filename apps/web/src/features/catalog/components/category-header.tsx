"use client";

import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategory } from "@/features/catalog/api";
import { cn } from "@/lib/utils";

interface CategoryHeaderProps {
  slug: string;
  /** Total de resultados da listagem atual (com filtros); sem ele usa a contagem da categoria. */
  resultCount?: number;
  className?: string;
}

/**
 * Nome da categoria (19 px no mobile, 28 px no desktop) + contagem de resultados.
 * Renderizado pela SearchView dentro da barra fixa do topo (mobile) e como título (desktop).
 */
export function CategoryHeader({ slug, resultCount, className }: CategoryHeaderProps) {
  const t = useTranslations("catalog");
  const { data, isPending, isError, error, refetch } = useCategory(slug);

  if (isError) {
    return (
      <ErrorState
        error={error}
        onRetry={() => refetch()}
        compact
        className={cn("flex-1", className)}
      />
    );
  }

  if (isPending) {
    return (
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5", className)}>
        <Skeleton className="h-5 w-36 rounded-md md:h-7 md:w-52" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
    );
  }

  const count = resultCount ?? data.productCount;
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col leading-[1.2]", className)}>
      <h1 className="truncate text-[19px] font-extrabold tracking-tight md:text-[28px] md:tracking-[-0.03em]">
        {data.name}
      </h1>
      <p className="text-xs text-muted-foreground md:text-[13.5px]">
        {t("resultsCount", { count })}
      </p>
    </div>
  );
}
