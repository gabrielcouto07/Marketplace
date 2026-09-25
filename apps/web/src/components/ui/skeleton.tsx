import { cn } from "@/lib/utils";

/** Placeholder de carregamento com brilho deslizante (shimmer). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("shimmer rounded-xl", className)} {...props} />;
}

export { Skeleton };
