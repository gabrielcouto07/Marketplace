import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface RatingStarsProps {
  /** 0–5, aceita decimais (renderiza meia estrela via clip). */
  value: number;
  count?: number;
  size?: "xs" | "sm" | "md";
  showValue?: boolean;
  className?: string;
}

const SIZE = { xs: "size-3", sm: "size-3.5", md: "size-5" } as const;

export function RatingStars({ value, count, size = "sm", showValue = true, className }: RatingStarsProps) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <div className={cn("flex items-center gap-1", className)} aria-label={`${value.toFixed(1)} de 5 estrelas${count !== undefined ? `, ${count} avaliações` : ""}`}>
      <span className="flex items-center gap-px" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = rounded >= i ? 100 : rounded >= i - 0.5 ? 50 : 0;
          return (
            <span key={i} className={cn("relative", SIZE[size])}>
              <Star className={cn("absolute inset-0 text-neutral-300", SIZE[size])} strokeWidth={1.5} />
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill}%` }}>
                <Star className={cn("fill-amber-400 text-amber-400", SIZE[size])} strokeWidth={1.5} />
              </span>
            </span>
          );
        })}
      </span>
      {showValue ? <span className={cn("font-medium text-foreground", size === "md" ? "text-sm" : "text-xs")}>{value.toFixed(1)}</span> : null}
      {count !== undefined ? <span className={cn("text-muted-foreground", size === "md" ? "text-sm" : "text-xs")}>({count})</span> : null}
    </div>
  );
}
