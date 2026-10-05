import type { DayRange, Money } from "@marketplace/contracts";
import { CalendarClock, Landmark, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Elementos de confiança (DESIGN.md › Confiança). Bonitos, não burocráticos: ícone em círculo
 * azul-suave, título em peso 500 e uma linha explicando o que aquilo significa.
 */

interface TrustRowProps {
  icon?: typeof ShieldCheck;
  /** Substitui o ícone em círculo (ex.: o emblema do selo Remessa Conforme). */
  media?: ReactNode;
  title: string;
  hint?: string;
  trailing?: string;
  /** `inline`: linha compacta (cards) · `card`: com borda e respiro (PDP, checkout). */
  variant?: "inline" | "card";
  className?: string;
}

function TrustRow({
  icon: Icon,
  media,
  title,
  hint,
  trailing,
  variant = "inline",
  className,
}: TrustRowProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3",
        variant === "card" && "rounded-lg border border-border bg-surface p-4 shadow-xs",
        className,
      )}
    >
      {media ?? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          {Icon ? <Icon className="size-5" strokeWidth={1.75} aria-hidden /> : null}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-body-sm font-medium text-foreground">{title}</span>
          {trailing ? (
            <span className="shrink-0 text-body-sm font-medium text-foreground tabular-nums">
              {trailing}
            </span>
          ) : null}
        </span>
        {hint ? <span className="text-caption text-foreground-secondary">{hint}</span> : null}
      </span>
    </div>
  );
}

/** "Compra garantida" com escudo. */
export function GuaranteeBadge({
  variant,
  className,
}: {
  variant?: TrustRowProps["variant"];
  className?: string;
}) {
  const t = useTranslations("trust");
  return (
    <TrustRow
      icon={ShieldCheck}
      title={t("guaranteedTitle")}
      hint={t("guaranteedHint")}
      variant={variant}
      className={className}
    />
  );
}

/** Linha de impostos de importação estimados: sempre visível no checkout, com o valor e a alíquota. */
export function ImportTaxLine({
  amount,
  ratePercent,
  final,
  variant,
  className,
}: {
  amount: Money;
  /** Alíquota em %, ex.: 60. */
  ratePercent?: number;
  /** Valor definitivo do Remessa Conforme (cobrado na compra), e não estimativa. */
  final?: boolean;
  variant?: TrustRowProps["variant"];
  className?: string;
}) {
  const t = useTranslations("trust");
  const base = final ? t("importTaxHintFinal") : t("importTaxHint");
  const hint = ratePercent !== undefined ? `${base} ${t("importTaxRate", { rate: `${ratePercent}%` })}` : base;
  return (
    <TrustRow
      icon={Landmark}
      title={final ? t("importTaxLabelFinal") : t("importTaxLabel")}
      hint={hint}
      trailing={formatMoney(amount)}
      variant={variant}
      className={className}
    />
  );
}

/** Prazo em faixa de dias úteis. */
export function DeliveryWindow({
  range,
  variant,
  className,
}: {
  range: DayRange;
  variant?: TrustRowProps["variant"];
  className?: string;
}) {
  const t = useTranslations("trust");
  const tc = useTranslations("common");
  return (
    <TrustRow
      icon={CalendarClock}
      title={t("deliveryLabel")}
      hint={t("deliveryHint")}
      trailing={tc("businessDays", { min: range.min, max: range.max })}
      variant={variant}
      className={className}
    />
  );
}

/** 12 recortes em volta do disco: a borda serrilhada de selo. */
const SEAL_SCALLOPS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * Math.PI) / 6;
  return { cx: (24 + 18 * Math.cos(angle)).toFixed(2), cy: (24 + 18 * Math.sin(angle)).toFixed(2) };
});

/** Emblema do selo Remessa Conforme: disco serrilhado Verde, anel pontilhado e check em Tinta. */
export function RemessaConformeEmblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("size-10 shrink-0", className)}>
      <g className="fill-brand-verde">
        <circle cx="24" cy="24" r="18" />
        {SEAL_SCALLOPS.map((s) => (
          <circle key={`${s.cx}-${s.cy}`} cx={s.cx} cy={s.cy} r="5" />
        ))}
      </g>
      <g fill="none" className="stroke-on-bright" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="24" cy="24" r="14" strokeWidth="1.5" strokeDasharray="1.5 3" />
        <path d="M17.5 24.5l4.5 4.5 9-9.5" strokeWidth="3" />
      </g>
    </svg>
  );
}

interface RemessaConformeProps {
  /** Mostra mesmo sem NEXT_PUBLIC_REMESSA_CONFORME (só o styleguide `/design`). */
  preview?: boolean;
  className?: string;
}

const showSeal = (preview?: boolean) => env.remessaConforme || Boolean(preview);

/** Etiqueta "Simulação" que acompanha o selo enquanto a empresa não tem o ADE (NEXT_PUBLIC_REMESSA_CONFORME=simulacao). */
export function SimulationTag({ onDark, className }: { onDark?: boolean; className?: string }) {
  const t = useTranslations("trust");
  if (env.remessaConformeMode !== "simulacao") return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-sm px-1.5 text-caption font-bold uppercase",
        onDark ? "bg-white/15 text-white" : "bg-warning-soft text-warning",
        className,
      )}
    >
      {t("simulationTag")}
    </span>
  );
}

type Tier = "ouro" | "prata" | "bronze";

const TIER_FILL: Record<Tier, string> = {
  ouro: "fill-selo-ouro",
  prata: "fill-selo-prata",
  bronze: "fill-selo-bronze",
};

/** Medalha da faixa (Ouro, Prata, Bronze) do monitoramento de conformidade — Portaria Coana 193/2026. */
export function ComplianceMedal({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <svg viewBox="0 0 32 40" aria-hidden className={cn("h-8 w-6.5 shrink-0", className)}>
      <path d="M8 22 4 38l7-4 5 6 2-15z" className="fill-brand-azul" />
      <path d="M24 22l4 16-7-4-5 6-2-15z" className="fill-brand-vermelho" />
      <circle cx="16" cy="15" r="13" className={TIER_FILL[tier]} />
      <circle cx="16" cy="15" r="9.5" fill="none" className="stroke-on-bright/40" strokeWidth="1.2" />
      <path d="m16 8.5 1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" className="fill-on-bright/70" />
    </svg>
  );
}

function useTierLabel(): string | null {
  const t = useTranslations("trust");
  const tier = env.remessaConformeSelo;
  if (!tier) return null;
  const name = t(`tier.${tier}`);
  return env.remessaConformeCiclo ? t("tierWithCycle", { tier: name, cycle: env.remessaConformeCiclo }) : name;
}

/**
 * Selo Remessa Conforme na lista de confiança (PDP, resumo do checkout): emblema + o que o programa garante.
 * Some sozinho enquanto a loja não for certificada (`env.remessaConforme`).
 */
export function RemessaConformeBadge({
  variant,
  preview,
  className,
}: RemessaConformeProps & { variant?: TrustRowProps["variant"] }) {
  const t = useTranslations("trust");
  const tierLabel = useTierLabel();
  if (!showSeal(preview)) return null;
  return (
    <TrustRow
      media={<RemessaConformeEmblem />}
      title={t("remessaConformeTitle")}
      hint={tierLabel ? `${t("remessaConformeHint")} ${tierLabel}.` : t("remessaConformeHint")}
      trailing={env.remessaConformeMode === "simulacao" ? t("simulationTag") : undefined}
      variant={variant}
      className={className}
    />
  );
}

/** Selo compacto para o rodapé Marinho: emblema, nome do programa e o número do ADE quando houver. */
export function RemessaConformeSeal({ preview, className }: RemessaConformeProps) {
  const t = useTranslations("trust");
  const tierLabel = useTierLabel();
  if (!showSeal(preview)) return null;
  return (
    <div className={cn("flex items-center gap-3 text-left", className)}>
      <RemessaConformeEmblem />
      <span className="flex flex-col">
        <span className="flex items-center gap-2 text-body-sm font-bold text-white">
          {t("remessaConformeTitle")}
          <SimulationTag onDark />
        </span>
        <span className="text-caption text-white/80">
          {env.remessaConformeAde
            ? t("remessaConformeAde", { number: env.remessaConformeAde })
            : t("remessaConformeProgram")}
        </span>
      </span>
      {env.remessaConformeSelo ? (
        <span className="flex items-center gap-1.5">
          <ComplianceMedal tier={env.remessaConformeSelo} />
          <span className="text-caption font-bold text-white">{tierLabel}</span>
        </span>
      ) : null}
    </div>
  );
}

/**
 * Selo no header Marinho. `bar`: ao lado da marca na barra desktop (emblema + "Remessa Conforme" + "Impostos pagos
 * na compra" e a medalha da faixa); `strip`: faixa fina sob a busca na home mobile. Leva à página que explica os
 * impostos do programa.
 */
export function RemessaConformeHeaderSeal({
  variant,
  preview,
  className,
}: RemessaConformeProps & { variant: "bar" | "strip" }) {
  const t = useTranslations("trust");
  const tierLabel = useTierLabel();
  if (!showSeal(preview)) return null;
  const tier = env.remessaConformeSelo;

  if (variant === "strip") {
    return (
      <Link
        href="/remessa-conforme"
        aria-label={t("headerSealLabel")}
        className={cn(
          "flex h-9 items-center gap-2 border-t border-white/10 bg-brand-deep-raised px-4 text-caption text-white/90 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-amarelo",
          className,
        )}
      >
        <RemessaConformeEmblem className="size-5" />
        <span className="min-w-0 truncate">
          <span className="font-bold text-white">{t("remessaConformeTitle")}</span> · {t("remessaConformeStrip")}
        </span>
        {tier ? <ComplianceMedal tier={tier} className="ml-auto h-6 w-5" /> : null}
        <SimulationTag onDark className={tier ? "" : "ml-auto"} />
      </Link>
    );
  }

  return (
    <Link
      href="/remessa-conforme"
      aria-label={t("headerSealLabel")}
      className={cn("flex h-12 shrink-0 items-center gap-2 rounded-sm px-2 link-on-deep", className)}
    >
      <RemessaConformeEmblem className="size-9" />
      <span className="flex flex-col">
        <span className="flex items-center gap-1.5 text-body-sm leading-tight font-bold">
          {t("remessaConformeTitle")}
          <SimulationTag onDark />
        </span>
        <span className="text-caption leading-tight text-white/80">{tierLabel ?? t("remessaConformeShort")}</span>
      </span>
      {tier ? <ComplianceMedal tier={tier} className="ml-0.5" /> : null}
    </Link>
  );
}
