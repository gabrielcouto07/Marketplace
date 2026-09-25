"use client";

import { CheckCircle2, Download, Smartphone, WifiOff, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { BrandLogo } from "@/components/layout/brand-logo";
import { usePwa } from "@/components/layout/pwa-provider";
import { PageContainer } from "@/components/layout/store-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Platform = "android" | "ios" | "desktop";

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3 text-body-sm text-foreground-secondary">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-caption text-primary tabular-nums"
            aria-hidden
          >
            {i + 1}
          </span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export function InstallView() {
  const t = useTranslations("pwa.installPage");
  const tAccount = useTranslations("account");
  const tPwa = useTranslations("pwa");
  const { canPrompt, isIos, isStandalone, promptInstall } = usePwa();

  const androidSteps = t.raw("androidSteps") as string[];
  const iosSteps = t.raw("iosSteps") as string[];
  const desktopSteps = t.raw("desktopSteps") as string[];
  const defaultPlatform: Platform = isIos ? "ios" : "android";

  const benefits = [
    { icon: Zap, label: tAccount("installBenefitSpeed") },
    { icon: WifiOff, label: tAccount("installBenefitOffline") },
    { icon: Smartphone, label: tAccount("installBenefitHome") },
  ];

  return (
    <PageContainer className="flex flex-col gap-8 py-8">
      <section className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
        <BrandLogo tile size={72} />
        <p className="text-body text-foreground-secondary">{tPwa("androidHint")}</p>
        <ul className="flex w-full flex-col gap-3 text-left">
          {benefits.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-body text-foreground">
              <Icon className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
        {isStandalone ? (
          <p
            role="status"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-success-soft p-3 text-body-sm font-medium text-success"
          >
            <CheckCircle2 className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
            {t("alreadyInstalled")}
          </p>
        ) : (
          <Button
            variant="primary"
            fullWidth
            onClick={async () => {
              if (!canPrompt) {
                // Sem prompt nativo (iOS, desktop sem suporte): leva às instruções da plataforma.
                document.getElementById("install-steps")?.scrollIntoView({ behavior: "smooth" });
                return;
              }
              const result = await promptInstall();
              if (result === "accepted") toast.success(t("alreadyInstalled"));
            }}
          >
            <Download data-icon="inline-start" strokeWidth={1.75} /> {t("installNow")}
          </Button>
        )}
      </section>

      <Tabs
        id="install-steps"
        defaultValue={defaultPlatform}
        className="mx-auto w-full max-w-md scroll-mt-20"
      >
        <TabsList aria-label={t("title")}>
          <TabsTrigger value="android">{tAccount("installTabAndroid")}</TabsTrigger>
          <TabsTrigger value="ios">{tAccount("installTabIos")}</TabsTrigger>
          <TabsTrigger value="desktop">{tAccount("installTabDesktop")}</TabsTrigger>
        </TabsList>
        <TabsContent
          value="android"
          className="rounded-lg border border-border bg-surface p-4 shadow-xs"
        >
          <h2 className="mb-4 text-title-3 text-foreground">{t("androidTitle")}</h2>
          <StepList steps={androidSteps} />
        </TabsContent>
        <TabsContent
          value="ios"
          className="rounded-lg border border-border bg-surface p-4 shadow-xs"
        >
          <h2 className="mb-4 text-title-3 text-foreground">{t("iosTitle")}</h2>
          <StepList steps={iosSteps} />
        </TabsContent>
        <TabsContent
          value="desktop"
          className="rounded-lg border border-border bg-surface p-4 shadow-xs"
        >
          <h2 className="mb-4 text-title-3 text-foreground">{t("desktopTitle")}</h2>
          <StepList steps={desktopSteps} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
