"use client";

import { BadgeCheck, FileText, Landmark, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/store-shell";
import { TaxBreakdown, TaxBreakdownSkeleton } from "@/components/shared/tax-breakdown";
import { RemessaConformeBadge, RemessaConformeEmblem } from "@/components/shared/trust-badge";
import { useTaxEstimate } from "@/features/compliance/api";
import { env } from "@/lib/env";

const EXAMPLE_AMOUNT = 20000;

/**
 * "Como funcionam os impostos": o que o comprador paga, discriminado, e por que não há cobrança na entrega. Com a
 * certificação (ou em simulação) mostra o selo e o número do ADE.
 */
export function RemessaConformeView() {
  const t = useTranslations("remessaConformePage");
  const example = useTaxEstimate(EXAMPLE_AMOUNT);
  const steps = [
    { icon: Landmark, title: t("step1Title"), text: t("step1Text") },
    { icon: FileText, title: t("step2Title"), text: t("step2Text") },
    { icon: Truck, title: t("step3Title"), text: t("step3Text") },
    { icon: PackageCheck, title: t("step4Title"), text: t("step4Text") },
  ];

  return (
    <PageContainer className="flex max-w-3xl flex-col gap-6 py-6">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-xs md:flex-row md:items-center">
        <RemessaConformeEmblem className="size-16" />
        <div className="flex flex-col gap-1">
          <h1 className="text-title-1 text-foreground">{t("title")}</h1>
          <p className="text-body text-foreground-secondary">{t("intro")}</p>
          {env.remessaConforme && env.remessaConformeAde ? (
            <p className="flex items-center gap-1.5 text-body-sm font-medium text-success">
              <BadgeCheck className="size-4" strokeWidth={2} aria-hidden />
              {t("certified", { ade: env.remessaConformeAde })}
            </p>
          ) : null}
        </div>
      </section>

      {env.remessaConforme ? <RemessaConformeBadge variant="card" /> : null}

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-title-3 text-foreground">{t("howTitle")}</h2>
        <ol className="grid gap-4 md:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <s.icon className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-body-sm font-medium text-foreground">
                  {i + 1}. {s.title}
                </span>
                <span className="text-caption text-foreground-secondary">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs">
        <h2 className="text-title-3 text-foreground">{t("exampleTitle")}</h2>
        <p className="text-body-sm text-foreground-secondary">{t("exampleIntro")}</p>
        {example.data ? <TaxBreakdown taxes={example.data} withoutFreight /> : <TaxBreakdownSkeleton />}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs">
        <h2 className="flex items-center gap-2 text-title-3 text-foreground">
          <ShieldCheck className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
          {t("sellersTitle")}
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body-sm text-foreground-secondary">
          <li>{t("sellers1")}</li>
          <li>{t("sellers2")}</li>
          <li>{t("sellers3")}</li>
          <li>{t("sellers4")}</li>
        </ul>
      </section>
    </PageContainer>
  );
}
