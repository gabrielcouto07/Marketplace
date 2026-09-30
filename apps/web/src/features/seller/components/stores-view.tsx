"use client";

import type { SellerSummaryDto } from "@marketplace/contracts";
import { ArrowUpDown, BadgeCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { SellerBadge, SellerCardSkeleton } from "@/components/shared/seller-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FilterChip } from "@/features/catalog/components/filters-panel";
import { useSellers } from "@/features/seller/api";
import { usePathname, useRouter } from "@/i18n/navigation";

const STORE_SORTS = ["featured", "reputation", "name"] as const;
type StoreSort = (typeof STORE_SORTS)[number];

/**
 * - `featured`: lojas oficiais primeiro, depois a melhor reputação (a ordem da vitrine);
 * - `reputation`: nível de reputação, do verde ao vermelho;
 * - `name`: alfabética no idioma da página.
 * Empates sempre caem para o nome, para a ordem ser estável entre renders.
 */
function sortSellers(sellers: SellerSummaryDto[], sort: StoreSort, locale: string) {
  const byName = (a: SellerSummaryDto, b: SellerSummaryDto) => a.name.localeCompare(b.name, locale);
  const byReputation = (a: SellerSummaryDto, b: SellerSummaryDto) =>
    b.reputationLevel - a.reputationLevel || byName(a, b);
  const compare =
    sort === "name"
      ? byName
      : sort === "reputation"
        ? byReputation
        : (a: SellerSummaryDto, b: SellerSummaryDto) =>
            Number(b.isOfficialStore) - Number(a.isOfficialStore) || byReputation(a, b);
  return [...sellers].sort(compare);
}

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

/**
 * Página de lojas (/lojas): todas as lojas verificadas em cards de confiança, com ordenação e o
 * filtro "Lojas oficiais". Ordenação e filtro ficam na URL (?sort=reputation&official=true), como na
 * busca, para o link ser compartilhável. O título vem do Header no mobile e vira h1 no desktop.
 * Precisa estar dentro de <Suspense> (usa useSearchParams).
 */
export function StoresView() {
  const t = useTranslations("seller");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isPending, isError, error, refetch } = useSellers();

  const sortParam = searchParams.get("sort");
  const sort = STORE_SORTS.find((s) => s === sortParam) ?? "featured";
  const onlyOfficial = searchParams.get("official") === "true";

  const navigate = (next: { sort: StoreSort; official: boolean }) => {
    const p = new URLSearchParams();
    if (next.sort !== "featured") p.set("sort", next.sort);
    if (next.official) p.set("official", "true");
    const qs = p.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const stores = useMemo(() => {
    const visible = onlyOfficial ? (data ?? []).filter((s) => s.isOfficialStore) : (data ?? []);
    return sortSellers(visible, sort, locale);
  }, [data, onlyOfficial, sort, locale]);

  const sortItems = useMemo(
    () => Object.fromEntries(STORE_SORTS.map((s) => [s, t(`storesSort.${s}`)])),
    [t],
  );

  return (
    <PageContainer className="flex flex-col gap-4 pt-4 md:pt-8">
      <div className="flex flex-col gap-1">
        <h1 className="hidden text-title-1 text-foreground md:block">{t("storesTitle")}</h1>
        {isPending ? (
          <Skeleton className="h-5 w-56" />
        ) : (
          <p className="text-body-sm text-foreground-secondary tabular-nums">
            {t("storesSubtitle", { count: data?.length ?? 0 })}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <FilterChip
          active={onlyOfficial}
          onClick={() => navigate({ sort, official: !onlyOfficial })}
        >
          <BadgeCheck className="size-4" strokeWidth={1.75} aria-hidden />
          {t("onlyOfficial")}
        </FilterChip>
        <Select
          value={sort}
          onValueChange={(value) => {
            const next = STORE_SORTS.find((s) => s === value);
            if (next) navigate({ sort: next, official: onlyOfficial });
          }}
          items={sortItems}
        >
          <SelectTrigger size="sm" aria-label={t("storesSortLabel")} className="ml-auto shrink-0">
            <ArrowUpDown className="text-foreground-secondary" strokeWidth={1.75} aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end" alignItemWithTrigger={false}>
            {STORE_SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {sortItems[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isPending ? (
        <ul className={GRID} aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <SellerCardSkeleton />
            </li>
          ))}
        </ul>
      ) : stores.length === 0 ? (
        <EmptyState
          illustration="search"
          title={t("noOfficialStores")}
          description={t("noOfficialStoresHint")}
          action={
            <Button variant="secondary" onClick={() => navigate({ sort, official: false })}>
              {t("showAllStores")}
            </Button>
          }
        />
      ) : (
        <ul className={GRID}>
          {stores.map((s) => (
            <li key={s.id}>
              <SellerBadge seller={s} variant="card" className="h-full" />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
