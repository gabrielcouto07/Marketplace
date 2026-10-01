/*
 * Cores do asset (DESIGN.md › Regra de ouro das cores): as bandeiras aparecem só na versão da
 * marca, nas mesmas cores do logo, e nunca são recoloridas. O brasão, o escudo e a esfera com a
 * faixa não são usados.
 */
const INK = "#0F1729";
const WHITE = "#FFFFFF";
const VERMELHO = "#F2263E";
const AZUL = "#1552EB";
const VERDE = "#00B852";
const AMARELO = "#FFD20A";

/** Bandeira do Paraguai na versão da marca: só as faixas Vermelho · branco · Azul. 22×15. */
export function FlagPY({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 15" width={22} height={15} aria-hidden className={className}>
      <rect width="22" height="5" fill={VERMELHO} />
      <rect y="5" width="22" height="5" fill={WHITE} />
      <rect y="10" width="22" height="5" fill={AZUL} />
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

/** Bandeira do Brasil na versão da marca: Verde, losango Amarelo e círculo Azul. 22×15. */
export function FlagBR({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 15" width={22} height={15} aria-hidden className={className}>
      <rect width="22" height="15" fill={VERDE} />
      <path d="M11 2L20 7.5L11 13L2 7.5Z" fill={AMARELO} />
      <circle cx="11" cy="7.5" r="3.2" fill={AZUL} />
    </svg>
  );
}
