"use client";

import type { CategoryDto, ProductSummaryDto, SellerSummaryDto } from "@marketplace/contracts";
import {
  ArrowRight,
  ChevronRight,
  CreditCard,
  Package,
  ShieldCheck,
  Store,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { CategoryIcon } from "@/components/shared/category-icon";
import { CategoryTile } from "@/components/shared/category-tile";
import { FlagBR, FlagPY } from "@/components/shared/flags";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { SellerBadge, SellerCardSkeleton } from "@/components/shared/seller-badge";
import { ErrorState, HorizontalScroller, SectionHeader } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useHome } from "@/features/catalog/api";
import { formatCountdown, useCountdown } from "@/hooks/use-countdown";
import { Link } from "@/i18n/navigation";
import { blurDataUrlFor, isDirectImage } from "@/lib/images";
import { discountPercent, formatMoney } from "@/lib/money";
import { categoryHue, hueStyle } from "@/lib/palette";
import { cn } from "@/lib/utils";

import { HomeHero, HomeHeroSkeleton } from "./home-hero";

/** Seção em caixa branca sobre o fundo cinza; no mobile ocupa a largura toda (sem raio). */
const BOX = "-mx-4 bg-surface p-4 shadow-xs sm:mx-0 sm:rounded-lg";

/** Card de produto dentro de uma caixa: sem borda nem sombra (nada de card dentro de card). */
const IN_BOX_CARD = "border-transparent shadow-none hover:shadow-none";

/**
 * Home em padrão de loja: hero em carrossel de ponta a ponta, quatro "quad cards" (ofertas,
 * departamentos, mais vendidos, novidades) subindo sobre ele, a faixa de confiança com as cores
 * da marca chapadas, vitrines em caixas brancas e a grade de mais vendidos.
 */
export function HomeView() {
  const t = useTranslations("home");
  const { data, isPending, isError, error, refetch } = useHome();

  if (isError) {
    return (
      <PageContainer className="py-8">
        <ErrorState error={error} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  return (
    <div className="flex flex-col">
      {isPending ? <HomeHeroSkeleton /> : <HomeHero banners={data.banners} />}

      <PageContainer className="relative z-10 -mt-8 md:-mt-36 lg:-mt-44">
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {isPending ? (
            Array.from({ length: 4 }).map((_, i) => <QuadCardSkeleton key={i} />)
          ) : (
            <>
              <QuadCard
                title={t("offers")}
                href="/busca?onlyOffers=true"
                cta={t("quadOffersCta")}
                items={data.offers
                  .slice(0, 4)
                  .map((p) => productItem(p, <DealLabel product={p} />))}
              />
              <QuadCard
                title={t("quadCategoriesTitle")}
                href="/categorias"
                cta={t("quadCategoriesCta")}
                items={data.categories.slice(0, 4).map(categoryItem)}
              />
              <QuadCard
                title={t("bestSellers")}
                href="/busca?sort=bestSelling"
                cta={t("quadBestSellersCta")}
                items={data.bestSellers
                  .slice(0, 4)
                  .map((p) =>
                    productItem(p, <span className="tabular-nums">{formatMoney(p.price)}</span>),
                  )}
              />
              <QuadCard
                title={t("newArrivals")}
                href="/busca?sort=newest"
                cta={t("quadNewArrivalsCta")}
                items={data.newArrivals.slice(0, 4).map((p) => productItem(p, p.name))}
              />
            </>
          )}
        </div>
      </PageContainer>

      <PageContainer className="flex flex-col gap-4 pt-4 md:gap-6 md:pt-6">
        <TrustBand />

        <section className={BOX}>
          <SectionHeader
            title={t("offers")}
            icon={Zap}
            meta={isPending ? <Skeleton className="h-6 w-16 rounded-sm" /> : <DealsCountdown />}
            action={<SeeAllLink href="/busca?onlyOffers=true" />}
          />
          <ProductRail products={data?.offers} loading={isPending} />
        </section>

        <section className={BOX}>
          <SectionHeader title={t("categories")} action={<SeeAllLink href="/categorias" />} />
          {isPending ? <CategoryGridSkeleton /> : <CategoryGrid categories={data.categories} />}
        </section>

        <section className={BOX}>
          <SectionHeader
            title={t("newArrivals")}
            action={<SeeAllLink href="/busca?sort=newest" />}
          />
          <ProductRail products={data?.newArrivals} loading={isPending} />
        </section>

        {/* Os cards de loja já têm moldura própria: ficam direto no fundo, como a grade abaixo. */}
        <section>
          <SectionHeader title={t("featuredSellers")} action={<SeeAllLink href="/lojas" />} />
          <HorizontalScroller>
            {isPending
              ? Array.from({ length: 3 }).map((_, i) => (
                  <SellerCardSkeleton key={i} className="w-[260px] shrink-0" />
                ))
              : data.featuredSellers.map((s) => <SellerRailItem key={s.id} seller={s} />)}
          </HorizontalScroller>
        </section>

        <section>
          <SectionHeader
            title={t("bestSellers")}
            action={<SeeAllLink href="/busca?sort=bestSelling" />}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
            {isPending
              ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : data.bestSellers.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      </PageContainer>
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

/* ----------------------------- Quad cards ----------------------------- */

interface QuadItem {
  key: string;
  href: string;
  image: string | null;
  /** Fotos de produto são quadradas (contain); capas de departamento preenchem (cover). */
  fit: "contain" | "cover";
  label: ReactNode;
  /** Sem foto: ícone do departamento sobre a tinta da categoria. */
  fallback?: ReactNode;
}

function productItem(p: ProductSummaryDto, label: ReactNode): QuadItem {
  return {
    key: p.id,
    href: `/produto/${p.slug}`,
    image: p.thumbnailUrl,
    fit: "contain",
    label,
  };
}

function categoryItem(c: CategoryDto): QuadItem {
  return {
    key: c.id,
    href: `/categoria/${c.slug}`,
    image: c.imageUrl,
    fit: "cover",
    label: c.name,
    fallback: (
      <span
        style={hueStyle(categoryHue(c.slug))}
        className="flex size-full items-center justify-center tint-bg tint-fg"
      >
        <CategoryIcon iconKey={c.iconKey} className="size-6" />
      </span>
    ),
  };
}

/** "-25%" chapado em Vermelho + "Oferta" em texto de oferta, como nas vitrines de loja. */
function DealLabel({ product }: { product: ProductSummaryDto }) {
  const t = useTranslations("catalog");
  const discount = discountPercent(product.price, product.compareAtPrice ?? null);
  return (
    <span className="flex min-w-0 items-center gap-1">
      {discount > 0 ? (
        <span className="shrink-0 rounded-sm bg-deal px-1 font-semibold text-deal-foreground tabular-nums">
          -{discount}%
        </span>
      ) : null}
      {/* Nas colunas estreitas do mobile o selo "-25%" basta; a palavra entra a partir de sm. */}
      <span className="hidden truncate font-semibold text-deal sm:inline">{t("dealBadge")}</span>
    </span>
  );
}

/** Card com título, grade 2×2 de atalhos com foto e o link "Ver …" no rodapé. */
function QuadCard({
  title,
  href,
  cta,
  items,
}: {
  title: string;
  href: string;
  cta: string;
  items: QuadItem[];
}) {
  return (
    <section className="flex flex-col rounded-lg bg-surface p-3 shadow-sm md:p-4">
      <h2 className="line-clamp-2 min-h-12 text-body leading-6 font-bold text-foreground md:min-h-0 md:text-title-3 md:font-bold">
        {title}
      </h2>
      <ul className="mt-2 grid grid-cols-2 gap-x-2 gap-y-3 md:mt-3 md:gap-x-3">
        {items.map((it) => (
          <li key={it.key} className="min-w-0">
            <Link href={it.href} className="group flex flex-col gap-1 rounded-sm focus-ring">
              <span className="relative aspect-square overflow-hidden rounded-sm bg-surface-muted">
                {it.image ? (
                  <Image
                    src={it.image}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 25vw, 140px"
                    placeholder="blur"
                    blurDataURL={blurDataUrlFor(it.image)}
                    unoptimized={isDirectImage(it.image)}
                    className={cn(
                      "transition-transform duration-300 ease-standard group-hover:scale-[1.04]",
                      it.fit === "cover" ? "object-cover" : "object-contain",
                    )}
                  />
                ) : (
                  it.fallback
                )}
              </span>
              <span className="line-clamp-1 text-caption text-foreground group-hover:underline">
                {it.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="mt-auto self-start rounded-sm pt-3 text-body-sm font-semibold text-pretty text-primary focus-ring hover:underline"
      >
        {cta}
        <ArrowRight className="ml-1 inline size-4 align-[-3px]" strokeWidth={2} aria-hidden />
      </Link>
    </section>
  );
}

function QuadCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 rounded-lg bg-surface p-3 shadow-sm md:p-4">
      <Skeleton className="h-5 w-3/4" />
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-sm" />
        ))}
      </div>
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/* ------------------------------ Confiança ----------------------------- */

/**
 * Faixa com os diferenciais (rastreio, impostos, lojas, pagamento) e a rota PY → BR. Cada ícone
 * vive num círculo chapado de uma das cores da marca: branco sobre Azul/Vermelho, Tinta sobre
 * Verde/Amarelo (todos ≥ 3:1 para ícone).
 */
function TrustBand() {
  const t = useTranslations("home");
  const items = [
    { icon: Package, label: t("trustShipping"), tone: "bg-brand-azul text-white" },
    { icon: ShieldCheck, label: t("trustTax"), tone: "bg-brand-verde text-on-bright" },
    { icon: Store, label: t("trustSellers"), tone: "bg-brand-vermelho text-white" },
    { icon: CreditCard, label: t("trustPayment"), tone: "bg-brand-amarelo text-on-bright" },
  ];
  return (
    <section aria-label={t("trustLabel")} className={cn(BOX, "flex flex-col gap-4")}>
      <p className="flex items-center gap-2 text-body-sm font-bold text-foreground">
        <FlagPY className="rounded-[3px]" />
        <ArrowRight className="size-3.5" strokeWidth={2.5} aria-hidden />
        <FlagBR className="rounded-[3px]" />
        {t("routeBadge")}
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, label, tone }) => (
          <li
            key={label}
            className="flex items-center gap-3 text-body-sm font-semibold text-foreground"
          >
            <span
              aria-hidden
              className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", tone)}
            >
              <Icon className="size-5" strokeWidth={2} />
            </span>
            {label}
          </li>
        ))}
      </ul>
    </section>
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

/** Chip Vermelho com contagem regressiva até a meia-noite local (só no cliente, após os dados). */
function DealsCountdown() {
  const t = useTranslations("home");
  const [untilIso] = useState(nextMidnightIso);
  const seconds = useCountdown(untilIso);
  const hours = Math.floor(seconds / 3600);
  const time = `${String(hours).padStart(2, "0")}:${formatCountdown(seconds % 3600)}`;
  return (
    <span
      className="inline-flex h-6 shrink-0 items-center rounded-sm bg-deal px-2 text-caption font-semibold text-deal-foreground tabular-nums"
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
        : products?.map((p) => (
            <ProductCard key={p.id} product={p} layout="row" className={IN_BOX_CARD} />
          ))}
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
