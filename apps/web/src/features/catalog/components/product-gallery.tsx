"use client";

import type { ProductImageDto } from "@marketplace/contracts";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: ProductImageDto[];
  name: string;
  discountPercent?: number;
  /** Conteúdo sobreposto no canto superior direito (ex.: favorito/compartilhar). */
  overlay?: React.ReactNode;
}

/** Galeria com swipe (embla), contador "n/total" e thumbnails. */
export function ProductGallery({ images, name, discountPercent = 0, overlay }: ProductGalleryProps) {
  const t = useTranslations("product");
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <div className="flex flex-col gap-2" aria-label={t("gallery")} role="region">
      <div className="relative -mx-4 sm:mx-0 sm:overflow-hidden sm:rounded-2xl">
        <Carousel setApi={setApi} opts={{ loop: sorted.length > 1 }} className="bg-surface">
          <CarouselContent className="ml-0">
            {sorted.map((img, i) => (
              <CarouselItem key={img.id} className="pl-0">
                <div className="relative aspect-square w-full">
                  <Image src={img.url} alt={img.alt || name} fill priority={i === 0} sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {discountPercent > 0 ? (
          <span className="absolute top-3 left-3 rounded-md bg-cta px-2 py-1 text-xs font-bold text-cta-foreground shadow-sm">-{discountPercent}%</span>
        ) : null}
        {overlay ? <div className="absolute top-3 right-3 flex flex-col gap-2">{overlay}</div> : null}
        <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white" aria-live="polite">
          {t("imageOf", { current: current + 1, total: sorted.length })}
        </span>
      </div>
      {sorted.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto scrollbar-none" role="tablist" aria-label={t("gallery")}>
          {sorted.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                role="tab"
                aria-selected={i === current}
                aria-label={t("imageOf", { current: i + 1, total: sorted.length })}
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden rounded-lg border-2 bg-surface transition-colors",
                  i === current ? "border-primary" : "border-transparent hover:border-border",
                )}
              >
                <Image src={img.url} alt="" fill sizes="56px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
