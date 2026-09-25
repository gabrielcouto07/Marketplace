"use client";

import {
  CheckCircle2,
  Download,
  Monitor,
  MoreVertical,
  PlusSquare,
  Share,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { usePwa } from "@/components/layout/pwa-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Steps({
  title,
  icon: Icon,
  steps,
  highlight,
  delay = 0,
}: {
  title: string;
  icon: LucideIcon;
  steps: string[];
  highlight?: boolean;
  delay?: number;
}) {
  return (
    <section
      className={cn(
        "flex animate-rise flex-col gap-3 rounded-3xl bg-card p-4 shadow-card",
        highlight && "ring-2 ring-primary",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <h2 className="flex items-center gap-2.5 text-[15px] font-extrabold">
        <span
          className={cn(
            "flex size-[38px] shrink-0 items-center justify-center rounded-md",
            highlight ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
          )}
        >
          <Icon className="size-[18px]" aria-hidden />
        </span>
        {title}
      </h2>
      <ol className="flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-body">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-[8px] bg-surface-strong text-xs font-extrabold text-foreground tabular-nums"
              aria-hidden
            >
              {i + 1}
            </span>
            <span>{step}</span>
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
    <PageContainer className="flex flex-col gap-3 py-4">
      <section className="relative flex animate-rise flex-col items-center gap-3 overflow-hidden rounded-3xl bg-header p-6 text-center text-header-foreground shadow-card">
        <span
          aria-hidden
          className="absolute -top-[70px] -right-[60px] size-[200px] rounded-full bg-white/[0.08]"
        />
        <span
          aria-hidden
          className="absolute -bottom-[80px] -left-[40px] size-[160px] rounded-full bg-white/[0.06]"
        />
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={72}
          height={72}
          className="relative size-[72px] rounded-2xl shadow-float"
        />
        <h1 className="relative text-[22px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
        <p className="relative max-w-md text-[13.5px] leading-relaxed text-brand-blue-200">
          {t("intro")}
        </p>
        {isStandalone ? (
          <p
            role="status"
            className="relative flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold"
          >
            <CheckCircle2 className="size-4" aria-hidden /> {t("alreadyInstalled")}
          </p>
        ) : canPrompt ? (
          <Button
            variant="cta"
            size="lg"
            className="relative"
            onClick={async () => {
              const result = await promptInstall();
              if (result === "accepted") toast.success(t("alreadyInstalled"));
            }}
          >
            <Download data-icon="inline-start" /> {t("installNow")}
          </Button>
        ) : null}
      </section>

      <div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:items-start">
        <Steps
          title={t("androidTitle")}
          icon={MoreVertical}
          steps={androidSteps}
          highlight={!isIos && !isStandalone && canPrompt}
          delay={40}
        />
        <Steps
          title={t("iosTitle")}
          icon={Share}
          steps={iosSteps}
          highlight={isIos && !isStandalone}
          delay={80}
        />
        <Steps title={t("desktopTitle")} icon={Monitor} steps={desktopSteps} delay={120} />
      </div>

      <p className="flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <PlusSquare className="size-4" aria-hidden /> {tPwa("androidHint")}
      </p>
    </PageContainer>
  );
}
