import { useTranslations } from "next-intl";

import { BrandLogo, LOGO_COLORS } from "@/components/layout/brand-logo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** `dark`: sobre a barra do header ou o Marinho (padrão) · `light`: sobre superfície clara. */
  tone?: "light" | "dark";
  /** `md`: header desktop (logo 40) · `sm`: header mobile e painéis (logo 36). */
  size?: "sm" | "md";
  /** Esconde o wordmark e deixa só o símbolo. */
  compact?: boolean;
  className?: string;
}

const LOGO_SIZE = { sm: 36, md: 40 } as const;

const NAME_SIZE = { sm: "text-title-3", md: "text-title-2" } as const;

/**
 * Contorno Tinta em volta das letras (pintado por baixo do preenchimento): sem ele o Azul some no
 * header Azul, o branco some em superfície clara e o Vermelho vibra sobre o Azul.
 */
const OUTLINE = {
  WebkitTextStroke: `1.5px ${LOGO_COLORS.ink}`,
  paintOrder: "stroke fill",
} as const;

const { vermelho, branco, azul, verde, amarelo } = LOGO_COLORS;

/** Bandeira do Paraguai: Vermelho, branco e Azul em terços, da esquerda para a direita. */
function flagColor(index: number, count: number) {
  const at = index / count;
  return at < 0.375 ? vermelho : at < 0.625 ? branco : azul;
}

/** "Paraguai" com uma cor da bandeira do Paraguai por letra (3 · 2 · 3). */
function FlagName({ text }: { text: string }) {
  const letters = Array.from(text);
  return (
    <>
      {letters.map((letter, i) => (
        <span key={i} style={{ ...OUTLINE, color: flagColor(i, letters.length) }}>
          {letter}
        </span>
      ))}
    </>
  );
}

/**
 * "Já" em Verde e Amarelo, as cores do Brasil, e o acento em Azul. O acento é desenhado à parte
 * (uma barra inclinada sobre a letra) porque um diacrítico combinante não aceita outra cor.
 */
function BrazilLine({ text }: { text: string }) {
  const letters: { base: string; accent: boolean }[] = [];
  for (const ch of text.normalize("NFD")) {
    if (/\p{M}/u.test(ch) && letters.length) letters[letters.length - 1]!.accent = true;
    else letters.push({ base: ch, accent: false });
  }
  return (
    <>
      {letters.map(({ base, accent }, i) => (
        <span
          key={i}
          style={{ ...OUTLINE, color: i % 2 === 0 ? verde : amarelo }}
          className={cn(
            "relative",
            // Acento agudo: barra Azul inclinada, com o mesmo contorno Tinta.
            accent &&
              "after:absolute after:-top-[0.3em] after:left-1/2 after:h-[0.42em] after:w-[0.17em] after:rotate-[28deg] after:rounded-full after:border-[1.5px] after:border-[#0F1729] after:bg-[#1552EB] after:content-['']",
          )}
        >
          {base}
        </span>
      ))}
    </>
  );
}

/**
 * Lockup da marca: logo + wordmark em duas linhas. "Paraguai" em Bricolage 800 nas cores da
 * bandeira do Paraguai e "JÁ" em caixa alta espaçada, em Verde e Amarelo (o acento em Azul), as
 * cores do Brasil. Sempre linka para a home (DESIGN.md › Apêndice A).
 */
export function BrandMark({ tone = "dark", size = "md", compact, className }: BrandMarkProps) {
  const t = useTranslations("common");
  const onDark = tone === "dark";
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
      <BrandLogo size={compact ? 32 : LOGO_SIZE[size]} />
      {compact ? null : (
        <span aria-hidden className="flex flex-col gap-1">
          <span
            className={cn(
              "font-heading leading-none font-extrabold tracking-[-0.02em]",
              NAME_SIZE[size],
            )}
          >
            <FlagName text={t("brandLine1")} />
          </span>
          <span className="text-caption leading-none font-bold tracking-[0.22em] uppercase">
            <BrazilLine text={t("brandLine2")} />
          </span>
        </span>
      )}
    </Link>
  );
}
