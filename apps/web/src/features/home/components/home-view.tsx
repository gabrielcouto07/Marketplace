"use client";

import type { BannerDto, CategoryDto, ProductSummaryDto, SellerSummaryDto } from "@marketplace/contracts";
import { ChevronRight, CreditCard, Package, ShieldCheck, Store } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { CategoryIcon } from "@/components/shared/category-icon";
import { ProductCard, ProductCardSkeleton } from "@/components/shared/product-card";
import { SellerBadge } from "@/components/shared/seller-badge";
import { ErrorState, HorizontalScroller, SectionHeader } from "@/components/shared/states";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { useHome } from "@/features/catalog/api";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function HomeView() {
  const t = useTranslations("home");
  const { data, isPending, isError, error, refetch } = useHome();

  if (isError) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-3 sm:pt-5">
      <PageContainer>{isPending ? <Skeleton className="aspect-[5/2] w-full rounded-2xl sm:aspect-[3/1]" /> : <BannerCarousel banners={data.banners} />}</PageContainer>

      <PageContainer>
        <TrustBar />
      </PageContainer>

      <PageContainer>
        <SectionHeader title={t("categories")} action={<SeeAllLink href="/categorias" />} />
        {isPending ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : (
          <CategoryGrid categories={data.categories} />
        )}
      </PageContainer>

      <ProductRail title={t("offers")} href="/busca?onlyOffers=true" products={data?.offers} loading={isPending} tone="red" />
      <ProductRail title={t("newArrivals")} href="/busca?sort=newest" products={data?.newArrivals} loading={isPending} />
      <ProductRail title={t("bestSellers")} href="/busca?sort=bestSelling" products={data?.bestSellers} loading={isPending} />

      <PageContainer>
        <SectionHeader title={t("featuredSellers")} />
        {isPending ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[76px] rounded-xl" />
            ))}
          </div>
        ) : (
          <SellerGrid sellers={data.featuredSellers} />
        )}
      </PageContainer>
    </div>
  );
}

function SeeAllLink({ href }: { href: string }) {
  const t = useTranslations("common");
  return (
    <Link href={href} className="flex items-center gap-0.5 text-sm font-medium text-primary hover:underline">
      {t("seeAll")} <ChevronRight className="size-4" aria-hidden />
    </Link>
  );
}

const TONE_BG: Record<BannerDto["tone"], string> = {
  blue: "bg-brand-blue-600 text-white",
  red: "bg-brand-red-500 text-white",
  neutral: "bg-neutral-100 text-neutral-900",
};

function BannerCarousel({ banners }: { banners: BannerDto[] }) {
  const t = useTranslations("home");
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    // autoplay leve
    const timer = window.setInterval(() => api.scrollNext(), 6000);
    return () => {
      api.off("select", onSelect);
      window.clearInterval(timer);
    };
  }, [api]);

  const goTo = useCallback((i: number) => api?.scrollTo(i), [api]);

  return (
    <section aria-label={t("heroLabel")} className="relative">
      <Carousel setApi={setApi} opts={{ loop: true, align: "start" }} className="overflow-hidden rounded-2xl">
        <CarouselContent className="ml-0">
          {banners.map((b, i) => (
            <CarouselItem key={b.id} className="pl-0">
              <Link href={b.href} className={cn("relative block aspect-[5/2] w-full overflow-hidden sm:aspect-[3/1]", TONE_BG[b.tone])}>
                <Image src={b.imageUrl} alt="" fill priority={i === 0} sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover" />
                <span className="sr-only">
                  {b.title} — {b.subtitle}
                </span>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" role="tablist" aria-label={t("heroLabel")}>
        {banners.map((b, i) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={i === current}
            aria-label={b.title}
            onClick={() => goTo(i)}
            className={cn("h-1.5 rounded-full transition-all", i === current ? "w-5 bg-white" : "w-1.5 bg-white/60")}
          />
        ))}
      </div>
    </section>
  );
}

function TrustBar() {
  const t = useTranslations("home");
  const items = [
    { icon: Package, label: t("trustShipping") },
    { icon: ShieldCheck, label: t("trustTax") },
    { icon: Store, label: t("trustSellers") },
    { icon: CreditCard, label: t("trustPayment") },
  ];
  return (
    <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
      {items.map(({ icon: Icon, label }) => (
        <li key={label} className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium sm:shrink">
          <Icon className="size-4 text-primary" aria-hidden />
          <span className="whitespace-nowrap sm:whitespace-normal">{label}</span>
        </li>
      ))}
    </ul>
  );
}

function CategoryGrid({ categories }: { categories: CategoryDto[] }) {
  return (
    <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {categories.map((c) => (
        <li key={c.id}>
          <Link
            href={`/categoria/${c.slug}`}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-2 text-center transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <CategoryIcon iconKey={c.iconKey} className="size-5" />
            </span>
            <span className="line-clamp-1 text-[11px] font-medium sm:text-xs">{c.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ProductRail({
  title,
  href,
  products,
  loading,
  tone,
}: {
  title: string;
  href: string;
  products?: ProductSummaryDto[];
  loading: boolean;
  tone?: "red";
}) {
  return (
    <PageContainer>
      <SectionHeader
        title={title}
        action={<SeeAllLink href={href} />}
        className={tone === "red" ? "[&_h2]:text-brand-red-600" : undefined}
      />
      <HorizontalScroller>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} layout="row" />)
          : products?.map((p) => <ProductCard key={p.id} product={p} layout="row" />)}
      </HorizontalScroller>
    </PageContainer>
  );
}

function SellerGrid({ sellers }: { sellers: SellerSummaryDto[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {sellers.map((s) => (
        <li key={s.id}>
          <SellerBadge seller={s} variant="card" />
        </li>
      ))}
    </ul>
  );
}
