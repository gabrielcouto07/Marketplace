# Design system — resumo técnico

> **Fonte de verdade: [`DESIGN.md`](../DESIGN.md) na raiz do repositório.** Este arquivo só aponta onde cada
> coisa vive no código. Em caso de conflito, vale o DESIGN.md. Styleguide vivo: `/design`
> (`apps/web/src/features/design`). Mapeamento legado → novo usado na migração: `MIGRATION_BRIEF.md`.

## Tokens (`apps/web/src/app/globals.css`)

- Primitivos (`--blue-*`, `--red-*`, `--neutral-*`, `--green-*`, `--amber-*`, `--gold`, `--brand-tile`) e
  semânticos (`--background`, `--surface`, `--surface-muted`, `--border`, `--border-strong`, `--text`,
  `--text-secondary`, `--text-muted`, `--primary*`, `--cta*`, `--success*`, `--warning*`, `--danger*`,
  `--focus-ring`, `--brand-deep`, `--overlay`) em `:root`; dark em `.dark` (next-themes, `enableSystem`).
- Tokens shadcn mapeados (`--card`, `--muted`, `--accent`, `--destructive`, `--ring`…).
- `@theme inline` desliga a paleta padrão do Tailwind (`--color-*: initial`) e expõe só as cores acima, a escala
  tipográfica (`text-display`, `text-title-1/2/3`, `text-body`, `text-body-sm`, `text-caption`, com altura de
  linha, peso e tracking), raios (`sm` 8 · `md` 12 · `lg` 16 · `xl` 24), sombras (`xs`…`lg`), easing
  (`ease-standard`, `ease-exit`) e animações (`shimmer`, `ring-pulse`, `fade-in`, `pop`).
- Utilitários: `focus-ring`, `pressable`, `tricolor-stripe` (3 px), `shimmer`, `pt-safe`/`pb-safe`,
  `scrollbar-none`, `touch-target`, `tint-*` (só tiles de categoria).
- `lib/utils.ts` estende o tailwind-merge com a escala tipográfica e as sombras.

## Marca

`public/logo.svg` (vetor), `public/brand/app-icon-1024.png` (original), `components/layout/brand-logo.tsx`
(`<BrandLogo tile />` em superfícies claras, `<BrandLogo />` sobre `brand-deep`), `brand-mark.tsx` (logo +
wordmark), `tricolor-stripe.tsx`. Ícones do manifest, favicon e OG são gerados por `scripts/generate-icons.mjs`.

## Componentes

- `components/ui`: shadcn sobre Base UI (`render`, sem `asChild`) — `button` (`cta` · `primary` · `secondary` ·
  `ghost` · `soft` · `link` · `destructive` · `floating` · `inverse`; `loading`, `fullWidth`), `badge`, `input`,
  `textarea`, `label`, `select` (passe `items`), `checkbox`, `radio-group`, `switch`, `tabs`, `card`, `skeleton`,
  `bottom-sheet` (Base UI Drawer: arraste, handle, raio 24), `sheet`, `dialog`, `dropdown-menu`, `table`,
  `progress`, `accordion`, `tooltip`, `sonner` (toasts discretos no topo).
- `components/shared`: `product-card`, `price-tag`, `seller-badge` (+ `ReputationMeter`, `SellerAvatar`,
  `OfficialBadge`), `trust-badge` (`GuaranteeBadge`, `ImportTaxLine`, `DeliveryWindow`), `order-status`
  (`OrderTimeline`, `OrderStatusBadge`), `states` (`EmptyState`, `ErrorState`, `SectionHeader`,
  `HorizontalScroller`), `illustrations`, `favorite-button`, `rating-stars`, `quantity-stepper`, `back-button`,
  `form-field`, `category-tile`, `cep-shipping-calculator`, `panel-widgets` (KPIs e toolbar dos painéis).
- `components/layout`: `store-shell` (`StoreShell`, `PageContainer`, `StickyBar` com `aboveBottomNav`),
  `header` (sticky translúcido; pill de busca ou voltar + título; `hideMobileBar` para páginas com topo próprio),
  `bottom-nav` (64 px + safe-area, pill atrás do ícone ativo), `panel-shell`, `install-prompt`, `offline-banner`.

## Regras rápidas

Um `variant="cta"` por tela · preço nunca vermelho · erros sempre ícone + texto · grid de 8 px · nada abaixo de
12 px · inputs com 16 px · `transition-colors|transform|opacity` (nunca `transition-all`) · `motion` só no
contador do carrinho, no pulso de "adicionar" e na galeria do produto · `prefers-reduced-motion` respeitado.
