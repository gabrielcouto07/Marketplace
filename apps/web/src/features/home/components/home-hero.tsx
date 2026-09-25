"use client";

import { ChevronDown, Heart, MapPin, Search, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { BrandMark } from "@/components/layout/brand-mark";
import { CartBadge } from "@/components/layout/header";
import { readStoredCep } from "@/components/shared/cep-shipping-calculator";
import { selectItemCount, useCartHydrated, useCartStore } from "@/features/cart/store";
import { Link } from "@/i18n/navigation";
import { formatCep } from "@/lib/validation/documents";

type Greeting = "greetingMorning" | "greetingAfternoon" | "greetingEvening";

const noopSubscribe = () => () => {};

function greetingForNow(): Greeting {
  const hour = new Date().getHours();
  if (hour < 12) return "greetingMorning";
  if (hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}

/**
 * Hero azul da home (só mobile — no desktop o header já traz marca, busca e atalhos):
 * marca + favoritos/carrinho, "botão de busca" branco, linha de entrega com o CEP salvo
 * e uma saudação pela hora do dia. O `pb-16` deixa os cards de promoção sobreporem o hero.
 */
export function HomeHero() {
  const t = useTranslations("home");
  const tn = useTranslations("nav");
  const hydrated = useCartHydrated();
  const count = useCartStore((s) => selectItemCount(s.lines));
  // Saudação e CEP só existem no cliente: no servidor renderiza null/"" e evita mismatch.
  const greeting = useSyncExternalStore(noopSubscribe, greetingForNow, () => null);
  const storedCep = useSyncExternalStore(noopSubscribe, readStoredCep, () => "");
  const cep = storedCep ? formatCep(storedCep) : "";

  return (
    <section
      className="relative overflow-hidden bg-header px-4 pt-3.5 pb-16 text-header-foreground md:hidden"
      aria-label={t("heroLabel")}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[90px] -right-[70px] size-60 rounded-full bg-white/[0.07]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-[60px] right-10 size-[90px] rounded-full bg-white/[0.05]"
      />

      <div className="relative flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <BrandMark tone="dark" />
          <nav aria-label={tn("quickActions")} className="flex gap-2">
            <Link
              href="/favoritos"
              aria-label={tn("favorites")}
              className="flex size-11 pressable items-center justify-center rounded-lg bg-white/[0.13] transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              <Heart className="size-[21px]" strokeWidth={2} aria-hidden />
            </Link>
            <Link
              href="/carrinho"
              aria-label={tn("cartWithCount", { count: hydrated ? count : 0 })}
              className="relative flex size-11 pressable items-center justify-center rounded-lg bg-white/[0.13] transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              <ShoppingBag className="size-[21px]" strokeWidth={2} aria-hidden />
              <CartBadge count={hydrated ? count : 0} className="top-1 right-1 ring-header" />
            </Link>
          </nav>
        </div>

        <Link
          href="/busca"
          aria-label={tn("openSearch")}
          className="flex h-[50px] pressable items-center gap-2.5 rounded-xl bg-card px-3.5 text-left text-[14.5px] text-muted-foreground shadow-card focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
        >
          <Search className="size-5 shrink-0 text-primary" strokeWidth={2.2} aria-hidden />
          <span className="flex-1 truncate">{tn("searchPlaceholder")}</span>
        </Link>

        <div className="flex items-center justify-between gap-3">
          <Link
            href="/conta/enderecos"
            className="flex min-w-0 items-center gap-1.5 rounded-md text-[12.5px] font-semibold focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            <MapPin className="size-[15px] shrink-0" strokeWidth={2} aria-hidden />
            <span className="truncate opacity-[0.92]">
              {cep ? t("deliverTo", { place: cep }) : t("setCep")}
            </span>
            <ChevronDown className="size-3.5 shrink-0" strokeWidth={2.4} aria-hidden />
          </Link>
          {greeting ? (
            <span
              className="shrink-0 animate-rise rounded-full bg-white/[0.13] px-2.5 py-1 text-[11.5px] font-bold"
              title={t("greetingHint")}
            >
              {t(greeting)}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
