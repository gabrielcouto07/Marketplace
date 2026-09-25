"use client";

import type {
  BannerDto,
  CategoryDto,
  ProductSummaryDto,
  SellerSummaryDto,
} from "@marketplace/contracts";
import {
  ChevronRight,
  CreditCard,
  Package,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Truck,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type CSSProperties, type ReactNode } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { CategoryTile } from "@/components/shared/category-tile";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { SellerBadge } from "@/components/shared/seller-badge";
import { ErrorState, HorizontalScroller, SectionHeader } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useHome } from "@/features/catalog/api";
import { formatCountdown, useCountdown } from "@/hooks/use-countdown";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { HomeHero } from "./home-hero";

const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 40}ms` });

/** Seção da home com container e entrada escalonada. */
function Block({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className="animate-rise" style={rise(index)}>
      <PageContainer>{children}</PageContainer>
    </div>
  );
}

export function HomeView() {
  const t = useTranslations("home");
  const { data, isPending, isError, error, refetch } = useHome();

  if (isError) {
    return (
      <>
        <HomeHero />
        <PageContainer className="pt-6">
          <ErrorState error={error} onRetry={() => refetch()} />
        </PageContainer>
      </>
    );
  }

  return (
    <div className="flex flex-col">
      <HomeHero />

      <div className="relative -mt-12 flex flex-col gap-[26px] md:mt-0 md:gap-8 md:pt-6">
        {/* Promoções */}
        <section aria-label={t("promoLabel")} className="animate-rise" style={rise(0)}>
          {isPending ? (
            <PageContainer>
              <div className="flex gap-2.5">
                <Skeleton className="h-[172px] flex-none [flex-basis:calc(100%-28px)] rounded-3xl lg:flex-1" />
                <Skeleton className="hidden h-[172px] rounded-3xl lg:block lg:flex-1" />
                <Skeleton className="hidden h-[172px] rounded-3xl lg:block lg:flex-1" />
              </div>
            </PageContainer>
          ) : (
            <PromoCarousel banners={data.banners} />
          )}
        </section>

        {/* Selos de confiança */}
        <div className="-mt-3 animate-rise" style={rise(1)}>
          <TrustChips />
        </div>

        {/* Categorias */}
        <Block index={2}>
          <SectionHeader title={t("categories")} action={<SeeAllLink href="/categorias" />} />
          {isPending ? (
            <div className="grid grid-cols-4 gap-x-2 gap-y-3.5 sm:grid-cols-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-[7px]">
                  <Skeleton className="size-16 rounded-[22px]" />
                  <Skeleton className="h-3 w-12 rounded-md" />
                </div>
              ))}
            </div>
          ) : (
            <CategoryGrid categories={data.categories} />
          )}
        </Block>

        {/* Ofertas do dia */}
        <Block index={3}>
          <SectionHeader
            title={t("offers")}
            icon={Zap}
            iconTone="red"
            meta={isPending ? <Skeleton className="h-6 w-16 rounded-[8px]" /> : <DealsCountdown />}
            action={<SeeAllLink href="/busca?onlyOffers=true" />}
          />
          <ProductRail products={data?.offers} loading={isPending} />
        </Block>

        {/* Novidades */}
        <Block index={4}>
          <SectionHeader
            title={t("newArrivals")}
            action={<SeeAllLink href="/busca?sort=newest" />}
          />
          <ProductRail products={data?.newArrivals} loading={isPending} />
        </Block>

        {/* Lojas em destaque */}
        <Block index={5}>
          <SectionHeader title={t("featuredSellers")} />
          <HorizontalScroller className="gap-2.5">
            {isPending
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[122px] w-[250px] shrink-0 rounded-2xl" />
                ))
              : data.featuredSellers.map((s) => <SellerRailItem key={s.id} seller={s} />)}
          </HorizontalScroller>
        </Block>

        {/* Mais vendidos */}
        <Block index={6}>
          <SectionHeader
            title={t("bestSellers")}
            action={<SeeAllLink href="/busca?sort=bestSelling" />}
          />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {isPending
              ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : data.bestSellers.map((p, i) => (
                  <div key={p.id} className="animate-rise" style={rise(i)}>
                    <ProductCard product={p} />
                  </div>
                ))}
          </div>
        </Block>
      </div>
    </div>
  );
}

function SeeAllLink({ href }: { href: string }) {
  const t = useTranslations("common");
  return (
    <Link
      href={href}
      className="flex shrink-0 items-center gap-0.5 rounded-md py-2 text-[13px] font-bold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {t("seeAll")} <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

/* ----------------------------- Promoções ----------------------------- */

interface ToneStyle {
  card: string;
  kicker: string;
  circle: string;
  circleClass: string;
  icon: string;
  pill: string;
}

const TONES: Record<BannerDto["tone"], ToneStyle> = {
  red: {
    card: "bg-cta text-cta-foreground shadow-cta",
    kicker: "text-white/90",
    circle: "bg-[#E4493D]",
    circleClass: "-right-10 -bottom-[60px] size-[190px]",
    icon: "bg-card text-cta rotate-12",
    pill: "bg-card text-destructive",
  },
  blue: {
    card: "bg-ink text-ink-foreground",
    kicker: "text-[#AFC4F0]",
    circle: "bg-primary",
    circleClass: "-top-[30px] -right-[30px] size-[170px]",
    icon: "bg-card text-primary -rotate-[10deg]",
    pill: "bg-card text-ink",
  },
  neutral: {
    card: "bg-card text-foreground shadow-card",
    kicker: "text-[#0B7A68]",
    circle: "bg-[#E6F4F1]",
    circleClass: "-right-10 -bottom-[50px] size-[180px]",
    icon: "bg-[#12A08A] text-white rotate-45",
    pill: "bg-ink text-ink-foreground",
  },
};

const TONE_ICONS: Record<BannerDto["tone"], typeof Truck> = {
  red: Truck,
  blue: Smartphone,
  neutral: Sparkles,
};

function PromoCarousel({ banners }: { banners: BannerDto[] }) {
  const t = useTranslations("home");
  return (
    <ul className="mx-auto scrollbar-none flex w-full max-w-6xl snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible">
      {banners.map((b, i) => {
        const tone = TONES[b.tone];
        const Icon = TONE_ICONS[b.tone];
        return (
          <li
            key={b.id}
            className="flex-none [flex-basis:calc(100%-28px)] snap-start sm:[flex-basis:calc(60%-14px)] lg:flex-auto lg:[flex-basis:auto]"
          >
            <Link
              href={b.href}
              className={cn(
                "relative flex h-[172px] pressable flex-col justify-between overflow-hidden rounded-3xl p-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                tone.card,
              )}
            >
              <span
                aria-hidden
                className={cn("absolute rounded-full", tone.circle, tone.circleClass)}
              />
              <span
                aria-hidden
                className={cn(
                  "absolute top-[22px] right-[30px] flex size-[58px] items-center justify-center rounded-[18px]",
                  tone.icon,
                )}
              >
                <Icon className="size-7" strokeWidth={2} />
              </span>
              <span className="relative flex max-w-[72%] flex-col gap-1.5">
                <span
                  className={cn(
                    "text-[11px] font-extrabold tracking-[0.1em] uppercase",
                    tone.kicker,
                  )}
                >
                  {b.title}
                </span>
                <span className="text-[21px] leading-[1.1] font-extrabold tracking-tight text-balance">
                  {b.subtitle}
                </span>
              </span>
              <span
                className={cn(
                  "relative self-start rounded-full px-3.5 py-2 text-[13px] font-extrabold whitespace-nowrap",
                  tone.pill,
                )}
              >
                {i === 0 ? t("seeOffers") : t("bannerCta")}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------ Confiança ----------------------------- */

function TrustChips() {
  const t = useTranslations("home");
  const items = [
    { icon: Package, label: t("trustShipping") },
    { icon: ShieldCheck, label: t("trustTax") },
    { icon: Store, label: t("trustSellers") },
    { icon: CreditCard, label: t("trustPayment") },
  ];
  return (
    <ul className="mx-auto scrollbar-none flex w-full max-w-6xl gap-2 overflow-x-auto px-4 sm:grid sm:grid-cols-4">
      {items.map(({ icon: Icon, label }, i) => (
        <li
          key={label}
          className="flex flex-none animate-rise items-center gap-2 rounded-lg bg-card px-3 py-2.5 text-[12.5px] font-semibold text-foreground shadow-card sm:flex-1"
          style={rise(i)}
        >
          <Icon className="size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
          <span className="whitespace-nowrap sm:whitespace-normal">{label}</span>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------- Categorias ----------------------------- */

function CategoryGrid({ categories }: { categories: CategoryDto[] }) {
  return (
    <ul className="grid grid-cols-4 gap-x-2 gap-y-3.5 sm:grid-cols-8">
      {categories.slice(0, 8).map((c, i) => (
        <li key={c.id} className="animate-rise" style={rise(i)}>
          <CategoryTile category={c} variant="icon" />
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------- Ofertas ------------------------------ */

function nextMidnightIso(): string {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
}

/** Chip escuro com contagem regressiva até a meia-noite local (só no cliente, após os dados). */
function DealsCountdown() {
  const t = useTranslations("home");
  const [untilIso] = useState(nextMidnightIso);
  const seconds = useCountdown(untilIso);
  const hours = Math.floor(seconds / 3600);
  const time = `${String(hours).padStart(2, "0")}:${formatCountdown(seconds % 3600)}`;
  return (
    <span
      className="shrink-0 rounded-[8px] bg-ink px-2 py-1 text-xs font-bold text-ink-foreground tabular-nums"
      aria-label={t("dealsEndIn", { time })}
      role="timer"
    >
      {time}
    </span>
  );
}

function ProductRail({ products, loading }: { products?: ProductSummaryDto[]; loading: boolean }) {
  return (
    <HorizontalScroller className="gap-2.5">
      {loading
        ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} layout="row" />)
        : products?.map((p, i) => (
            <div key={p.id} className="shrink-0 animate-rise" style={rise(i)}>
              <ProductCard product={p} layout="row" />
            </div>
          ))}
    </HorizontalScroller>
  );
}

/* -------------------------------- Lojas ------------------------------- */

function SellerRailItem({ seller }: { seller: SellerSummaryDto }) {
  return (
    <div className="w-[250px] shrink-0">
      <SellerBadge seller={seller} variant="card" />
    </div>
  );
}
