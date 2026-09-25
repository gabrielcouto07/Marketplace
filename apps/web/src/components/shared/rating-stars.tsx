import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface RatingStarsProps {
  /** 0–5, aceita decimais (renderiza meia estrela via clip). */
  value: number;
  count?: number;
  size?: "xs" | "sm" | "md";
  showValue?: boolean;
  /** `compact`: uma estrela + nota (cards); `full`: cinco estrelas (produto, avaliações). */
  variant?: "full" | "compact";
  className?: string;
}

const SIZE = { xs: "size-3.5", sm: "size-4", md: "size-5" } as const;
const TEXT = { xs: "text-caption", sm: "text-caption", md: "text-body-sm" } as const;

/** Estrelas no dourado do ícone (`gold`); vazias em border-strong. O valor numérico carrega o contraste. */
export function RatingStars({
  value,
  count,
  size = "sm",
  showValue = true,
  variant = "full",
  className,
}: RatingStarsProps) {
  const rounded = Math.round(value * 2) / 2;
  const label = `${value.toFixed(1)} de 5 estrelas${count !== undefined ? `, ${count} avaliações` : ""}`;

  if (variant === "compact") {
    return (
      <span
        className={cn("inline-flex items-center gap-1", TEXT[size], className)}
        aria-label={label}
      >
        <Star className={cn("fill-gold text-gold", SIZE[size])} strokeWidth={1.75} aria-hidden />
        <span className="font-medium text-foreground">{value.toFixed(1).replace(".", ",")}</span>
        {count !== undefined ? <span className="text-foreground-muted">({count})</span> : null}
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-label={label}>
      <span className="flex items-center gap-px" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = rounded >= i ? 100 : rounded >= i - 0.5 ? 50 : 0;
          return (
            <span key={i} className={cn("relative", SIZE[size])}>
              <Star
                className={cn("absolute inset-0 text-border-strong", SIZE[size])}
                strokeWidth={1.75}
              />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill}%` }}>
                <Star className={cn("fill-gold text-gold", SIZE[size])} strokeWidth={1.75} />
              </span>
            </span>
          );
        })}
      </span>
      {showValue ? (
        <span className={cn("font-medium text-foreground", TEXT[size])}>
          {value.toFixed(1).replace(".", ",")}
        </span>
      ) : null}
      {count !== undefined ? (
        <span className={cn("text-foreground-muted", TEXT[size])}>({count})</span>
      ) : null}
    </div>
  );
}
