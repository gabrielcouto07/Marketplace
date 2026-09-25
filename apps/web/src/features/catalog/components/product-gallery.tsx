"use client";

import type { ProductImageDto } from "@marketplace/contracts";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode, type UIEvent } from "react";

import { hueStyle } from "@/lib/palette";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: ProductImageDto[];
  name: string;
  /** Matiz da categoria (0–360): tinge o fundo e o círculo decorativo. */
  hue: number;
  /** Botões flutuantes no canto superior esquerdo (voltar). */
  topLeft?: ReactNode;
  /** Botões flutuantes no canto superior direito (compartilhar/favoritar). */
  topRight?: ReactNode;
  className?: string;
}

/**
 * Galeria full-bleed de 370 px com snap-scroll nativo sobre fundo tingido pela categoria,
 * pontos indicadores (o ativo vira uma pílula de 20 px) e miniaturas no desktop.
 */
export function ProductGallery({
  images,
  name,
  hue,
  topLeft,
  topRight,
  className,
}: ProductGalleryProps) {
  const t = useTranslations("product");
  const trackRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const index = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (index !== current) setCurrent(Math.min(sorted.length - 1, Math.max(0, index)));
  };

  const scrollTo = (index: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      role="region"
      aria-label={t("gallery")}
      style={hueStyle(hue)}
    >
      <div className="relative overflow-hidden tint-bg lg:rounded-3xl">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
          aria-live="polite"
        >
          {sorted.map((img, i) => (
            <div
              key={img.id}
              className="relative flex h-[370px] w-full shrink-0 snap-start items-center justify-center overflow-hidden lg:h-[520px]"
            >
              <span
                aria-hidden
                className="absolute -top-10 -right-15 size-60 rounded-full tint-bg-strong lg:-top-16 lg:-right-20 lg:size-80"
              />
              <Image
                src={img.url}
                alt={img.alt || name}
                fill
                priority={i === 0}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between">
          <div className="pointer-events-auto flex gap-2">{topLeft}</div>
          <div className="pointer-events-auto flex gap-2">{topRight}</div>
        </div>

        {sorted.length > 1 ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-9 flex justify-center gap-[5px] lg:bottom-5"
            aria-hidden
          >
            {sorted.map((img, i) => (
              <span
                key={img.id}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  i === current ? "w-5 bg-ink" : "w-1.5 bg-ink/25",
                )}
              />
            ))}
          </div>
        ) : null}
        <span className="sr-only">
          {t("imageOf", { current: current + 1, total: sorted.length })}
        </span>
      </div>

      {sorted.length > 1 ? (
        <ul
          className="scrollbar-none hidden gap-2 overflow-x-auto lg:flex"
          role="tablist"
          aria-label={t("gallery")}
        >
          {sorted.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                role="tab"
                aria-selected={i === current}
                aria-label={t("imageOf", { current: i + 1, total: sorted.length })}
                onClick={() => scrollTo(i)}
                className={cn(
                  "relative size-16 shrink-0 pressable overflow-hidden rounded-lg border-2 tint-bg transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  i === current ? "border-primary" : "border-transparent hover:border-line-200",
                )}
              >
                <Image src={img.url} alt="" fill sizes="64px" className="object-contain p-1.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
