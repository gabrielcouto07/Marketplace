import { useTranslations } from "next-intl";

import { BrandLogo } from "@/components/layout/brand-logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** `light`: sobre superfície clara (ícone com tile navy) · `dark`: sobre brand-deep (só a sacola, texto branco). */
  tone?: "light" | "dark";
  /** Esconde o wordmark e deixa só o símbolo. */
  compact?: boolean;
  className?: string;
}

/**
 * Símbolo da marca + wordmark em duas linhas ("MARKETPLACE" / "Paraguai"). Sempre linka para a home.
 * Em superfícies claras o ícone aparece com o tile; sobre brand-deep, só a sacola (DESIGN.md › Apêndice A).
 */
export function BrandMark({ tone = "light", compact, className }: BrandMarkProps) {
  const t = useTranslations("common");
  const onDark = tone === "dark";
  return (
    <Link
      href="/"
      aria-label={t("siteName")}
      className={cn("flex shrink-0 items-center gap-2 rounded-sm focus-ring", className)}
    >
      <BrandLogo tile={!onDark} size={onDark ? 32 : 36} />
      {compact ? null : (
        <span className={cn("flex flex-col", onDark ? "text-white" : "text-foreground")}>
          <span
            className={cn(
              "text-caption leading-none font-medium tracking-[0.08em] uppercase",
              onDark ? "text-white/70" : "text-foreground-muted",
            )}
          >
            {t("brandLine1")}
          </span>
          <span className="text-title-3 leading-tight">{t("brandLine2")}</span>
        </span>
      )}
    </Link>
  );
}
