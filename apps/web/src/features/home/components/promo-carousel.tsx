"use client";

import type { BannerDto } from "@marketplace/contracts";
import { ArrowRight, Smartphone, Sparkles, Truck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface ToneStyle {
  card: string;
  kicker: string;
  icon: string;
}

/**
 * Um tom por banner. O `red` é o único vermelho da home (bg-cta); o `blue` usa brand-deep,
 * nunca o azul saturado chapado; o `neutral` é um card comum de surface.
 */
const TONES: Record<BannerDto["tone"], ToneStyle> = {
  red: {
    card: "bg-cta text-white",
    kicker: "text-white/80",
    icon: "bg-white/10 text-white",
  },
  blue: {
    card: "bg-brand-deep text-white",
    kicker: "text-blue-300",
    icon: "bg-white/10 text-white",
  },
  neutral: {
    card: "border border-border bg-surface text-foreground shadow-xs",
    kicker: "text-foreground-secondary",
    icon: "bg-primary-soft text-primary",
  },
};

const TONE_ICONS: Record<BannerDto["tone"], LucideIcon> = {
  red: Truck,
  blue: Smartphone,
  neutral: Sparkles,
};

/** Item do carrossel: quase a largura da tela no mobile (o próximo espia), 3 colunas em lg. */
const ITEM_CLASS =
  "w-[calc(100%-2rem)] shrink-0 snap-start sm:w-[calc(60%-0.75rem)] lg:w-auto lg:shrink";

/** Carrossel de banners promocionais: cards de 160 px, rounded-lg, um por tom. */
export function PromoCarousel({ banners }: { banners: BannerDto[] }) {
  const t = useTranslations("home");
  return (
    <ul className="mx-auto scrollbar-none flex w-full max-w-6xl snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 lg:grid lg:grid-cols-3 lg:overflow-visible">
      {banners.map((b, i) => {
        const tone = TONES[b.tone];
        const Icon = TONE_ICONS[b.tone];
        return (
          <li key={b.id} className={ITEM_CLASS}>
            <Link
              href={b.href}
              className={cn(
                "relative flex h-40 pressable flex-col justify-between rounded-lg p-4 focus-ring",
                tone.card,
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 right-4 flex size-12 items-center justify-center rounded-md",
                  tone.icon,
                )}
              >
                <Icon className="size-6" strokeWidth={1.75} />
              </span>
              <span className="flex max-w-[75%] flex-col gap-1">
                <span className={cn("text-caption uppercase", tone.kicker)}>{b.title}</span>
                <span className="text-title-2 text-balance">{b.subtitle}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-body-sm font-semibold">
                {i === 0 ? t("seeOffers") : t("bannerCta")}
                <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Skeleton no formato exato dos banners (um no mobile, três em lg). */
export function PromoCarouselSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl gap-3 overflow-hidden px-4 lg:grid lg:grid-cols-3">
      <Skeleton className={cn(ITEM_CLASS, "h-40 rounded-lg")} />
      <Skeleton className={cn(ITEM_CLASS, "hidden h-40 rounded-lg sm:block")} />
      <Skeleton className={cn(ITEM_CLASS, "hidden h-40 rounded-lg lg:block")} />
    </div>
  );
}
