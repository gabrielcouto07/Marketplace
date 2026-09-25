import { cn } from "@/lib/utils";

/** Placeholder de carregamento com shimmer sutil. Use no formato exato do conteúdo que substitui. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("shimmer rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
