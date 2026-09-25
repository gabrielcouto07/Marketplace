"use client";

import type { ReactNode } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { cn } from "@/lib/utils";

import {
  BrandSection,
  MotionSection,
  PaletteSection,
  ShapeSection,
  TypographySection,
} from "./sections-foundation";
import {
  ButtonsSection,
  CardsSection,
  FeedbackSection,
  FormsSection,
  NavigationSection,
  OverlaysSection,
  TrustSection,
} from "./sections-components";

interface SectionDef {
  id: string;
  label: string;
  node: ReactNode;
}

const SECTIONS: SectionDef[] = [
  { id: "marca", label: "Marca", node: <BrandSection /> },
  { id: "cores", label: "Cores", node: <PaletteSection /> },
  { id: "tipografia", label: "Tipografia", node: <TypographySection /> },
  { id: "forma", label: "Raios e sombras", node: <ShapeSection /> },
  { id: "movimento", label: "Movimento", node: <MotionSection /> },
  { id: "botoes", label: "Botões", node: <ButtonsSection /> },
  { id: "formularios", label: "Formulários", node: <FormsSection /> },
  { id: "cards", label: "Produto e preço", node: <CardsSection /> },
  { id: "confianca", label: "Confiança", node: <TrustSection /> },
  { id: "navegacao", label: "Navegação", node: <NavigationSection /> },
  { id: "sheets", label: "Sheets e diálogos", node: <OverlaysSection /> },
  { id: "feedback", label: "Feedback", node: <FeedbackSection /> },
];

/** Styleguide vivo: cada seção usa os componentes reais do app. */
export function DesignView() {
  return (
    <PageContainer className="flex flex-col gap-8 pt-6 md:pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-title-1 text-foreground">Design system</h1>
        <p className="max-w-2xl text-body text-foreground-secondary">
          Tokens, tipografia e componentes do Marketplace Paraguai, renderizados com o código real.
          A regra de tudo isto está no <code className="font-mono text-body-sm">DESIGN.md</code>.
        </p>
        <nav aria-label="Seções" className="-mx-4 scrollbar-none overflow-x-auto px-4 pt-2">
          <ul className="flex gap-2">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  className="inline-flex h-8 items-center rounded-full bg-surface-muted px-3 text-caption font-medium text-foreground-secondary focus-ring transition-colors hover:bg-border hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="flex scroll-mt-20 flex-col gap-4">
          <h2 className="text-title-2 text-foreground">{s.label}</h2>
          {s.node}
        </section>
      ))}
    </PageContainer>
  );
}

/** Bloco de demonstração: rótulo pequeno + conteúdo sobre surface com borda. */
export function Demo({
  label,
  hint,
  children,
  className,
  bare,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  /** Sem moldura (para conteúdo que já é um card). */
  bare?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col">
        <span className="text-caption font-medium text-foreground-secondary uppercase">
          {label}
        </span>
        {hint ? <span className="text-caption text-foreground-muted">{hint}</span> : null}
      </div>
      <div
        className={cn(
          !bare && "rounded-lg border border-border bg-surface p-4 shadow-xs",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
