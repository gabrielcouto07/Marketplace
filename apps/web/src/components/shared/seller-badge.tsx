import type { SellerMetricsDto, SellerSummaryDto } from "@marketplace/contracts";
import { BadgeCheck, Clock } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { initials } from "@/lib/palette";
import { cn } from "@/lib/utils";

/** Tom semântico do nível (1–2 atenção, 3 aviso, 4–5 ok). */
function levelTone(level: SellerSummaryDto["reputationLevel"]): "danger" | "warning" | "success" {
  if (level <= 2) return "danger";
  if (level === 3) return "warning";
  return "success";
}

const TONE_BAR = {
  danger: "bg-danger",
  warning: "bg-warning",
  success: "bg-success",
} as const;

/** Reputação em barra: cinco segmentos preenchidos até o nível, na cor semântica do nível. */
export function ReputationMeter({
  level,
  className,
}: {
  level: SellerSummaryDto["reputationLevel"];
  className?: string;
}) {
  const t = useTranslations("seller");
  const tone = levelTone(level);
  return (
    <span
      className={cn("flex items-center gap-1", className)}
      role="img"
      aria-label={t("reputationLevel", { level })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 flex-1 rounded-full",
            i <= level ? TONE_BAR[tone] : "bg-border-strong",
          )}
        />
      ))}
    </span>
  );
}

const AVATAR_SIZES = {
  sm: "size-8 text-caption",
  md: "size-10 text-body-sm",
  lg: "size-12 text-body",
  xl: "size-16 text-title-2 ring-4 ring-surface",
} as const;

/** Avatar da loja: logo quando existe; senão iniciais em primary sobre primary-soft. */
export function SellerAvatar({
  seller,
  size = "md",
  className,
}: {
  seller: Pick<SellerSummaryDto, "name" | "slug" | "logoUrl">;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary",
        AVATAR_SIZES[size],
        className,
      )}
    >
      {seller.logoUrl ? (
        <Image src={seller.logoUrl} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        initials(seller.name)
      )}
    </span>
  );
}

/** Selo de loja oficial (ícone azul). */
export function OfficialBadge({ className }: { className?: string }) {
  const t = useTranslations("seller");
  return (
    <BadgeCheck
      className={cn("size-4 shrink-0 fill-primary text-surface", className)}
      strokeWidth={1.75}
      aria-label={t("officialStore")}
    />
  );
}

interface SellerBadgeProps {
  seller: SellerSummaryDto;
  /** `inline`: texto discreto · `pill`: chip azul-suave com selo · `card`: card de confiança da loja. */
  variant?: "inline" | "pill" | "card";
  /** Indicadores da loja (envios no prazo, resposta) — só no `card`. */
  metrics?: Pick<SellerMetricsDto, "onTimeShippingPercent" | "avgResponseTimeHours"> | null;
  className?: string;
}

/**
 * Identidade da loja (DESIGN.md › Confiança): nome + selo oficial; no `card`, avatar, cidade,
 * reputação em barra com rótulo e tempo de envio. Sempre linka para /loja/[slug].
 */
export function SellerBadge({ seller, variant = "inline", metrics, className }: SellerBadgeProps) {
  const t = useTranslations("seller");
  const tt = useTranslations("trust");
  const href = `/loja/${seller.slug}`;

  if (variant === "inline") {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex min-w-0 items-center gap-1 rounded-sm text-caption text-foreground-muted focus-ring transition-colors hover:text-primary",
          className,
        )}
      >
        <span className="truncate">{seller.name}</span>
        {seller.isOfficialStore ? <OfficialBadge className="size-3.5" /> : null}
      </Link>
    );
  }

  if (variant === "pill") {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex h-8 max-w-full pressable items-center gap-1.5 rounded-full bg-primary-soft px-3 text-caption font-medium text-primary focus-ring transition-colors hover:bg-primary/15",
          className,
        )}
      >
        {seller.isOfficialStore ? (
          <BadgeCheck
            className="size-4 shrink-0"
            strokeWidth={1.75}
            aria-label={t("officialStore")}
          />
        ) : null}
        <span className="truncate">{seller.name}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex pressable flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs focus-ring transition-shadow hover:shadow-sm",
        className,
      )}
    >
      <span className="flex items-center gap-3">
        <SellerAvatar seller={seller} />
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-body-sm font-semibold text-foreground">
              {seller.name}
            </span>
            {seller.isOfficialStore ? <OfficialBadge /> : null}
          </span>
          <span className="text-caption text-foreground-muted">
            {t("location", { city: seller.city })}
          </span>
        </span>
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-caption">
          <span className="text-foreground-secondary">{tt("reputationLabel")}</span>
          <span className="font-medium text-foreground">
            {t(`reputationLabels.${seller.reputationLevel}`)}
          </span>
        </span>
        <ReputationMeter level={seller.reputationLevel} />
      </span>
      <span className="flex items-center justify-between gap-2 text-caption text-foreground-secondary">
        {metrics ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5 text-foreground-muted" strokeWidth={1.75} aria-hidden />
            {tt("onTimeShort", { percent: metrics.onTimeShippingPercent })}
          </span>
        ) : (
          <span />
        )}
        <span className="font-medium text-primary">{t("viewStore")}</span>
      </span>
    </Link>
  );
}
