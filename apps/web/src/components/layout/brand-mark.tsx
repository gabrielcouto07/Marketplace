import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** `dark`: sobre o azul do hero (caixa branca); `light`: sobre fundo claro (caixa azul). */
  tone?: "dark" | "light";
  /** Esconde o texto e deixa só o símbolo. */
  compact?: boolean;
  className?: string;
}

/**
 * Símbolo da marca: sacola dentro de um quadrado arredondado com a faixa tricolor no pé,
 * seguida do wordmark em duas linhas ("MARKETPLACE" / "Paraguai"). Sempre linka para a home.
 */
export function BrandMark({ tone = "dark", compact, className }: BrandMarkProps) {
  const t = useTranslations("common");
  const onDark = tone === "dark";
  return (
    <Link
      href="/"
      aria-label={t("siteName")}
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative flex size-10 items-center justify-center overflow-hidden rounded-[13px]",
          onDark ? "bg-card text-primary" : "bg-primary text-primary-foreground",
        )}
      >
        <ShoppingBag className="size-[21px]" strokeWidth={2.2} />
        <span className="absolute inset-x-0 bottom-0 tricolor-stripe" />
      </span>
      {compact ? null : (
        <span
          className={cn(
            "flex flex-col leading-[1.1]",
            onDark ? "text-header-foreground" : "text-foreground",
          )}
        >
          <span
            className={cn(
              "text-[10.5px] font-bold tracking-[0.1em] uppercase",
              onDark ? "opacity-80" : "text-muted-foreground",
            )}
          >
            {t("brandLine1")}
          </span>
          <span className="text-[19px] font-extrabold tracking-tight">{t("brandLine2")}</span>
        </span>
      )}
    </Link>
  );
}
