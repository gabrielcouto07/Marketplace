"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { BackButton } from "@/components/shared/back-button";
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
    <PageContainer className="flex flex-col gap-3.5 pt-3 md:pt-6">
      <div className="flex items-center gap-2.5">
        <BackButton className="md:hidden" />
        <h1 className="flex-1 text-2xl font-extrabold tracking-[-0.03em] md:text-[28px]">
          {t("favoritesTitle")}
        </h1>
        {hydrated && items.length > 0 ? (
          <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
            {t("favoritesCount", { count: items.length })}
          </span>
        ) : null}
      </div>

      {!hydrated ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          tone="red"
          title={t("favoritesEmptyTitle")}
          description={t("favoritesEmptyDescription")}
          className="animate-rise"
          action={
            <Button render={<Link href="/busca" />} className="px-[22px]">
              {t("viewProducts")}
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((f, i) => (
            <li
              key={f.productId}
              className="animate-rise"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <ProductCard product={f.snapshot} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
