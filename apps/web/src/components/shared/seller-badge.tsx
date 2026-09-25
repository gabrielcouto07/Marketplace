import type { SellerSummaryDto } from "@marketplace/contracts";
import { BadgeCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { initials, sellerColor } from "@/lib/palette";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<SellerSummaryDto["reputationLevel"], string> = {
  1: "bg-cta",
  2: "bg-orange-500",
  3: "bg-amber-400",
  4: "bg-lime-500",
  5: "bg-success",
};

/** Termômetro de reputação (1–5): cinco segmentos, preenchidos até o nível na cor do nível. */
export function ReputationMeter({
  level,
  className,
}: {
  level: SellerSummaryDto["reputationLevel"];
  className?: string;
}) {
  const t = useTranslations("seller");
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
            i <= level ? LEVEL_COLORS[level] : "bg-surface-strong",
          )}
        />
      ))}
    </span>
  );
}

const AVATAR_SIZES = {
  sm: "size-[34px] rounded-[11px] text-xs",
  md: "size-[46px] rounded-[15px] text-[15px]",
  lg: "size-[50px] rounded-2xl text-base",
  xl: "size-[76px] rounded-3xl text-2xl ring-[5px] ring-card",
} as const;

/** Avatar da loja: iniciais em branco sobre a cor de marca da loja (determinística pelo slug). */
export function SellerAvatar({
  seller,
  size = "md",
  className,
}: {
  seller: Pick<SellerSummaryDto, "name" | "slug">;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: sellerColor(seller.slug) }}
      className={cn(
        "flex shrink-0 items-center justify-center font-extrabold text-white",
        AVATAR_SIZES[size],
        className,
      )}
    >
      {initials(seller.name)}
    </span>
  );
}

/** Selo de loja verificada (ícone azul). */
export function OfficialBadge({ className }: { className?: string }) {
  const t = useTranslations("seller");
  return (
    <BadgeCheck
      className={cn("size-4 shrink-0 fill-primary text-card", className)}
      aria-label={t("officialStore")}
    />
  );
}

interface SellerBadgeProps {
  seller: SellerSummaryDto;
  /** `inline`: texto discreto · `pill`: pílula azul-suave com selo · `card`: card de loja em destaque. */
  variant?: "inline" | "pill" | "card";
  className?: string;
}

/** Nome da loja + selo oficial (+ reputação/cidade no card). Sempre linka para /loja/[slug]. */
export function SellerBadge({ seller, variant = "inline", className }: SellerBadgeProps) {
  const t = useTranslations("seller");
  const href = `/loja/${seller.slug}`;

  if (variant === "inline") {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary",
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
          "inline-flex max-w-full pressable items-center gap-1.5 rounded-full bg-accent py-1.5 pr-3 pl-2 text-[12.5px] font-bold text-accent-foreground hover:bg-brand-blue-100",
          className,
        )}
      >
        {seller.isOfficialStore ? (
          <BadgeCheck
            className="size-4 shrink-0"
            strokeWidth={2.2}
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
        "flex pressable flex-col gap-3 rounded-2xl bg-card p-3.5 shadow-card transition-shadow hover:shadow-float",
        className,
      )}
    >
      <span className="flex items-center gap-2.5">
        <SellerAvatar seller={seller} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold">{seller.name}</span>
            {seller.isOfficialStore ? <OfficialBadge /> : null}
          </span>
          <span className="text-xs text-muted-foreground">{seller.city}</span>
        </span>
      </span>
      <ReputationMeter level={seller.reputationLevel} />
      <span className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t(`reputationLabels.${seller.reputationLevel}`)}</span>
        <span className="font-bold text-primary">{t("viewStore")}</span>
      </span>
    </Link>
  );
}
