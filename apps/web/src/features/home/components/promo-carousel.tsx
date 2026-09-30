"use client";

import type { BannerDto } from "@marketplace/contracts";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { blurDataUrlFor } from "@/lib/images";
import { cn } from "@/lib/utils";

/**
 * O tom do banner vira só o chip do título (ponto focal), nunca a área inteira: o `red` é o único
 * vermelho da home, o `blue` usa o azul da marca e o `neutral` um chip branco. A foto ocupa o card
 * com um scrim em brand-deep na base para o texto branco ler com contraste.
 */
const TONE_KICKER: Record<BannerDto["tone"], string> = {
  red: "bg-cta text-cta-foreground",
  blue: "bg-primary text-primary-foreground",
  neutral: "bg-white/90 text-brand-deep",
};

/** Item do carrossel: quase a largura da tela no mobile (o próximo espia), 3 colunas em lg. */
const ITEM_CLASS =
  "w-[calc(100%-2rem)] shrink-0 snap-start sm:w-[calc(60%-0.75rem)] lg:w-auto lg:shrink";

/** Carrossel de banners promocionais: cards fotográficos de 192 px (208 em lg), rounded-lg. */
export function PromoCarousel({ banners }: { banners: BannerDto[] }) {
  const t = useTranslations("home");
  return (
    <ul className="mx-auto scrollbar-none flex w-full max-w-6xl snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 lg:grid lg:grid-cols-3 lg:overflow-visible">
      {banners.map((b, i) => (
        <li key={b.id} className={ITEM_CLASS}>
          <Link
            href={b.href}
            className="group relative flex h-48 pressable flex-col justify-end overflow-hidden rounded-lg bg-brand-deep p-4 text-white shadow-xs focus-ring lg:h-52"
          >
            <Image
              src={b.imageUrl}
              alt=""
              fill
              priority={i === 0}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 384px"
              placeholder="blur"
              blurDataURL={blurDataUrlFor(b.imageUrl)}
              className="object-cover transition-transform duration-300 ease-standard group-hover:scale-[1.03]"
            />
            <span
              aria-hidden
              className="absolute inset-0 bg-linear-to-t from-brand-deep/90 via-brand-deep/45 to-brand-deep/5"
            />
            <span className="relative flex max-w-[85%] flex-col items-start gap-2">
              <span
                className={cn(
                  "inline-flex h-6 items-center rounded-sm px-2 text-caption uppercase",
                  TONE_KICKER[b.tone],
                )}
              >
                {b.title}
              </span>
              <span className="text-title-2 text-balance">{b.subtitle}</span>
              <span className="inline-flex items-center gap-1 text-body-sm font-semibold">
                {i === 0 ? t("seeOffers") : t("bannerCta")}
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Skeleton no formato exato dos banners (um no mobile, três em lg). */
export function PromoCarouselSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl gap-3 overflow-hidden px-4 lg:grid lg:grid-cols-3">
      <Skeleton className={cn(ITEM_CLASS, "h-48 rounded-lg lg:h-52")} />
      <Skeleton className={cn(ITEM_CLASS, "hidden h-48 rounded-lg sm:block lg:h-52")} />
      <Skeleton className={cn(ITEM_CLASS, "hidden h-48 rounded-lg lg:block lg:h-52")} />
    </div>
  );
}
