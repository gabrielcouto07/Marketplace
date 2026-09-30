import { cva } from "class-variance-authority";
import { useTranslations } from "next-intl";

import { BrandLogo } from "@/components/layout/brand-logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** `light`: sobre superfície clara · `dark`: sobre brand-deep (texto claro). O logo é o mesmo. */
  tone?: "light" | "dark";
  /** `md`: header desktop (logo 48) · `sm`: header mobile e painéis (logo 44). */
  size?: "sm" | "md";
  /** Esconde o wordmark e deixa só o símbolo. */
  compact?: boolean;
  className?: string;
}

const LOGO_SIZE = { sm: 44, md: 48 } as const;

const nameVariants = cva("font-heading leading-none font-extrabold tracking-[-0.02em]", {
  variants: {
    size: { sm: "text-title-2", md: "text-title-1" },
    tone: { light: "text-foreground", dark: "text-white" },
  },
});

/**
 * Lockup da marca: logo A + wordmark em duas linhas ("MARKETPLACE" em caixa alta espaçada /
 * "Paraguai" em Bricolage 800). Sempre linka para a home (DESIGN.md › Apêndice A).
 */
export function BrandMark({ tone = "light", size = "md", compact, className }: BrandMarkProps) {
  const t = useTranslations("common");
  const onDark = tone === "dark";
  return (
    <Link
      href="/"
      aria-label={t("siteName")}
      className={cn("flex shrink-0 items-center gap-3 rounded-md focus-ring", className)}
    >
      <BrandLogo size={compact ? 32 : LOGO_SIZE[size]} />
      {compact ? null : (
        <span className="flex flex-col gap-1">
          <span
            className={cn(
              "text-caption leading-none font-bold tracking-[0.16em] uppercase",
              onDark ? "text-white/70" : "text-foreground-secondary",
            )}
          >
            {t("brandLine1")}
          </span>
          <span className={nameVariants({ size, tone })}>{t("brandLine2")}</span>
        </span>
      )}
    </Link>
  );
}
