import Image from "next/image";
import { useTranslations } from "next-intl";

import { LOGO_COLORS } from "@/components/layout/brand-logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** `dark`: sobre a barra do header ou o Marinho (padrão) · `light`: sobre superfície clara. */
  tone?: "light" | "dark";
  /** `md`: header desktop (tile 56) · `sm`: header mobile, rodapé e painéis (tile 36). */
  size?: "sm" | "md";
  /** Esconde o wordmark e deixa só o símbolo. */
  compact?: boolean;
  className?: string;
}

const TILE = {
  sm: { px: 36, radius: "rounded-[9px]", text: "text-[20px]" },
  md: { px: 56, radius: "rounded-[14px]", text: "text-[26px]" },
} as const;

/**
 * Lockup da marca: a sacola nas cores do Paraguai num tile branco + "Mercado Paraguai" em uma
 * linha, Figtree 800 itálico com contorno Tinta pintado por baixo do preenchimento (sem ele o
 * branco some em superfície clara). Sempre linka para a home.
 */
export function BrandMark({ tone = "dark", size = "md", compact, className }: BrandMarkProps) {
  const t = useTranslations("common");
  const onDark = tone === "dark";
  const tile = TILE[compact ? "sm" : size];
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
      <span
        aria-hidden
        className={cn("block shrink-0 overflow-hidden bg-white", tile.radius)}
        style={{ width: tile.px, height: tile.px }}
      >
        <Image
          src="/brand/logo-mercado-paraguai.png"
          alt=""
          width={tile.px}
          height={tile.px}
          priority={size === "md"}
          className="block size-full object-contain"
        />
      </span>
      {compact ? null : (
        <span
          aria-hidden
          className={cn(
            "leading-none font-extrabold tracking-[-0.02em] whitespace-nowrap italic",
            tile.text,
          )}
          style={{
            color: LOGO_COLORS.branco,
            WebkitTextStroke: `2px ${LOGO_COLORS.ink}`,
            paintOrder: "stroke fill",
          }}
        >
          {t("siteName")}
        </span>
      )}
    </Link>
  );
}
