"use client";

import { ArrowRight, ChevronRight, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { readStoredCep } from "@/components/shared/cep-shipping-calculator";
import { Link } from "@/i18n/navigation";
import { formatCep } from "@/lib/validation/documents";

import { FlagBR, FlagPY, HeroIllustration } from "./hero-illustration";

type Greeting = "greetingMorning" | "greetingAfternoon" | "greetingEvening";

const noopSubscribe = () => () => {};

function greetingForNow(): Greeting {
  const hour = new Date().getHours();
  if (hour < 12) return "greetingMorning";
  if (hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}

/**
 * Hero da home (identidade "Etiqueta"): cartão Céu com o selo da rota PY → BR, a saudação em
 * Bricolage 800, a pill do CEP (leva aos endereços) e a ilustração da Ponte da Amizade — à direita
 * a partir de md, embaixo no mobile. Marca, busca e carrinho ficam no Header.
 */
export function HomeHero() {
  const t = useTranslations("home");
  // Saudação e CEP só existem no cliente: no servidor renderiza o fallback curto e evita mismatch.
  const greeting = useSyncExternalStore(noopSubscribe, greetingForNow, () => null);
  const storedCep = useSyncExternalStore(noopSubscribe, readStoredCep, () => "");
  const cep = storedCep ? formatCep(storedCep) : "";

  return (
    <section aria-label={t("heroLabel")} className="pt-4 md:pt-6">
      <PageContainer>
        <div className="flex flex-col overflow-hidden rounded-xl bg-brand-ceu md:min-h-50 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-col items-start gap-3 p-5 pb-0 md:py-8 md:pr-0 md:pl-10">
            <span className="inline-flex h-8 items-center gap-2 rounded-full bg-surface pr-3 pl-2 text-caption font-semibold text-foreground">
              <FlagPY className="rounded-[3px]" />
              <ArrowRight className="size-3.5" strokeWidth={2.5} aria-hidden />
              <FlagBR className="rounded-[3px]" />
              <span className="truncate">{t("routeBadge")}</span>
            </span>
            <h1 className="font-heading text-hero text-foreground md:text-hero-lg">
              {greeting ? t(greeting) : t("greetingFallback")}
            </h1>
            <Link
              href="/conta/enderecos"
              className="inline-flex h-11 max-w-full min-w-0 pressable items-center gap-2 rounded-full bg-surface pr-3 pl-3.5 text-body-sm font-semibold text-foreground focus-ring"
            >
              <MapPin
                className="size-4.5 shrink-0 text-brand-coral-strong"
                strokeWidth={2.25}
                aria-hidden
              />
              <span className="truncate">{cep ? t("deliverTo", { place: cep }) : t("setCep")}</span>
              <ChevronRight className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
          <HeroIllustration className="mt-1 w-full md:mt-0 md:w-1/2 md:self-end lg:w-[520px]" />
        </div>
      </PageContainer>
    </section>
  );
}
