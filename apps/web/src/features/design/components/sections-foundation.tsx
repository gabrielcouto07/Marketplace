"use client";

import { Heart, ShoppingBag, Sparkles, Zap } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { BrandMark } from "@/components/layout/brand-mark";
import { CartBadge } from "@/components/layout/header";
import { TricolorStripe } from "@/components/layout/tricolor-stripe";
import { FlagBR, FlagPY } from "@/components/shared/flags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { contrastRatio, formatRatio, wcagLevel } from "@/lib/contrast";
import { cn } from "@/lib/utils";

import { SCALES, SEMANTIC_PAIRS, TYPE_SCALE } from "./design-data";
import { Demo } from "./design-view";

/* ------------------------------------------------------------------ */
/* Marca                                                                */
/* ------------------------------------------------------------------ */

const BRAND_COLORS = [
  {
    name: "Vermelho",
    strong: "bg-brand-vermelho",
    soft: "bg-brand-vermelho-soft",
    use: "ofertas (600), sacola",
  },
  {
    name: "Azul",
    strong: "bg-brand-azul",
    soft: "bg-brand-azul-soft",
    use: "primary (600), links",
  },
  {
    name: "Verde",
    strong: "bg-brand-verde",
    soft: "bg-brand-verde-soft",
    use: "success (700), etiqueta",
  },
  {
    name: "Amarelo",
    strong: "bg-brand-amarelo",
    soft: "bg-brand-amarelo-soft",
    use: "tile do logo, carrinho",
  },
  {
    name: "Laranja",
    strong: "bg-brand-laranja",
    soft: "bg-brand-laranja-soft",
    use: "CTA de compra, busca",
  },
  {
    name: "Roxo",
    strong: "bg-brand-roxo",
    soft: "bg-brand-roxo-soft",
    use: "campanhas (só fundo)",
  },
];

export function BrandSection() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Demo label="Logo · Etiqueta" hint="public/logo.svg · detalhe muda com o tamanho">
        <div className="flex flex-wrap items-end gap-6">
          <BrandLogo size={96} title="Logo do Paraguai Já" />
          <BrandLogo size={48} />
          <BrandLogo size={40} />
          <BrandLogo size={24} />
        </div>
        <p className="mt-4 text-body-sm text-foreground-secondary">
          Sacola do Paraguai (Vermelho · branco com estrela · Azul) com a etiqueta do Brasil presa
          na alça, sobre o tile Amarelo. ≥ 42 px completo; abaixo disso sai a estrela; &lt; 28 px
          saem barbante e círculo e a alça engrossa. Nunca recebe sombra, contorno ou recolorização.
        </p>
      </Demo>
      <Demo
        label="Lockup"
        hint="tone dark (padrão) na barra Marinho · tone light em superfícies claras"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg bg-brand-deep p-4">
            <BrandMark />
            <BrandMark size="sm" />
          </div>
          <BrandMark tone="light" size="sm" />
        </div>
      </Demo>
      <Demo label="Paleta da marca" hint="cores chapadas vivas em cima · tons claros embaixo">
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {BRAND_COLORS.map((c) => (
            <li key={c.name} className="flex flex-col gap-2">
              <span className="flex h-20 flex-col overflow-hidden rounded-lg">
                <span className={cn("flex-1", c.strong)} />
                <span className={cn("h-6", c.soft)} />
              </span>
              <span className="text-body-sm font-semibold text-foreground">{c.name}</span>
              <span className="text-caption text-foreground-muted">{c.use}</span>
            </li>
          ))}
        </ul>
      </Demo>
      <Demo
        label="Barra do header, Marinho, tricolor e faixa das quatro cores"
        hint="header em header/header-raised · footer também em header · painel em brand-deep · tricolor no painel · brand-quartet na base do footer e na OG"
      >
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg">
            <div className="flex h-14 items-center bg-header px-3">
              <BrandMark size="sm" />
            </div>
            <div className="flex h-10 items-center bg-header-raised px-4 text-body-sm font-medium text-white">
              Todos · Ofertas do dia · Mais vendidos
            </div>
          </div>
          <div aria-hidden className="h-2.5 rounded-full brand-quartet" />
          <div className="overflow-hidden rounded-lg bg-brand-deep">
            <TricolorStripe />
            <p className="flex items-center gap-2 p-4 text-caption text-white/80">
              <FlagPY className="rounded-[3px]" />
              <FlagBR className="rounded-[3px]" />
              Tricolor (3 px) só sobre brand-deep; bandeiras só na versão da marca.
            </p>
          </div>
        </div>
      </Demo>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cores                                                                */
/* ------------------------------------------------------------------ */

function LevelBadge({ ratio, large }: { ratio: number; large?: boolean }) {
  const level = wcagLevel(ratio);
  const ok = level === "AAA" || level === "AA" || (large && level === "AA-large");
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-sm px-2 text-caption font-medium tabular-nums",
        ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
      )}
    >
      {formatRatio(ratio)} · {level}
    </span>
  );
}

export function PaletteSection() {
  return (
    <div className="flex flex-col gap-6">
      <Demo label="Escalas primitivas" hint="usadas só em globals.css; componentes usam semânticos">
        <div className="flex flex-col gap-4">
          {(Object.keys(SCALES) as Array<keyof typeof SCALES>).map((scale) => (
            <div key={scale} className="flex flex-col gap-2">
              <span className="text-caption font-medium text-foreground-secondary">{scale}</span>
              <ul className="grid grid-cols-6 gap-1 sm:grid-cols-12">
                {SCALES[scale].map((s) => {
                  const onWhite = contrastRatio(s.hex, "#FFFFFF");
                  const dark = onWhite > 3;
                  return (
                    <li key={s.name} className="flex flex-col gap-1">
                      <span
                        className={cn(
                          "flex h-12 items-end justify-start rounded-sm border border-border p-1 text-caption tabular-nums",
                          dark ? "text-white" : "text-foreground",
                        )}
                        style={{ backgroundColor: s.hex }}
                        title={s.hex}
                      >
                        {s.name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Demo>

      <Demo
        label="Semânticos com contraste (light)"
        hint="WCAG AA ≥ 4,5:1 para texto; ≥ 3:1 para ícones e texto grande"
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {SEMANTIC_PAIRS.map((p) => {
            const ratio = contrastRatio(p.fg, p.bg);
            return (
              <li
                key={p.token}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3",
                  p.className,
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body-sm font-medium">{p.token}</span>
                  <span className="truncate text-caption opacity-80">{p.role}</span>
                </span>
                <LevelBadge ratio={ratio} large={p.large} />
              </li>
            );
          })}
        </ul>
      </Demo>

      <Demo
        label="Proporção por tela"
        hint="~80 % Papel e branco · ~15 % cores vivas da marca · ~5 % Laranja · um CTA laranja por tela"
      >
        <div className="flex h-8 overflow-hidden rounded-sm">
          <span className="flex-[80] bg-background" />
          <span className="flex-[15] brand-quartet" />
          <span className="flex-[5] bg-cta" />
        </div>
      </Demo>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tipografia                                                           */
/* ------------------------------------------------------------------ */

export function TypographySection() {
  return (
    <Demo
      label="Escala mobile"
      hint="Figtree na interface, nos títulos de seção e nos números · Bricolage Grotesque 800 só no wordmark e nas manchetes (font-heading) · preços em tabular-nums"
    >
      <ul className="flex flex-col divide-y divide-border">
        {TYPE_SCALE.map((s) => (
          <li
            key={s.name}
            className="grid gap-1 py-4 first:pt-0 last:pb-0 md:grid-cols-[160px_1fr] md:gap-6"
          >
            <span className="flex flex-col text-caption text-foreground-muted">
              <span className="font-medium text-foreground-secondary">{s.name}</span>
              <span className="tabular-nums">{s.spec}</span>
            </span>
            <span className={cn(s.className, "text-foreground tabular-nums")}>{s.sample}</span>
          </li>
        ))}
      </ul>
    </Demo>
  );
}

/* ------------------------------------------------------------------ */
/* Raios e sombras                                                      */
/* ------------------------------------------------------------------ */

const RADII = [
  { name: "sm · 4", className: "rounded-sm", use: "chips, badges" },
  { name: "md · 6", className: "rounded-md", use: "inputs, busca" },
  { name: "lg · 8", className: "rounded-lg", use: "cards, imagens" },
  { name: "xl · 12", className: "rounded-xl", use: "bottom sheets" },
  { name: "full", className: "rounded-full", use: "botões, avatares" },
];

const SHADOWS = [
  { name: "xs", className: "shadow-xs", use: "cards em repouso" },
  { name: "sm", className: "shadow-sm", use: "card em hover/press, botões flutuantes" },
  { name: "md", className: "shadow-md", use: "dropdowns, popovers, toasts" },
  { name: "lg", className: "shadow-lg", use: "sheets, modais" },
];

export function ShapeSection() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Demo label="Raios">
        <ul className="grid grid-cols-5 gap-3">
          {RADII.map((r) => (
            <li key={r.name} className="flex flex-col items-center gap-2 text-center">
              <span
                className={cn("size-14 border border-border-strong bg-surface-muted", r.className)}
              />
              <span className="text-caption font-medium text-foreground">{r.name}</span>
              <span className="text-caption text-foreground-muted">{r.use}</span>
            </li>
          ))}
        </ul>
      </Demo>
      <Demo label="Sombras" hint="frias, em camadas; sempre com borda fina">
        <ul className="grid grid-cols-4 gap-3">
          {SHADOWS.map((s) => (
            <li key={s.name} className="flex flex-col items-center gap-2 text-center">
              <span
                className={cn("size-14 rounded-lg border border-border bg-surface", s.className)}
              />
              <span className="text-caption font-medium text-foreground">{s.name}</span>
              <span className="text-caption text-foreground-muted">{s.use}</span>
            </li>
          ))}
        </ul>
      </Demo>
      <Demo
        label="Grid de 8 px"
        hint="padding, margin e gap de layout em múltiplos de 8; 4 px só dentro de componentes"
        className="md:col-span-2"
      >
        <div className="flex items-end gap-2">
          {[8, 16, 24, 32, 40, 48, 64].map((n) => (
            <span key={n} className="flex flex-col items-center gap-1">
              <span className="w-8 rounded-sm bg-primary-soft" style={{ height: n }} />
              <span className="text-caption text-foreground-muted tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      </Demo>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Movimento                                                            */
/* ------------------------------------------------------------------ */

export function MotionSection() {
  const [count, setCount] = useState(2);
  const [added, setAdded] = useState(0);
  const reduce = useReducedMotion();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Demo label="Press" hint="scale(0.98) em 200 ms · easing (0.2, 0, 0, 1)">
        <Button variant="secondary" fullWidth>
          Segure para ver o press
        </Button>
      </Demo>
      <Demo label="Contador do carrinho (motion)" hint="mola ao mudar a quantidade">
        <div className="flex items-center justify-between">
          <span className="relative inline-flex size-11 items-center justify-center rounded-md bg-surface-muted">
            <ShoppingBag className="size-6 text-foreground" strokeWidth={1.75} aria-hidden />
            <CartBadge count={count} />
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCount((c) => Math.max(0, c - 1))}
            >
              −1
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCount((c) => c + 1)}>
              +1
            </Button>
          </div>
        </div>
      </Demo>
      <Demo label="Adicionar ao carrinho (motion)" hint="badge pulsa ao confirmar">
        <div className="flex items-center justify-between gap-3">
          <motion.span
            key={added}
            initial={reduce || added === 0 ? false : { scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 480, damping: 18 }}
            className="inline-flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary"
          >
            <Heart className="size-5" strokeWidth={1.75} aria-hidden />
          </motion.span>
          <Button size="sm" onClick={() => setAdded((n) => n + 1)}>
            Adicionar
          </Button>
        </div>
      </Demo>
      <Demo
        label="Animações de vitrine"
        hint="shine · float · flash · wiggle · marquee — somem com prefers-reduced-motion"
        className="md:col-span-3"
      >
        <div className="flex flex-wrap items-center gap-6">
          <Button variant="cta">Comprar agora</Button>
          <Badge variant="deal">Oferta</Badge>
          <span className="flex size-16 animate-float items-center justify-center rounded-lg bg-brand-roxo text-white shadow-md">
            <Sparkles className="size-6 animate-wiggle" strokeWidth={2} aria-hidden />
          </span>
          <Zap
            className="size-8 animate-flash fill-realce text-realce"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="w-64 overflow-hidden rounded-full bg-surface-muted py-2">
            <div className="flex w-max animate-marquee gap-6 text-body-sm font-semibold text-foreground">
              <span>Rastreio ponta a ponta</span>
              <span>Lojas verificadas</span>
              <span aria-hidden>Rastreio ponta a ponta</span>
              <span aria-hidden>Lojas verificadas</span>
            </div>
          </div>
        </div>
      </Demo>
    </div>
  );
}
