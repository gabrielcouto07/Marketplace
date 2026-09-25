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

const SIZE = { xs: "size-3", sm: "size-3.5", md: "size-5" } as const;
const TEXT = { xs: "text-[11.5px]", sm: "text-xs", md: "text-sm" } as const;

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
        <Star className={cn("fill-star text-star", SIZE[size])} aria-hidden />
        <span className="font-bold text-foreground">{value.toFixed(1).replace(".", ",")}</span>
        {count !== undefined ? <span className="text-muted-foreground">({count})</span> : null}
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
                className={cn("absolute inset-0 text-line-300", SIZE[size])}
                strokeWidth={1.5}
              />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill}%` }}>
                <Star className={cn("fill-star text-star", SIZE[size])} strokeWidth={1.5} />
              </span>
            </span>
          );
        })}
      </span>
      {showValue ? (
        <span className={cn("font-bold text-foreground", TEXT[size])}>
          {value.toFixed(1).replace(".", ",")}
        </span>
      ) : null}
      {count !== undefined ? (
        <span className={cn("text-muted-foreground", TEXT[size])}>({count})</span>
      ) : null}
    </div>
  );
}
