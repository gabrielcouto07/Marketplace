"use client";

import type { CategoryDto, ProductSummaryDto, SellerSummaryDto } from "@marketplace/contracts";
import {
  ArrowRight,
  ChevronRight,
  CreditCard,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { CategoryIcon } from "@/components/shared/category-icon";
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

/** Seção em caixa sobre o fundo cinza; no mobile ocupa a largura toda (sem raio). */
const BOX = "-mx-4 p-4 shadow-xs sm:mx-0 sm:rounded-lg";

/** Atraso da entrada (animate-rise) de cada quad card, em sequência da esquerda para a direita. */
const QUAD_DELAYS = [
  "",
  "[animation-delay:80ms]",
  "[animation-delay:160ms]",
  "[animation-delay:240ms]",
];

/**
 * Home em padrão de loja, viva e colorida: hero em carrossel automático, quatro quad cards em cores
 * chapadas da marca subindo sobre ele, a faixa de confiança correndo, as ofertas do dia numa caixa
 * Vermelha, os departamentos em tiles coloridos com fotos flutuando, a vitrine Roxa de novidades,
 * lojas e a grade de mais vendidos. Toda animação some com prefers-reduced-motion.
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
                tone="deal"
                delay={QUAD_DELAYS[0]}
                title={t("offers")}
                href="/busca?onlyOffers=true"
                cta={t("quadOffersCta")}
                items={data.offers
                  .slice(0, 4)
                  .map((p) => productItem(p, <DealLabel product={p} />))}
              />
              <QuadCard
                tone="primary"
                delay={QUAD_DELAYS[1]}
                title={t("quadCategoriesTitle")}
                shortTitle={t("quadCategoriesTitleShort")}
                href="/categorias"
                cta={t("quadCategoriesCta")}
                items={data.categories.slice(0, 4).map(categoryItem)}
              />
              <QuadCard
                tone="cta"
                delay={QUAD_DELAYS[2]}
                title={t("bestSellers")}
                href="/busca?sort=bestSelling"
                cta={t("quadBestSellersCta")}
                items={data.bestSellers
                  .slice(0, 4)
                  .map((p) =>
                    productItem(
                      p,
                      <span className="font-semibold tabular-nums">{formatMoney(p.price)}</span>,
                    ),
                  )}
              />
              <QuadCard
                tone="verde"
                delay={QUAD_DELAYS[3]}
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
        <TrustMarquee />

        {/* Ofertas do dia numa caixa Vermelha: raio piscando, contagem com reflexo, cards brancos. */}
        <section aria-labelledby="home-offers" className={cn(BOX, "bg-deal text-deal-foreground")}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Zap
                className="size-6 shrink-0 animate-flash fill-realce text-realce"
                strokeWidth={1.75}
                aria-hidden
              />
              <h2 id="home-offers" className="truncate text-title-2 font-bold">
                {t("offers")}
              </h2>
              {isPending ? <Skeleton className="h-6 w-16 rounded-sm" /> : <DealsCountdown />}
            </div>
            <SeeAllLink href="/busca?onlyOffers=true" inverse />
          </div>
          <HorizontalScroller>
            {isPending
              ? Array.from({ length: 4 }).map((_, i) => (
                  <ProductCardSkeleton key={i} layout="row" />
                ))
              : data.offers.map((p) => <ProductCard key={p.id} product={p} layout="row" />)}
          </HorizontalScroller>
        </section>

        <section>
          <SectionHeader title={t("departmentsTitle")} action={<SeeAllLink href="/categorias" />} />
          {isPending ? (
            <DepartmentTilesSkeleton />
          ) : (
            <DepartmentTiles categories={data.categories} offers={data.offers} />
          )}
        </section>

        <section aria-labelledby="home-campaign" className={cn(BOX, "bg-surface")}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2
              id="home-campaign"
              className="flex min-w-0 items-center gap-2 text-title-2 font-bold text-foreground"
            >
              <Sparkles
                className="size-5 shrink-0 animate-wiggle text-brand-roxo"
                strokeWidth={2}
                aria-hidden
              />
              <span className="truncate">{t("campaignTitle")}</span>
            </h2>
            <SeeAllLink href="/busca?sort=newest" />
          </div>
          {isPending ? <CampaignStripSkeleton /> : <CampaignStrip products={data.newArrivals} />}
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
              : data.bestSellers.map((p) => (
                  <ProductCard key={p.id} product={p} className="reveal" />
                ))}
          </div>
        </section>
      </PageContainer>
    </div>
  );
}

function SeeAllLink({ href, inverse }: { href: string; inverse?: boolean }) {
  const t = useTranslations("common");
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-sm py-2 text-body-sm font-semibold focus-ring hover:underline",
        inverse ? "text-current" : "text-primary",
      )}
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

/** "-25%" em selo branco (Vermelho sobre branco) + "Oferta" a partir de sm, sobre o card Vermelho. */
function DealLabel({ product }: { product: ProductSummaryDto }) {
  const t = useTranslations("catalog");
  const discount = discountPercent(product.price, product.compareAtPrice ?? null);
  return (
    <span className="flex min-w-0 items-center gap-1">
      {discount > 0 ? (
        <span className="shrink-0 rounded-sm bg-surface px-1 font-bold text-deal tabular-nums">
          -{discount}%
        </span>
      ) : null}
      {/* Nas colunas estreitas do mobile o selo "-25%" basta; a palavra entra a partir de sm. */}
      <span className="hidden truncate font-semibold sm:inline">{t("dealBadge")}</span>
    </span>
  );
}

/**
 * Cores chapadas dos quad cards, sempre com o par de conteúdo validado (DESIGN.md › Regra de ouro):
 * branco sobre Vermelho 600 e Azul 600; Tinta sobre Laranja e Verde.
 */
const QUAD_TONES = {
  deal: "bg-deal text-deal-foreground",
  primary: "bg-primary text-primary-foreground",
  cta: "bg-cta text-cta-foreground",
  verde: "bg-brand-verde text-on-bright",
} as const;

/**
 * Card colorido com título, grade 2×2 de fotos em moldura branca e o link "Ver …" no rodapé.
 * Entra subindo (em sequência com os vizinhos), levanta no hover e as fotos inclinam ao passar.
 */
function QuadCard({
  tone,
  delay,
  title,
  shortTitle,
  href,
  cta,
  items,
}: {
  tone: keyof typeof QUAD_TONES;
  delay: string;
  title: string;
  /** Título de uma linha para as colunas estreitas do mobile. */
  shortTitle?: string;
  href: string;
  cta: string;
  items: QuadItem[];
}) {
  const tc = useTranslations("common");
  return (
    <section
      className={cn(
        "relative flex animate-rise flex-col overflow-hidden rounded-lg p-3 shadow-md transition-[translate,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg md:p-4",
        QUAD_TONES[tone],
        delay,
      )}
    >
      {/* Círculo de luz no canto: dá profundidade à cor chapada sem virar gradiente. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-white/15"
      />
      <h2 className="relative truncate text-body font-bold md:text-title-3 md:font-bold">
        {shortTitle ? (
          <>
            <span className="sm:hidden">{shortTitle}</span>
            <span className="hidden sm:inline">{title}</span>
          </>
        ) : (
          title
        )}
      </h2>
      <ul className="relative mt-2 grid grid-cols-2 gap-x-2 gap-y-3 md:mt-3 md:gap-x-3">
        {items.map((it, i) => (
          <li key={it.key} className="min-w-0">
            <Link href={it.href} className="group flex flex-col gap-1 rounded-sm focus-ring">
              <span
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md bg-surface shadow-sm ring-2 ring-white/70 transition-[translate,rotate] duration-200 group-hover:-translate-y-1",
                  i % 2 ? "group-hover:rotate-2" : "group-hover:-rotate-2",
                )}
              >
                {it.image ? (
                  <Image
                    src={it.image}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 25vw, 140px"
                    placeholder="blur"
                    blurDataURL={blurDataUrlFor(it.image)}
                    unoptimized={isDirectImage(it.image)}
                    className={it.fit === "cover" ? "object-cover" : "object-contain"}
                  />
                ) : (
                  it.fallback
                )}
              </span>
              <span className="line-clamp-1 text-caption group-hover:underline">{it.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="relative mt-auto self-start rounded-sm pt-3 text-body-sm font-bold focus-ring hover:underline"
      >
        <span className="sm:hidden">{tc("seeAll")}</span>
        <span className="hidden sm:inline">{cta}</span>
        <ArrowRight className="ml-1 inline size-4 align-[-3px]" strokeWidth={2.25} aria-hidden />
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
          <Skeleton key={i} className="aspect-square w-full rounded-md" />
        ))}
      </div>
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/* ------------------------------ Confiança ----------------------------- */

/**
 * Faixa de confiança correndo (marquee): a rota PY → BR e os quatro diferenciais em pills chapadas.
 * O conteúdo é duplicado para o laço não ter emenda; a cópia é aria-hidden. Pausa no hover; com
 * prefers-reduced-motion fica parada, sem a cópia, e rola com o dedo.
 */
function TrustMarquee() {
  const t = useTranslations("home");
  const items = [
    { icon: Package, label: t("trustShipping"), tone: "bg-primary text-primary-foreground" },
    { icon: ShieldCheck, label: t("trustTax"), tone: "bg-brand-verde text-on-bright" },
    { icon: Store, label: t("trustSellers"), tone: "bg-deal text-deal-foreground" },
    { icon: CreditCard, label: t("trustPayment"), tone: "bg-brand-amarelo text-on-bright" },
  ];
  const row = (copy: boolean) => (
    <ul
      aria-hidden={copy || undefined}
      className={cn("flex shrink-0 items-center gap-3 pr-3", copy && "motion-reduce:hidden")}
    >
      <li className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-border bg-surface pr-4 pl-3 text-body-sm font-bold whitespace-nowrap text-foreground">
        <FlagPY className="rounded-[3px]" />
        <ArrowRight className="size-3.5" strokeWidth={2.5} aria-hidden />
        <FlagBR className="rounded-[3px]" />
        {t("routeBadge")}
      </li>
      {items.map(({ icon: Icon, label, tone }) => (
        <li
          key={label}
          className={cn(
            "flex h-10 shrink-0 items-center gap-2 rounded-full pr-4 pl-1.5 text-body-sm font-semibold whitespace-nowrap",
            tone,
          )}
        >
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-full bg-white/25"
          >
            <Icon className="size-4" strokeWidth={2.25} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
  return (
    <section
      aria-label={t("trustLabel")}
      className={cn(BOX, "overflow-hidden bg-surface py-3 motion-reduce:overflow-x-auto")}
    >
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

/* ---------------------------- Departamentos ---------------------------- */

/**
 * Tiles de departamento em cor chapada viva (a matiz de cada categoria), título em Bricolage 800
 * branco (texto grande, ≥ 3:1 em todas as matizes) e a capa do departamento numa moldura branca
 * inclinada que flutua e endireita no hover. "Ofertas em X · até N% off" só quando a categoria tem
 * oferta de verdade na home; senão o tile mostra o nome e a contagem de produtos.
 */
function DepartmentTiles({
  categories,
  offers,
}: {
  categories: CategoryDto[];
  offers: ProductSummaryDto[];
}) {
  const maxDiscount = new Map<string, number>();
  for (const p of offers) {
    const d = discountPercent(p.price, p.compareAtPrice ?? null);
    if (d > (maxDiscount.get(p.categoryId) ?? 0)) maxDiscount.set(p.categoryId, d);
  }
  return (
    <ul className={DEPARTMENT_LIST}>
      {categories.slice(0, 8).map((c, i) => (
        <li key={c.id} className="w-40 shrink-0 snap-start sm:w-48 lg:w-auto lg:reveal">
          <DepartmentTile category={c} upTo={maxDiscount.get(c.id)} index={i} />
        </li>
      ))}
    </ul>
  );
}

const DEPARTMENT_LIST =
  "-mx-4 flex scrollbar-none snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0";

function DepartmentTile({
  category: c,
  upTo,
  index,
}: {
  category: CategoryDto;
  upTo?: number;
  index: number;
}) {
  const t = useTranslations("home");
  const tc = useTranslations("catalog");
  const href = upTo
    ? `/busca?categorySlug=${encodeURIComponent(c.slug)}&onlyOffers=true`
    : `/categoria/${c.slug}`;
  return (
    <Link
      href={href}
      style={hueStyle(categoryHue(c.slug))}
      className="group relative flex h-56 flex-col overflow-hidden rounded-lg tint-bg-deep p-3 text-white shadow-sm focus-ring transition-[translate,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lg lg:h-64 lg:p-4"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -bottom-12 size-44 rounded-full bg-white/15 transition-[scale] duration-500 group-hover:scale-125"
      />
      <span className="relative font-heading text-title-2 leading-tight font-extrabold text-balance">
        {upTo ? t("categoryDealsTitle", { name: c.name }) : c.name}
      </span>
      <span
        className={cn(
          "relative mt-1.5 inline-flex h-6 w-fit items-center rounded-sm bg-surface px-1.5 text-caption font-bold",
          upTo ? "text-deal" : "text-foreground",
        )}
      >
        {upTo
          ? t("categoryDealsUpTo", { percent: upTo })
          : tc("categoryProducts", { count: c.productCount })}
      </span>
      <span className="relative mt-auto flex justify-center">
        {/* Atraso negativo por índice: os tiles flutuam fora de fase, como uma vitrine viva. */}
        <span className="animate-float" style={{ animationDelay: `${index * -0.6}s` }}>
          <span className="block size-24 -rotate-6 rounded-md bg-surface p-1 shadow-lg transition-[rotate,scale] duration-300 group-hover:scale-110 group-hover:rotate-0 lg:size-32">
            <span className="relative block size-full overflow-hidden rounded-sm bg-surface-muted">
              {c.imageUrl ? (
                <Image
                  src={c.imageUrl}
                  alt=""
                  fill
                  sizes="128px"
                  placeholder="blur"
                  blurDataURL={blurDataUrlFor(c.imageUrl)}
                  className="object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center tint-bg tint-fg">
                  <CategoryIcon iconKey={c.iconKey} className="size-8" />
                </span>
              )}
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}

function DepartmentTilesSkeleton() {
  return (
    <div aria-hidden className={DEPARTMENT_LIST}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-56 w-40 shrink-0 rounded-lg sm:w-48 lg:h-64 lg:w-auto" />
      ))}
    </div>
  );
}

/* ------------------------------ Campanha ------------------------------ */

const CAMPAIGN_LIST =
  "-mx-4 flex scrollbar-none snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-1 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-visible lg:px-0";

/**
 * Vitrine de campanha em Roxo (padrão das vitrines temáticas de loja): cada novidade num quadrado
 * Roxo com a foto em moldura, nome e preço embaixo. O quadrado sobe e a foto cresce no hover.
 */
function CampaignStrip({ products }: { products: ProductSummaryDto[] }) {
  return (
    <ul className={CAMPAIGN_LIST}>
      {products.slice(0, 12).map((p) => (
        <li key={p.id} className="w-32 shrink-0 snap-start sm:w-36 lg:w-auto lg:reveal">
          <Link
            href={`/produto/${p.slug}`}
            className="group flex flex-col gap-2 rounded-lg focus-ring"
          >
            <span className="relative block aspect-square overflow-hidden rounded-lg bg-brand-roxo p-2 shadow-sm transition-[translate,box-shadow] duration-200 group-hover:-translate-y-1 group-hover:shadow-md">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-8 -left-8 size-24 rounded-full bg-white/20"
              />
              <span className="relative block size-full overflow-hidden rounded-md bg-surface shadow-md">
                <Image
                  src={p.thumbnailUrl}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 144px, 180px"
                  placeholder="blur"
                  blurDataURL={blurDataUrlFor(p.thumbnailUrl)}
                  unoptimized={isDirectImage(p.thumbnailUrl)}
                  className="object-contain transition-[scale] duration-300 group-hover:scale-110"
                />
              </span>
            </span>
            <span className="line-clamp-2 text-body-sm text-foreground group-hover:underline">
              {p.name}
            </span>
            <span className="text-body-sm font-bold text-foreground tabular-nums">
              {formatMoney(p.price)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CampaignStripSkeleton() {
  return (
    <div aria-hidden className={CAMPAIGN_LIST}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex w-32 shrink-0 flex-col gap-2 sm:w-36 lg:w-auto">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-1/2" />
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

/** Chip branco com a contagem regressiva em Vermelho e reflexo periódico (só no cliente). */
function DealsCountdown() {
  const t = useTranslations("home");
  const [untilIso] = useState(nextMidnightIso);
  const seconds = useCountdown(untilIso);
  const hours = Math.floor(seconds / 3600);
  const time = `${String(hours).padStart(2, "0")}:${formatCountdown(seconds % 3600)}`;
  return (
    <span
      className="shine relative inline-flex h-6 shrink-0 items-center rounded-sm bg-surface px-2 text-caption font-bold text-deal tabular-nums"
      aria-label={t("dealsEndIn", { time })}
      role="timer"
    >
      {time}
    </span>
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
