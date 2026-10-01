import { cva } from "class-variance-authority";
import { useTranslations } from "next-intl";

import { BrandLogo } from "@/components/layout/brand-logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** `dark`: sobre a barra Marinho (padrão do header) · `light`: sobre superfície clara. */
  tone?: "light" | "dark";
  /** `md`: header desktop (logo 40) · `sm`: header mobile e painéis (logo 36). */
  size?: "sm" | "md";
  /** Esconde o wordmark e deixa só o símbolo. */
  compact?: boolean;
  className?: string;
}

const LOGO_SIZE = { sm: 36, md: 40 } as const;

const nameVariants = cva("font-heading leading-none font-extrabold tracking-[-0.02em]", {
  variants: {
    size: { sm: "text-title-3", md: "text-title-2" },
    tone: { light: "text-foreground", dark: "text-white" },
  },
});

const lineVariants = cva("text-caption leading-none font-bold tracking-[0.22em] uppercase", {
  variants: {
    tone: { light: "text-primary", dark: "text-brand-amarelo" },
  },
});

/**
 * Lockup da marca: logo + wordmark em duas linhas ("Paraguai" em Bricolage 800 / "IMPORTS" em
 * caixa alta espaçada, Amarelo sobre o Marinho). Sempre linka para a home (DESIGN.md › Apêndice A).
 */
export function BrandMark({ tone = "dark", size = "md", compact, className }: BrandMarkProps) {
  const t = useTranslations("common");
  const onDark = tone === "dark";
  return (
    <Link
      href="/"
      aria-label={t("siteName")}
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-sm p-1",
        onDark ? "link-on-deep" : "focus-ring",
        className,
      )}
    >
      <BrandLogo size={compact ? 32 : LOGO_SIZE[size]} />
      {compact ? null : (
        <span className="flex flex-col gap-1">
          <span className={nameVariants({ size, tone })}>{t("brandLine1")}</span>
          <span className={lineVariants({ tone })}>{t("brandLine2")}</span>
        </span>
      )}
    </Link>
  );
}
