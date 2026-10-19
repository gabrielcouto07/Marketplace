import { useTranslations } from "next-intl";

import { BrandLogo } from "@/components/layout/brand-logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** `dark`: sobre a barra do header ou o Marinho (padrão) · `light`: sobre superfície clara. Muda só o foco. */
  tone?: "light" | "dark";
  /** `md`: header desktop (56 px) · `sm`: header mobile e rodapé (44 px). */
  size?: "sm" | "md";
  /** Só a sacola (36 px), sem o wordmark: páginas internas no mobile e painéis. */
  compact?: boolean;
  className?: string;
}

const HEIGHT = { sm: 44, md: 56 } as const;

/**
 * A marca no topo e no rodapé: a logo da folha da marca (sacola + "Mania Paraguai" branco com contorno
 * Marinho, fundo transparente), igual em qualquer fundo. Sempre linka para a home.
 */
export function BrandMark({ tone = "dark", size = "md", compact, className }: BrandMarkProps) {
  const t = useTranslations("common");
  return (
    <Link
      href="/"
      aria-label={t("siteName")}
      className={cn(
        "flex shrink-0 items-center rounded-sm p-1",
        tone === "dark" ? "link-on-deep" : "focus-ring",
        className,
      )}
    >
      <BrandLogo
        variant={compact ? "symbol" : "logo"}
        height={compact ? 36 : HEIGHT[size]}
        priority={!compact && size === "md"}
      />
    </Link>
  );
}
