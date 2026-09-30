"use client";

import { Heart, ShoppingBag } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { BrandMark } from "@/components/layout/brand-mark";
import { CartBadge } from "@/components/layout/header";
import { TricolorStripe } from "@/components/layout/tricolor-stripe";
import { Button } from "@/components/ui/button";
import { FlagBR, FlagPY, HeroIllustration } from "@/features/home/components/hero-illustration";
import { contrastRatio, formatRatio, wcagLevel } from "@/lib/contrast";
import { cn } from "@/lib/utils";

import { SCALES, SEMANTIC_PAIRS, TYPE_SCALE } from "./design-data";
import { Demo } from "./design-view";

/* ------------------------------------------------------------------ */
/* Marca                                                                */
/* ------------------------------------------------------------------ */

const BRAND_PASTELS = [
  { name: "Coral", strong: "bg-brand-coral", soft: "bg-brand-coral-soft", use: "CTA, busca, badge" },
  {
    name: "Pervinca",
    strong: "bg-brand-pervinca",
    soft: "bg-brand-pervinca-soft",
    use: "primary (600), fita do header",
  },
  {
    name: "Menta",
    strong: "bg-brand-menta",
    soft: "bg-brand-menta-soft",
    use: "success, etiqueta",
  },
  {
    name: "Manteiga",
    strong: "bg-brand-manteiga",
    soft: "bg-brand-manteiga-soft",
    use: "tile do logo, carrinho",
  },
];

export function BrandSection() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Demo label="Logo A · Etiqueta" hint="public/logo.svg · detalhe muda com o tamanho">
        <div className="flex flex-wrap items-end gap-6">
          <BrandLogo size={96} title="Logo do Marketplace Paraguai" />
          <BrandLogo size={48} />
          <BrandLogo size={40} />
          <BrandLogo size={24} />
        </div>
        <p className="mt-4 text-body-sm text-foreground-secondary">
          Sacola do Paraguai (Coral · branco com estrela · Pervinca) com a etiqueta do Brasil presa
          na alça, sobre o tile Manteiga. ≥ 42 px completo; abaixo disso sai a estrela; &lt; 28 px
          saem barbante e círculo e a alça engrossa. Nunca recebe sombra, contorno ou recolorização.
        </p>
      </Demo>
      <Demo label="Lockup" hint="md no header desktop · sm no mobile · tone dark sobre brand-deep">
        <div className="flex flex-col gap-4">
          <BrandMark />
          <BrandMark size="sm" />
          <div className="relative overflow-hidden rounded-lg bg-brand-deep p-4">
            <TricolorStripe className="absolute inset-x-0 top-0" />
            <BrandMark tone="dark" size="sm" className="mt-1" />
          </div>
        </div>
      </Demo>
      <Demo label="Paleta da marca" hint="pastel é fundo; o conteúdo por cima é sempre Tinta">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BRAND_PASTELS.map((c) => (
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
        <div className="mt-4 flex gap-3">
          <span className="flex h-10 flex-1 items-center rounded-md bg-brand-lilas px-3 text-caption font-semibold text-foreground">
            Lilás · atalho da conta
          </span>
          <span className="flex h-10 flex-1 items-center rounded-md bg-brand-ceu px-3 text-caption font-semibold text-foreground">
            Céu · hero
          </span>
        </div>
      </Demo>
      <Demo
        label="Fita Pervinca e faixa das quatro cores"
        hint="brand-ribbon (4 px) na base do header · brand-quartet em splash e OG"
      >
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex h-14 items-center px-4">
              <BrandMark size="sm" compact />
            </div>
            <div aria-hidden className="brand-ribbon" />
          </div>
          <div aria-hidden className="h-2.5 rounded-full brand-quartet" />
          <div className="overflow-hidden rounded-lg bg-brand-deep">
            <TricolorStripe />
            <p className="p-4 text-caption text-white/70">
              Tricolor (3 px) só sobre brand-deep: painel, footer, splash.
            </p>
          </div>
        </div>
      </Demo>
      <Demo
        label="Arte do hero"
        hint="Ponte da Amizade PY → BR · bandeiras na versão da marca (sem brasão)"
        className="md:col-span-2"
      >
        <div className="flex flex-col overflow-hidden rounded-xl bg-brand-ceu md:flex-row md:items-center md:justify-between">
          <div className="flex shrink-0 items-center gap-2 p-5 md:pl-8">
            <FlagPY className="rounded-[3px]" />
            <FlagBR className="rounded-[3px]" />
            <span className="font-heading text-hero whitespace-nowrap text-foreground">
              Boa tarde!
            </span>
          </div>
          <HeroIllustration className="w-full md:w-1/2 md:self-end" />
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
        hint="~80 % Papel e branco · ~15 % pastéis da marca · ~5 % Coral · um CTA coral por tela"
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
      hint="Figtree na interface e nos números · Bricolage Grotesque 800 só em títulos (font-heading) · preços em tabular-nums"
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
  { name: "sm · 8", className: "rounded-sm", use: "chips, badges" },
  { name: "md · 12", className: "rounded-md", use: "botões, inputs" },
  { name: "lg · 16", className: "rounded-lg", use: "cards, imagens" },
  { name: "xl · 24", className: "rounded-xl", use: "bottom sheets" },
  { name: "full", className: "rounded-full", use: "avatares, pills" },
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
    </div>
  );
}
