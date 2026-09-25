"use client";

import { ChevronRight, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { PageContainer } from "@/components/layout/store-shell";
import { TricolorStripe } from "@/components/layout/tricolor-stripe";
import { readStoredCep } from "@/components/shared/cep-shipping-calculator";
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
 * Faixa curta da home sobre brand-deep (DESIGN.md › brand-deep + assinatura tricolor):
 * saudação pela hora do dia, linha de entrega com o CEP salvo (leva aos endereços) e a sacola
 * da marca à direita. Marca, busca e carrinho ficam no Header, então aqui não se repetem.
 */
export function HomeHero() {
  const t = useTranslations("home");
  // Saudação e CEP só existem no cliente: no servidor renderiza null/"" e evita mismatch.
  const greeting = useSyncExternalStore(noopSubscribe, greetingForNow, () => null);
  const storedCep = useSyncExternalStore(noopSubscribe, readStoredCep, () => "");
  const cep = storedCep ? formatCep(storedCep) : "";

  return (
    <section aria-label={t("heroLabel")} className="bg-brand-deep text-white">
      <TricolorStripe />
      <PageContainer className="flex items-center justify-between gap-4 py-6">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-title-2" title={t("greetingHint")}>
            {greeting ? t(greeting) : t("greetingHint")}
          </p>
          <Link
            href="/conta/enderecos"
            className="inline-flex min-w-0 items-center gap-1 self-start rounded-sm text-body-sm text-blue-300 focus-ring transition-colors hover:text-white"
          >
            <MapPin className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="truncate">{cep ? t("deliverTo", { place: cep }) : t("setCep")}</span>
            <ChevronRight className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
        <BrandLogo size={40} className="opacity-90" />
      </PageContainer>
    </section>
  );
}
