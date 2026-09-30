"use client";

import type { CategoryDto, ProductSummaryDto, SellerSummaryDto } from "@marketplace/contracts";
import { ChevronRight, CreditCard, Package, ShieldCheck, Store, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { CategoryTile } from "@/components/shared/category-tile";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { SellerBadge, SellerCardSkeleton } from "@/components/shared/seller-badge";
import { ErrorState, HorizontalScroller, SectionHeader } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useHome } from "@/features/catalog/api";
import { formatCountdown, useCountdown } from "@/hooks/use-countdown";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { HomeHero } from "./home-hero";
import { PromoCarousel, PromoCarouselSkeleton } from "./promo-carousel";

/**
 * Home: cartão Céu de saudação, banners, chips de confiança nas quatro cores da marca, categorias
 * tintadas, rails de ofertas/novidades/lojas e grade de mais vendidos. Seções a 32 px uma da outra.
 */
export function HomeView() {
  const t = useTranslations("home");
  const { data, isPending, isError, error, refetch } = useHome();

  if (isError) {
    return (
      <>
        <HomeHero />
        <PageContainer className="py-8">
          <ErrorState error={error} onRetry={() => refetch()} />
        </PageContainer>
      </>
    );
  }

  return (
    <div className="flex flex-col">
      <HomeHero />

      <div className="flex flex-col gap-8 py-6">
        <section aria-label={t("promoLabel")}>
          {isPending ? <PromoCarouselSkeleton /> : <PromoCarousel banners={data.banners} />}
        </section>

        <TrustChips />

        <PageContainer>
          <SectionHeader title={t("categories")} action={<SeeAllLink href="/categorias" />} />
          {isPending ? <CategoryGridSkeleton /> : <CategoryGrid categories={data.categories} />}
        </PageContainer>

        <PageContainer>
          <SectionHeader
            title={t("offers")}
            icon={Zap}
            meta={isPending ? <Skeleton className="h-6 w-16 rounded-sm" /> : <DealsCountdown />}
            action={<SeeAllLink href="/busca?onlyOffers=true" />}
          />
          <ProductRail products={data?.offers} loading={isPending} />
        </PageContainer>

        <PageContainer>
          <SectionHeader
            title={t("newArrivals")}
            action={<SeeAllLink href="/busca?sort=newest" />}
          />
          <ProductRail products={data?.newArrivals} loading={isPending} />
        </PageContainer>

        <PageContainer>
          <SectionHeader title={t("featuredSellers")} action={<SeeAllLink href="/lojas" />} />
          <HorizontalScroller>
            {isPending
              ? Array.from({ length: 3 }).map((_, i) => (
                  <SellerCardSkeleton key={i} className="w-[260px] shrink-0" />
                ))
              : data.featuredSellers.map((s) => <SellerRailItem key={s.id} seller={s} />)}
          </HorizontalScroller>
        </PageContainer>

        <PageContainer>
          <SectionHeader
            title={t("bestSellers")}
            action={<SeeAllLink href="/busca?sort=bestSelling" />}
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {isPending
              ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : data.bestSellers.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </PageContainer>
      </div>
    </div>
  );
}

function SeeAllLink({ href }: { href: string }) {
  const t = useTranslations("common");
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-1 rounded-sm py-2 text-body-sm font-semibold text-primary focus-ring hover:underline"
    >
      {t("seeAll")}
      <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}

/* ------------------------------ Confiança ----------------------------- */

/**
 * Linha rolável de chips com os diferenciais de confiança (rastreio, impostos, lojas, pagamento).
 * Cada ícone vive num círculo pastel de uma das cores da marca, como os atalhos do header.
 */
function TrustChips() {
  const t = useTranslations("home");
  const items = [
    { icon: Package, label: t("trustShipping"), tone: "bg-brand-menta-soft" },
    { icon: ShieldCheck, label: t("trustTax"), tone: "bg-brand-lilas" },
    { icon: Store, label: t("trustSellers"), tone: "bg-brand-coral-soft" },
    { icon: CreditCard, label: t("trustPayment"), tone: "bg-brand-manteiga-soft" },
  ];
  return (
    <ul className="mx-auto scrollbar-none flex w-full max-w-6xl gap-2 overflow-x-auto px-4">
      {items.map(({ icon: Icon, label, tone }) => (
        <li
          key={label}
          className="flex h-10 flex-none items-center gap-2 rounded-full border border-border bg-surface pr-4 pl-1.5 text-caption font-semibold whitespace-nowrap text-foreground"
        >
          <span
            aria-hidden
            className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", tone)}
          >
            <Icon className="size-4" strokeWidth={2} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------- Categorias ----------------------------- */

const CATEGORY_GRID = "grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-8";

function CategoryGrid({ categories }: { categories: CategoryDto[] }) {
  return (
    <ul className={CATEGORY_GRID}>
      {categories.slice(0, 8).map((c) => (
        <li key={c.id}>
          <CategoryTile category={c} variant="icon" />
        </li>
      ))}
    </ul>
  );
}

function CategoryGridSkeleton() {
  return (
    <div className={CATEGORY_GRID}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <Skeleton className="size-16 rounded-lg" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Ofertas ------------------------------ */

function nextMidnightIso(): string {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
}

/** Chip com contagem regressiva até a meia-noite local (só no cliente, após os dados). */
function DealsCountdown() {
  const t = useTranslations("home");
  const [untilIso] = useState(nextMidnightIso);
  const seconds = useCountdown(untilIso);
  const hours = Math.floor(seconds / 3600);
  const time = `${String(hours).padStart(2, "0")}:${formatCountdown(seconds % 3600)}`;
  return (
    <span
      className="inline-flex h-6 shrink-0 items-center rounded-sm bg-brand-manteiga-soft px-2 text-caption font-semibold text-foreground tabular-nums"
      aria-label={t("dealsEndIn", { time })}
      role="timer"
    >
      {time}
    </span>
  );
}

function ProductRail({ products, loading }: { products?: ProductSummaryDto[]; loading: boolean }) {
  return (
    <HorizontalScroller>
      {loading
        ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} layout="row" />)
        : products?.map((p) => <ProductCard key={p.id} product={p} layout="row" />)}
    </HorizontalScroller>
  );
}

/* -------------------------------- Lojas ------------------------------- */

function SellerRailItem({ seller }: { seller: SellerSummaryDto }) {
  return (
    <div className="w-[260px] shrink-0">
      <SellerBadge seller={seller} variant="card" />
    </div>
  );
}
