import { cn } from "@/lib/utils";

export type IllustrationName = "bag" | "search" | "heart" | "box" | "wifi" | "alert" | "check";

interface IllustrationProps {
  name: IllustrationName;
  className?: string;
}

/**
 * Ilustrações lineares minimalistas para estados vazios: traço 1.5 em neutros (border-strong)
 * com um acento em --primary e um preenchimento em primary-soft. 120×96, sem imagens externas.
 */
export function Illustration({ name, className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 96"
      width={120}
      height={96}
      aria-hidden
      className={cn("shrink-0", className)}
      fill="none"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ART[name]}
    </svg>
  );
}

const soft = "fill-primary-soft";
const line = "stroke-border-strong";
const accent = "stroke-primary";

const ART: Record<IllustrationName, React.ReactNode> = {
  bag: (
    <>
      <ellipse cx="60" cy="86" rx="34" ry="4" className={soft} />
      <path d="M36 34h48l4 44H32l4-44Z" className={line} />
      <path d="M48 34v-6a12 12 0 0 1 24 0v6" className={accent} />
      <path d="M46 60h28" className={accent} />
      <path d="M98 22l4-4M104 28h6" className={accent} />
    </>
  ),
  search: (
    <>
      <ellipse cx="60" cy="86" rx="34" ry="4" className={soft} />
      <circle cx="54" cy="42" r="22" className={line} />
      <circle cx="54" cy="42" r="22" className={soft} fillOpacity={0.6} />
      <path d="M70 58l16 16" className={accent} strokeWidth={2} />
      <path d="M44 42h20M54 32v20" className={accent} />
    </>
  ),
  heart: (
    <>
      <ellipse cx="60" cy="86" rx="34" ry="4" className={soft} />
      <path d="M60 74 33 48a15 15 0 0 1 21-21l6 6 6-6a15 15 0 0 1 21 21L60 74Z" className={line} />
      <path d="M44 36a8 8 0 0 0-4 6" className={accent} />
      <path d="M92 20l4-4M96 30h6" className={accent} />
    </>
  ),
  box: (
    <>
      <ellipse cx="60" cy="88" rx="34" ry="4" className={soft} />
      <path d="M28 40 60 26l32 14v34L60 88 28 74V40Z" className={line} />
      <path d="M28 40l32 14 32-14M60 54v34" className={line} />
      <path d="M44 33l32 14" className={accent} />
      <path d="M98 22l4-4M104 28h6" className={accent} />
    </>
  ),
  wifi: (
    <>
      <ellipse cx="60" cy="86" rx="34" ry="4" className={soft} />
      <path d="M22 40a54 54 0 0 1 76 0" className={line} />
      <path d="M34 52a37 37 0 0 1 52 0" className={line} />
      <path d="M46 64a20 20 0 0 1 28 0" className={accent} />
      <circle cx="60" cy="76" r="2" className={accent} />
      <path d="M26 24l68 56" className={accent} />
    </>
  ),
  alert: (
    <>
      <ellipse cx="60" cy="88" rx="34" ry="4" className={soft} />
      <path d="M60 22 96 80H24L60 22Z" className={line} />
      <path d="M60 44v16M60 68v2" className={accent} strokeWidth={2} />
    </>
  ),
  check: (
    <>
      <ellipse cx="60" cy="88" rx="34" ry="4" className={soft} />
      <circle cx="60" cy="50" r="28" className={line} />
      <circle cx="60" cy="50" r="28" className={soft} fillOpacity={0.6} />
      <path d="M46 51l9 9 19-20" className={accent} strokeWidth={2} />
    </>
  ),
};
