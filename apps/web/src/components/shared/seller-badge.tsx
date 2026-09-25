import type { SellerSummaryDto } from "@marketplace/contracts";
import { BadgeCheck, MapPin } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<SellerSummaryDto["reputationLevel"], string> = {
  1: "bg-brand-red-500",
  2: "bg-orange-500",
  3: "bg-amber-400",
  4: "bg-lime-500",
  5: "bg-success",
};

/** Termômetro de reputação (1–5), estilo marketplace. */
export function ReputationMeter({ level, className }: { level: SellerSummaryDto["reputationLevel"]; className?: string }) {
  const t = useTranslations("seller");
  return (
    <span className={cn("flex items-center gap-0.5", className)} role="img" aria-label={t("reputationLevel", { level })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn("h-1.5 w-4 rounded-sm first:rounded-l-full last:rounded-r-full", i <= level ? LEVEL_COLORS[level] : "bg-neutral-200")}
        />
      ))}
    </span>
  );
}

interface SellerBadgeProps {
  seller: SellerSummaryDto;
  variant?: "inline" | "card";
  className?: string;
}

/** Nome da loja + selo oficial + reputação + cidade. Sempre linka para /loja/[slug]. */
export function SellerBadge({ seller, variant = "inline", className }: SellerBadgeProps) {
  const t = useTranslations("seller");
  if (variant === "inline") {
    return (
      <Link href={`/loja/${seller.slug}`} className={cn("inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-primary", className)}>
        <span className="truncate">{seller.name}</span>
        {seller.isOfficialStore ? <BadgeCheck className="size-3.5 shrink-0 text-primary" aria-label={t("officialStore")} /> : null}
      </Link>
    );
  }
  return (
    <Link
      href={`/loja/${seller.slug}`}
      className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent/40", className)}
    >
      <Image src={seller.logoUrl ?? "/logo.svg"} alt="" width={44} height={44} className="size-11 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 font-semibold">
          <span className="truncate">{seller.name}</span>
          {seller.isOfficialStore ? <BadgeCheck className="size-4 shrink-0 text-primary" aria-label={t("officialStore")} /> : null}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" aria-hidden /> {seller.city}, PY
        </p>
        <ReputationMeter level={seller.reputationLevel} className="mt-1.5" />
      </div>
    </Link>
  );
}
