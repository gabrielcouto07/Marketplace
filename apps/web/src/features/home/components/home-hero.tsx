"use client";

import type { BannerDto } from "@marketplace/contracts";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useReducedMotion } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState, type CSSProperties } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { blurDataUrlFor } from "@/lib/images";
import { cn } from "@/lib/utils";

/** O tom do banner vira só o chip do título: `red` em Vermelho de oferta, `blue` em Azul. */
const TONE_KICKER: Record<BannerDto["tone"], string> = {
  red: "bg-deal text-deal-foreground",
  blue: "bg-primary text-primary-foreground",
  neutral: "bg-surface text-foreground",
};

/** Altura do hero; os quad cards da home sobem sobre a parte de baixo (ver HomeView). */
const HERO_HEIGHT = "h-56 md:h-[22rem] lg:h-[25rem]";

/** Tempo de cada banner no autoplay; alimenta também a barra de progresso do ponto ativo. */
const INTERVAL_MS = 6000;

/**
 * Hero da home em padrão de loja: carrossel de banners de ponta a ponta, com scrim em brand-deep
 * para o texto branco e, a partir de md, a base da foto dissolvendo no fundo da página para os
 * cards da home subirem sobre ela.
 *
 * Movimento (DESIGN.md › Animações de vitrine): troca sozinho a cada 6 s, com a foto ativa em zoom
 * lento e o texto subindo em sequência. Pausa no hover, no foco e pelo botão de pausa (WCAG 2.2.2);
 * com prefers-reduced-motion não há autoplay nem animação.
 */
export function HomeHero({ banners }: { banners: BannerDto[] }) {
  const t = useTranslations("home");
  const [emblaRef, api] = useEmblaCarousel({ loop: true });
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [stopped, setStopped] = useState(false);
  const reduceMotion = useReducedMotion();
  const many = banners.length > 1;
  const playing = many && !reduceMotion && !stopped && !hovered;

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    api.on("select", onSelect).on("reInit", onSelect);
    return () => {
      api.off("select", onSelect).off("reInit", onSelect);
    };
  }, [api]);

  // Um timeout por banner: recomeça a cada troca (manual ou automática) e some quando pausa.
  useEffect(() => {
    if (!api || !playing) return;
    const id = window.setTimeout(() => api.scrollNext(), INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [api, playing, selected]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("heroLabel")}
      className="relative mx-auto w-full max-w-[1500px]"
      // Só o mouse pausa por hover: no toque o "hover" grudaria e o autoplay nunca voltaria.
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false);
      }}
      style={{ "--hero-interval": `${INTERVAL_MS}ms` } as CSSProperties}
    >
      <div ref={emblaRef} className="overflow-hidden">
        <ul className="flex">
          {banners.map((b, i) => (
            <li
              key={b.id}
              role="group"
              aria-roledescription="slide"
              aria-label={t("heroSlide", { index: i + 1, total: banners.length })}
              className="min-w-0 flex-[0_0_100%]"
            >
              <HeroSlide banner={b} first={i === 0} active={i === selected} />
            </li>
          ))}
        </ul>
      </div>

      {many ? (
        <>
          <HeroArrow side="left" label={t("heroPrevious")} onClick={() => api?.scrollPrev()} />
          <HeroArrow side="right" label={t("heroNext")} onClick={() => api?.scrollNext()} />
          <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-1.5 md:top-6 md:right-20 md:bottom-auto md:left-auto md:translate-x-0">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={t("heroSlide", { index: i + 1, total: banners.length })}
                aria-current={i === selected ? "true" : undefined}
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  "relative h-2 overflow-hidden rounded-full focus-ring transition-[width,background-color] duration-200 before:absolute before:-inset-2",
                  i === selected ? "w-8 bg-white/40" : "w-2 bg-white/50 hover:bg-white/80",
                )}
              >
                {i === selected ? (
                  // Barra que enche durante o tempo do banner; parada (cheia) quando pausado.
                  <span
                    key={`${selected}-${playing}`}
                    aria-hidden
                    className={cn(
                      "absolute inset-0 origin-left rounded-full bg-white",
                      playing && "animate-progress",
                    )}
                  />
                ) : null}
              </button>
            ))}
            {reduceMotion ? null : (
              <button
                type="button"
                aria-label={stopped ? t("heroPlay") : t("heroPause")}
                aria-pressed={stopped}
                onClick={() => setStopped((s) => !s)}
                className="relative ml-1 flex size-6 items-center justify-center rounded-full bg-black/35 text-white focus-ring backdrop-blur-sm transition-colors before:absolute before:-inset-2 hover:bg-black/55"
              >
                {stopped ? (
                  <Play className="size-3 fill-current" strokeWidth={2} aria-hidden />
                ) : (
                  <Pause className="size-3 fill-current" strokeWidth={2} aria-hidden />
                )}
              </button>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

function HeroSlide({
  banner: b,
  first,
  active,
}: {
  banner: BannerDto;
  first: boolean;
  active: boolean;
}) {
  const t = useTranslations("home");
  // O texto sobe em sequência sempre que o banner fica ativo (a classe reaplicada reinicia a animação).
  const rise = (delay: string) => (active ? cn("animate-rise", delay) : undefined);
  return (
    <Link
      href={b.href}
      tabIndex={active ? undefined : -1}
      aria-hidden={active ? undefined : true}
      className={cn("group relative block overflow-hidden bg-brand-deep focus-ring", HERO_HEIGHT)}
    >
      <Image
        src={b.imageUrl}
        alt=""
        fill
        priority={first}
        sizes="(max-width: 1500px) 100vw, 1500px"
        placeholder="blur"
        blurDataURL={blurDataUrlFor(b.imageUrl)}
        className={cn("object-cover", active && "animate-ken-burns")}
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-brand-deep/90 via-brand-deep/40 to-brand-deep/0 md:bg-linear-to-r md:from-brand-deep/85 md:via-brand-deep/35"
      />
      {/* A partir de md a base da foto dissolve no fundo da página, onde os cards se apoiam. */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 hidden h-3/5 bg-linear-to-b from-background/0 to-background md:block"
      />
      <span className="relative mx-auto flex h-full w-full max-w-6xl flex-col items-start justify-end gap-2 px-4 pb-14 text-white md:justify-start md:px-16 md:pt-10 md:pb-0">
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-sm px-2 text-caption font-semibold uppercase",
            TONE_KICKER[b.tone],
            b.tone === "red" && "shine relative",
            rise("[animation-delay:60ms]"),
          )}
        >
          {b.title}
        </span>
        <span
          className={cn(
            "max-w-md font-heading text-title-1 font-extrabold text-balance md:text-hero",
            rise("[animation-delay:160ms]"),
          )}
        >
          {b.subtitle}
        </span>
        <span
          className={cn(
            "mt-1 hidden h-10 items-center gap-1 rounded-full bg-surface px-4 text-body-sm font-semibold text-foreground shadow-sm transition-colors group-hover:bg-surface-muted md:inline-flex",
            rise("[animation-delay:260ms]"),
          )}
        >
          {first ? t("seeOffers") : t("bannerCta")}
          <ArrowRight
            className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
            strokeWidth={2}
            aria-hidden
          />
        </span>
      </span>
    </Link>
  );
}

/** Seta lateral do desktop: área alta e transparente na metade de cima, contorno branco no hover. */
function HeroArrow({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "absolute top-6 hidden h-40 w-14 items-center justify-center rounded-md text-white link-on-deep md:flex",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      <Icon className="size-10" strokeWidth={1.5} aria-hidden />
    </button>
  );
}

export function HomeHeroSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <Skeleton className={cn("w-full rounded-none", HERO_HEIGHT)} />
    </div>
  );
}
