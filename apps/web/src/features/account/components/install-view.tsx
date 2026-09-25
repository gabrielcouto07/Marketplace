"use client";

import { CheckCircle2, Download, Monitor, MoreVertical, PlusSquare, Share, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { usePwa } from "@/components/layout/pwa-provider";
import { Button } from "@/components/ui/button";

function Steps({ title, icon: Icon, steps, highlight }: { title: string; icon: LucideIcon; steps: string[]; highlight?: boolean }) {
  return (
    <section className={`rounded-2xl border bg-card p-4 ${highlight ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        {title}
      </h2>
      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden>
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function InstallView() {
  const t = useTranslations("pwa.installPage");
  const tPwa = useTranslations("pwa");
  const { canPrompt, isIos, isStandalone, promptInstall } = usePwa();

  const androidSteps = t.raw("androidSteps") as string[];
  const iosSteps = t.raw("iosSteps") as string[];
  const desktopSteps = t.raw("desktopSteps") as string[];

  return (
    <PageContainer className="flex flex-col gap-4 py-4">
      <section className="flex flex-col items-center gap-3 rounded-2xl bg-header p-6 text-center text-header-foreground">
        <Image src="/icons/icon-192.png" alt="" width={72} height={72} className="size-18 rounded-2xl shadow-lg" />
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <p className="text-sm text-white/85">{t("intro")}</p>
        {isStandalone ? (
          <p role="status" className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium">
            <CheckCircle2 className="size-4" aria-hidden /> {t("alreadyInstalled")}
          </p>
        ) : canPrompt ? (
          <Button
            variant="cta"
            size="lg"
            onClick={async () => {
              const result = await promptInstall();
              if (result === "accepted") toast.success(t("alreadyInstalled"));
            }}
          >
            <Download data-icon="inline-start" /> {t("installNow")}
          </Button>
        ) : null}
      </section>

      <Steps title={t("androidTitle")} icon={MoreVertical} steps={androidSteps} highlight={!isIos && !isStandalone && canPrompt} />
      <Steps title={t("iosTitle")} icon={Share} steps={iosSteps} highlight={isIos && !isStandalone} />
      <Steps title={t("desktopTitle")} icon={Monitor} steps={desktopSteps} />

      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <PlusSquare className="size-4" aria-hidden /> {tPwa("androidHint")}
      </p>
    </PageContainer>
  );
}
