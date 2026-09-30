import { cn } from "@/lib/utils";

/*
 * Cores do asset (DESIGN.md › Apêndice A): a ilustração do hero é arte da identidade, como o
 * logo, e usa a paleta pastel fixa. Os morros e o rio são tons intermediários da própria arte.
 */
const INK = "#26253A";
const WHITE = "#FFFFFF";
const CORAL = "#FF8B7B";
const PERVINCA = "#7F9BFF";
const MENTA = "#5DCB94";
const MANTEIGA = "#FFD15C";
const HILL_PY = "#FFD9D1";
const HILL_BR = "#CFF1DE";
const RIVER = "#C4D5FF";

/**
 * Ponte da Amizade com um caminhão atravessando do Paraguai (bandeira em faixas, à esquerda) para
 * o Brasil (à direita), sob sol e nuvens. 520×200; escala pela largura.
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 200" aria-hidden className={cn("block h-auto shrink-0", className)}>
      <circle cx="330" cy="46" r="24" fill={MANTEIGA} />
      <rect x="70" y="38" width="76" height="18" rx="9" fill={WHITE} />
      <rect x="92" y="26" width="40" height="22" rx="11" fill={WHITE} />
      <circle cx="36" cy="28" r="4" fill={CORAL} />
      <circle cx="200" cy="34" r="3.5" fill={MENTA} />
      <circle cx="398" cy="24" r="4" fill={PERVINCA} />
      <circle cx="508" cy="40" r="3.5" fill={CORAL} />
      <path d="M0 132Q60 118 120 130L160 200H0Z" fill={HILL_PY} />
      <path d="M520 132Q460 118 400 130L360 200H520Z" fill={HILL_BR} />
      <path d="M0 176Q65 166 130 176T260 176T390 176T520 176V200H0Z" fill={RIVER} />
      <path
        d="M150 180Q260 96 370 180"
        fill="none"
        stroke={WHITE}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M180 126V160M210 126V146M240 126V139M260 126V138M280 126V139M310 126V146M340 126V160"
        stroke={WHITE}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect x="96" y="116" width="328" height="10" rx="5" fill={PERVINCA} />
      <path d="M196 100H212M190 108H210" stroke={WHITE} strokeWidth="3" strokeLinecap="round" />
      <rect x="220" y="90" width="36" height="22" rx="4" fill={MANTEIGA} />
      <rect x="236" y="90" width="4" height="22" fill={WHITE} opacity="0.7" />
      <path d="M258 96H268Q272 96 273.5 100L276 106V112H258Z" fill={CORAL} />
      <rect x="262" y="99" width="7" height="6" rx="1.5" fill={WHITE} />
      <circle cx="230" cy="113" r="4.5" fill={INK} />
      <circle cx="266" cy="113" r="4.5" fill={INK} />
      <path d="M60 128V58" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <rect x="61" y="58" width="40" height="9" fill={CORAL} />
      <rect x="61" y="67" width="40" height="9" fill={WHITE} />
      <rect x="61" y="76" width="40" height="9" fill={PERVINCA} />
      <path d="M460 128V58" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <rect x="461" y="58" width="40" height="27" fill={MENTA} />
      <path d="M481 61L498 71.5L481 82L464 71.5Z" fill={MANTEIGA} />
      <circle cx="481" cy="71.5" r="5.5" fill={PERVINCA} />
    </svg>
  );
}

/** Bandeira do Paraguai na versão da marca: só as faixas (o brasão não é usado). 22×15. */
export function FlagPY({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 15" width={22} height={15} aria-hidden className={className}>
      <rect width="22" height="5" fill={CORAL} />
      <rect y="5" width="22" height="5" fill={WHITE} />
      <rect y="10" width="22" height="5" fill={PERVINCA} />
      <rect
        x="0.5"
        y="0.5"
        width="21"
        height="14"
        rx="2.5"
        fill="none"
        stroke={INK}
        strokeOpacity="0.18"
      />
    </svg>
  );
}

/** Bandeira do Brasil na versão da marca: Menta, losango Manteiga e círculo Pervinca. 22×15. */
export function FlagBR({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 15" width={22} height={15} aria-hidden className={className}>
      <rect width="22" height="15" fill={MENTA} />
      <path d="M11 2L20 7.5L11 13L2 7.5Z" fill={MANTEIGA} />
      <circle cx="11" cy="7.5" r="3.2" fill={PERVINCA} />
    </svg>
  );
}
