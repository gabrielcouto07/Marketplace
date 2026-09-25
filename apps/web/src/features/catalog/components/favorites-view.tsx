"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useFavoritesStore } from "@/features/catalog/favorites-store";
import { Link } from "@/i18n/navigation";

/** Lista os favoritos salvos localmente (snapshot do produto) — funciona offline. */
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
    <PageContainer className="pt-4">
      <h1 className="mb-4 text-xl font-bold tracking-tight">
        {t("favoritesTitle")}
        {hydrated && items.length > 0 ? <span className="ml-2 text-base font-normal text-muted-foreground">({items.length})</span> : null}
      </h1>
      {!hydrated ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("favoritesEmptyTitle")}
          description={t("favoritesEmptyDescription")}
          className="min-h-[50vh]"
          action={
            <Button variant="cta" render={<Link href="/busca" />}>
              {t("exploreProducts")}
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((f) => (
            <li key={f.productId}>
              <ProductCard product={f.snapshot} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
