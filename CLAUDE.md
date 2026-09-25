# Marketplace Paraguai — instruções para o Claude

Monorepo pnpm. O app é `apps/web` (Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4,
shadcn/ui sobre Base UI, TanStack Query, Zustand, MSW, next-intl, Serwist). Porta de dev: 3210.

## Regra número 1: siga o DESIGN.md

`DESIGN.md` (raiz) é a fonte de verdade visual e de código de UI. Leia-o antes de qualquer tarefa que toque
em componentes, telas, estilos ou textos de interface. Em resumo:

- Cores só por tokens semânticos (`bg-surface`, `text-foreground-secondary`, `bg-cta`, `text-success`…). Nunca
  hex no JSX, nunca classes de cor cruas (`bg-blue-600`) fora de `globals.css` e do `/design`.
- Um único botão vermelho (`variant="cta"`) visível por tela. Azul e vermelho são pontos focais, não áreas.
- Tipografia pela escala (`text-display`, `text-title-1/2/3`, `text-body`, `text-body-sm`, `text-caption`);
  preços, quantidades e rastreio com `tabular-nums`. Inputs ≥ 16 px. Nada abaixo de 12 px.
- Grid de 8 px (4 px só dentro de componentes). Raios 8/12/16/24/full. Sombras `shadow-xs|sm|md|lg` só.
- Movimento: `transition-colors|transform|opacity` (nunca `transition-all`), `pressable` no toque,
  `motion` só onde o DESIGN.md permite, `prefers-reduced-motion` respeitado.
- Componentes com `class-variance-authority` + `tailwind-merge`; Base UI sem `asChild` (use `render`).
- pt-BR direto e caloroso; botões com verbo.

O styleguide vivo está em `/design` (`apps/web/src/features/design`). Ao criar ou alterar um componente
base, atualize a seção correspondente lá.

## Comandos

```bash
pnpm install            # raiz
pnpm dev                # http://localhost:3210 (mock MSW ativado por .env.local)
pnpm typecheck && pnpm lint && pnpm build
pnpm --filter web icons # regenera ícones a partir de apps/web/public/logo.svg
```

## Onde estão as coisas

- Tokens: `apps/web/src/app/globals.css` (primitivos, semânticos light/dark, shadcn, tipografia, raios,
  sombras, motion, utilitários).
- Componentes base: `apps/web/src/components/ui` (shadcn) e `apps/web/src/components/shared`
  (ProductCard, PriceTag, SellerBadge, TrustBadge, OrderTimeline, EmptyState…).
- Layout: `apps/web/src/components/layout` (StoreShell, Header, BottomNav, BrandMark, TricolorStripe).
- Marca: `apps/web/public/logo.svg` (vetor), `apps/web/public/brand/app-icon-1024.png` (original).
- Docs técnicas: `docs/*.md` (arquitetura, contratos, mocks, PWA, i18n, convenções).

## Convenções que não estão no DESIGN.md

Ver `docs/CONVENTIONS.md`: páginas são Server Components mínimos com `setRequestLocale`; `fetch` só em
`src/lib/api`; dinheiro é `Money` inteiro em unidades mínimas (`formatMoney`, nunca float); textos
via next-intl (`pt-BR.json` / `es-PY.json`), exceto o styleguide `/design`, que é interno e só em pt-BR.
