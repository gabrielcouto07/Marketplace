"use client";

import type { ProductImageDto } from "@marketplace/contracts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { BLUR_DATA_URL } from "@/lib/images";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  images: ProductImageDto[];
  name: string;
  /** Botões flutuantes no canto superior direito (compartilhar/favoritar). */
  topRight?: ReactNode;
  className?: string;
}

const SWIPE_THRESHOLD = 48;

/**
 * Galeria 1:1 (DESIGN.md › Imagem): full-bleed no mobile, object-contain sobre surface-muted,
 * crossfade de 200 ms com `motion` ao trocar (arraste horizontal no toque, setas no desktop) e
 * miniaturas de 64 px roláveis abaixo. O palco leva `view-transition-name: product-image` para a
 * View Transitions API entre listagem e produto.
 */
export function ProductGallery({ images, name, topRight, className }: ProductGalleryProps) {
  const t = useTranslations("product");
  const reduceMotion = useReducedMotion();
  const sorted = useMemo(() => [...images].sort((a, b) => a.sortOrder - b.sortOrder), [images]);
  const [current, setCurrent] = useState(0);
  const total = sorted.length;
  const active = sorted[Math.min(current, total - 1)];

  const goTo = (index: number) => setCurrent(((index % total) + total) % total);
  const fade = { duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] as const };

  return (
    <div className={cn("flex flex-col gap-4", className)} role="region" aria-label={t("gallery")}>
      <div
        className="relative aspect-square w-full overflow-hidden bg-surface-muted lg:rounded-lg"
        style={{ viewTransitionName: "product-image" }}
      >
        <AnimatePresence initial={false}>
          {active ? (
            <motion.div
              key={active.id}
              className="absolute inset-0 touch-pan-y"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fade}
              drag={total > 1 && !reduceMotion ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(_, info) => {
                if (info.offset.x <= -SWIPE_THRESHOLD) goTo(current + 1);
                else if (info.offset.x >= SWIPE_THRESHOLD) goTo(current - 1);
              }}
            >
              <Image
                src={active.url}
                alt={active.alt || name}
                fill
                priority={current === 0}
                draggable={false}
                sizes="(max-width: 1024px) 100vw, 50vw"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="object-contain p-4 select-none"
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-end gap-2">
          <div className="pointer-events-auto flex gap-2">{topRight}</div>
        </div>

        {total > 1 ? (
          <>
            <Button
              variant="floating"
              size="icon"
              aria-label={t("previousImage")}
              onClick={() => goTo(current - 1)}
              className="absolute top-1/2 left-4 hidden -translate-y-1/2 lg:inline-flex"
            >
              <ChevronLeft strokeWidth={1.75} />
            </Button>
            <Button
              variant="floating"
              size="icon"
              aria-label={t("nextImage")}
              onClick={() => goTo(current + 1)}
              className="absolute top-1/2 right-4 hidden -translate-y-1/2 lg:inline-flex"
            >
              <ChevronRight strokeWidth={1.75} />
            </Button>
          </>
        ) : null}

        <span className="sr-only" aria-live="polite">
          {t("imageOf", { current: current + 1, total })}
        </span>
      </div>

      {total > 1 ? (
        <ul
          className="scrollbar-none flex gap-2 overflow-x-auto px-4 lg:px-0"
          role="tablist"
          aria-label={t("gallery")}
        >
          {sorted.map((img, i) => {
            const selected = i === current;
            return (
              <li key={img.id} className="shrink-0">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={t("imageOf", { current: i + 1, total })}
                  onClick={() => goTo(i)}
                  className={cn(
                    "relative block size-16 pressable overflow-hidden rounded-md border bg-surface-muted focus-ring transition-colors",
                    selected ? "border-primary" : "border-border hover:border-border-strong",
                  )}
                >
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    sizes="64px"
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-contain p-1"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
