"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useFavoritesStore } from "@/features/catalog/favorites-store";
import { Link } from "@/i18n/navigation";

const GRID = "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

/**
 * Favoritos salvos localmente (snapshot do produto) — funciona offline.
 * O título vem do Header (StoreShell `title`) no mobile e aparece como h1 no desktop.
 */
export function FavoritesView() {
  const t = useTranslations("catalog");
  const items = useFavoritesStore((s) => s.items);
  // Evita mismatch de hidratação: no servidor "false"; no cliente reflete o persist do Zustand.
  const hydrated = useSyncExternalStore(
    (cb) => useFavoritesStore.persist.onFinishHydration(cb),
    () => useFavoritesStore.persist.hasHydrated(),
    () => false,
  );

  return (
    <PageContainer className="flex flex-col gap-4 pt-4 md:pt-8">
      <h1 className="hidden text-title-1 text-foreground md:block">{t("favoritesTitle")}</h1>

      {!hydrated ? (
        <div className={GRID} aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          illustration="heart"
          title={t("favoritesEmptyTitle")}
          description={t("favoritesEmptyDescription")}
          action={
            <Button variant="primary" render={<Link href="/busca" />}>
              {t("exploreProducts")}
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-body-sm text-foreground-secondary tabular-nums">
            {t("favoritesCount", { count: items.length })}
          </p>
          <ul className={GRID}>
            {items.map((f) => (
              <li key={f.productId}>
                <ProductCard product={f.snapshot} />
              </li>
            ))}
          </ul>
        </>
      )}
    </PageContainer>
  );
}
