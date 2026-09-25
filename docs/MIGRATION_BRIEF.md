# Brief de migração visual — telas → DESIGN.md

> Migração concluída em 25/09/2026. Os aliases legados e as variantes `outline`/`white`/`ink`/`success` foram
> removidos; este documento fica como referência do mapeamento e das regras de composição.

Este brief guia a migração de cada tela para o design system definido em `DESIGN.md` (raiz). Leia, nesta
ordem: `DESIGN.md` (inteiro), `CLAUDE.md`, `apps/web/src/app/globals.css` (tokens) e os componentes abaixo.
O styleguide `/design` (`apps/web/src/features/design/components/*`) mostra todos eles em uso e é a
referência visual: sua tela precisa parecer que saiu da mesma mão.

## Componentes prontos (não os altere; componha a partir deles)

| Arquivo (apps/web/src)                                                                                                            | O que oferece                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ui/button.tsx`                                                                                                        | `variant`: `cta` · `primary`/`default` · `secondary` · `ghost` · `soft` · `link` · `destructive` · `floating` · `inverse`; `size`: `default` (48) · `lg` · `sm` · `xs` · `icon` · `icon-sm` · `icon-xs` · `icon-lg`; props `loading`, `fullWidth`. Legados `white`→`floating`, `ink`→`inverse`, `outline`→`secondary`, `success`→ não usar. |
| `components/ui/badge.tsx`                                                                                                         | `variant`: `soft` · `success` · `warning` · `danger` · `neutral` · `outline` · `cta` · `primary` · `inverse`                                                                                                                                                                                                                                |
| `components/ui/input.tsx`, `textarea.tsx`, `label.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `tabs.tsx` | Controles no novo desenho (48 px, 16 px de fonte, surface-muted). `Select` precisa de `items={{valor: "Rótulo"}}` no Root para mostrar o rótulo.                                                                                                                                                                                            |
| `components/ui/card.tsx`                                                                                                          | Card 16 px de raio, borda, sombra xs. Ou use direto `rounded-lg border border-border bg-surface p-4 shadow-xs`.                                                                                                                                                                                                                             |
| `components/ui/bottom-sheet.tsx`                                                                                                  | `BottomSheet`, `BottomSheetContent`, `BottomSheetHeader/Title/Description`, `BottomSheetBody`, `BottomSheetFooter`, `BottomSheetClose`. Use no lugar de `<Sheet side="bottom">`.                                                                                                                                                            |
| `components/ui/sheet.tsx`, `dialog.tsx`                                                                                           | Painéis laterais (desktop) e diálogos de confirmação.                                                                                                                                                                                                                                                                                       |
| `components/ui/skeleton.tsx`                                                                                                      | Shimmer sutil; use no formato exato do conteúdo.                                                                                                                                                                                                                                                                                            |
| `components/shared/product-card.tsx`                                                                                              | `ProductCard` (`layout="grid"                                                                                                                                                                                                                                                                                                               | "row"`), `ProductCardSkeleton`. |
| `components/shared/price-tag.tsx`                                                                                                 | `PriceTag` (`size` sm/md/lg, `installments`, `referencePrice`, `showDiscountBadge`).                                                                                                                                                                                                                                                        |
| `components/shared/seller-badge.tsx`                                                                                              | `SellerBadge` (`inline` · `pill` · `card` + `metrics`), `SellerAvatar`, `ReputationMeter`, `OfficialBadge`.                                                                                                                                                                                                                                 |
| `components/shared/trust-badge.tsx`                                                                                               | `GuaranteeBadge`, `ImportTaxLine` (`amount`, `ratePercent`), `DeliveryWindow` (`range`); `variant="card"` ou inline.                                                                                                                                                                                                                        |
| `components/shared/order-status.tsx`                                                                                              | `OrderTimeline`, `OrderStatusBadge`, `ORDER_STATUS_META`.                                                                                                                                                                                                                                                                                   |
| `components/shared/states.tsx`                                                                                                    | `EmptyState` (`illustration`: bag · search · heart · box · wifi · alert · check), `ErrorState`, `SectionHeader`, `HorizontalScroller`.                                                                                                                                                                                                      |
| `components/shared/illustrations.tsx`                                                                                             | `Illustration name=…` (ilustrações lineares).                                                                                                                                                                                                                                                                                               |
| `components/shared/quantity-stepper.tsx`, `rating-stars.tsx`, `favorite-button.tsx`, `back-button.tsx`, `form-field.tsx`          | utilitários já no novo desenho.                                                                                                                                                                                                                                                                                                             |
| `components/layout/store-shell.tsx`                                                                                               | `StoreShell` (props do Header: `title`, `showBack`, `hideSearch`, `action`, `hideMobileBar`; `hideBottomNav`), `PageContainer`, `StickyBar` (`tone="light"                                                                                                                                                                                  | "dark"`).                       |
| `components/layout/header.tsx`                                                                                                    | Header sticky com pill de busca (home) ou voltar + título. `CartBadge`.                                                                                                                                                                                                                                                                     |
| `components/layout/brand-mark.tsx`, `brand-logo.tsx`, `tricolor-stripe.tsx`                                                       | Marca. `BrandLogo` (sacola) sobre `bg-brand-deep`; `BrandLogo tile` em superfícies claras.                                                                                                                                                                                                                                                  |

## Tokens (classes) — use SÓ estes

- Fundos: `bg-background` (página) · `bg-surface` (cards, header) · `bg-surface-muted` (imagens, inputs, chips) ·
  `bg-brand-deep` (hero/rodapé escuros) · `bg-primary` · `bg-primary-soft` · `bg-cta` · `bg-success-soft` ·
  `bg-warning-soft` · `bg-danger-soft` · `bg-overlay`.
- Texto: `text-foreground` · `text-foreground-secondary` · `text-foreground-muted` (só sobre `bg-surface`) ·
  `text-primary` · `text-success` · `text-warning` · `text-danger` · `text-white` (sobre brand-deep/primary/cta) ·
  `text-primary-foreground` · `text-cta-foreground`.
- Bordas: `border-border` (padrão) · `border-border-strong` (inputs/hover) · `border-primary` (selecionado).
- Tipografia: `text-display` · `text-title-1` · `text-title-2` · `text-title-3` · `text-body` · `text-body-sm` ·
  `text-caption`. Pesos só `font-medium` e `font-semibold` (nunca `font-bold`/`font-extrabold`). Números:
  `tabular-nums`.
- Raios: `rounded-sm` (8) · `rounded-md` (12) · `rounded-lg` (16) · `rounded-xl` (24) · `rounded-full`.
- Sombras: `shadow-xs` (cards) · `shadow-sm` (hover/flutuante) · `shadow-md` (popover/toast) · `shadow-lg`
  (sheet/modal).
- Espaço: múltiplos de 8 no layout (`gap-2/4/6/8`, `p-4`, `py-8`, `mt-8`); `gap-1`, `px-1`, `mt-1`… só dentro
  de componentes. Margem lateral `px-4` (via `PageContainer`). Entre seções: `gap-8`.
- Movimento: `pressable` em tocáveis; `transition-colors` / `transition-transform` / `transition-opacity` /
  `transition-shadow` (nunca `transition-all`); `focus-ring` para foco visível.
- Ícones: `lucide-react`, `strokeWidth={1.75}`, `size-5` inline e `size-6` navegação.

## Substituições obrigatórias (procure e troque)

| Legado (remover)                                                                                            | Novo                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `bg-card`, `bg-canvas-0`                                                                                    | `bg-surface`                                                                                       |
| `bg-surface` usado como fundo cinza, `bg-canvas-100`, `bg-muted`                                            | `bg-surface-muted`                                                                                 |
| `bg-surface-strong`, `bg-canvas-200`                                                                        | `bg-surface-muted` (ou `bg-border` para trilhos)                                                   |
| `text-muted-foreground`, `text-ink-500`, `text-placeholder`, `text-ink-400`, `text-chevron`, `text-ink-300` | `text-foreground-secondary` (metadados) ou `text-foreground-muted` (legendas sobre surface)        |
| `text-body`, `text-ink-700`                                                                                 | `text-foreground-secondary`                                                                        |
| `bg-ink` / `text-ink-foreground` / `text-ink-muted` / `shadow-ink`                                          | `bg-brand-deep text-white` (barras escuras) ou `Button variant="inverse"`                          |
| `bg-header` / `text-header-foreground`                                                                      | `bg-brand-deep text-white`                                                                         |
| `bg-accent` / `text-accent-foreground`                                                                      | `bg-primary-soft` / `text-primary`                                                                 |
| `bg-selected`                                                                                               | `bg-primary-soft/50` + `border-primary`                                                            |
| `bg-destructive-soft` / `text-destructive`                                                                  | `bg-danger-soft` / `text-danger` (sempre com ícone + texto)                                        |
| `border-line-100/200/300`, `border-input`, `border-border` em cards                                         | `border-border` (cards, divisores) / `border-border-strong` (inputs)                               |
| `brand-blue-*`, `brand-red-*`, `bg-white/[0.13]`, hex no JSX                                                | semânticos acima (sobre brand-deep: `bg-white/10`, `text-blue-300` só em texto secundário do hero) |
| `text-star` / `fill-star`                                                                                   | `text-gold` / `fill-gold` (só ícones)                                                              |
| `shadow-card` · `shadow-float` · `shadow-cta` · `shadow-primary`                                            | `shadow-xs` · `shadow-sm` · nenhuma · nenhuma                                                      |
| `rounded-2xl`, `rounded-3xl` (cards) · `rounded-4xl` (sheets) · `rounded-[Npx]`                             | `rounded-lg` · `rounded-xl` · valor da escala                                                      |
| `text-[13px]`, `text-[11.5px]`, `text-xs/sm/base/lg/xl/2xl`, `text-[19px]`…                                 | escala `text-caption` … `text-display`                                                             |
| `font-bold`, `font-extrabold`, `tracking-tight` avulso                                                      | `font-semibold` (títulos já trazem peso e tracking na escala)                                      |
| `animate-rise` + `animationDelay` escalonado, `animate-bump`, `rise()`                                      | remover (sem animações de entrada); `animate-pop` só no coração                                    |
| `pressable` em cards: manter. `hover:-translate-y-0.5`: remover                                             | `transition-shadow hover:shadow-sm`                                                                |
| `<Sheet side="bottom">`                                                                                     | `BottomSheet` + `BottomSheetContent/Header/Body/Footer`                                            |
| `Button variant="white"                                                                                     | "ink"                                                                                              | "outline"    | "success"`                        | `floating` · `inverse` · `secondary` · `primary` |
| `Badge variant="default"                                                                                    | "ink"                                                                                              | "secondary"` | `primary` · `inverse` · `neutral` |
| `StickyBar tone="ink"`                                                                                      | `tone="dark"`                                                                                      |
| `TricolorStripe` sobre fundo claro                                                                          | remover (só sobre `bg-brand-deep`)                                                                 |
| `tint-*` / `hueStyle` fora dos tiles de categoria                                                           | `bg-surface-muted` + ícone `text-primary`                                                          |
| `EmptyState tone=…` / `icon=…`                                                                              | `illustration="…"`                                                                                 |
| `SectionHeader iconTone=…`                                                                                  | remover a prop                                                                                     |
| Estados de erro sem ícone                                                                                   | `ErrorState` ou ícone + texto em `text-danger`                                                     |

## Regras de composição

1. **Um único `variant="cta"` visível por tela.** O resto é `primary`/`secondary`/`ghost`.
2. **Cards**: `rounded-lg border border-border bg-surface p-4 shadow-xs`. Nunca card dentro de card; listas
   dentro de um card usam `divide-y divide-border`.
3. **Cabeçalho da página**: use o `Header` via `StoreShell` (`title` + `showBack` em páginas internas; nada na
   home). Não desenhe barras próprias, exceto onde o brief da tela pedir (`hideMobileBar`).
4. **Preço nunca vermelho**; desconto em `text-success`; erros em `text-danger` com ícone.
5. **Textos**: pt-BR direto e caloroso, botões com verbo. Mantenha as chaves do next-intl; se precisar de um
   texto novo, adicione em `pt-BR.json` E `es-PY.json`.
6. **Skeletons** no formato exato do conteúdo; nada de spinner de página inteira.
7. **Mobile-first 390 px**, depois `sm/md/lg`. Safe-area já é tratada pelo `StoreShell`/`StickyBar`.
8. Não altere `globals.css`, `components/ui/*`, `components/shared/*` nem `components/layout/*`. Se um
   componente compartilhado precisar de algo, resolva localmente na sua feature e relate no final.
9. Não crie arquivos fora da sua lista, exceto pequenos componentes dentro da sua própria pasta de feature.

## Verificação (obrigatória antes de encerrar)

```bash
cd "C:/Users/GABRIEL.CARDOSO/Documents/ERP/Nova pasta/marketplace-py/apps/web"
pnpm typecheck && pnpm lint
```

O dev server já está rodando em http://localhost:3210 (não inicie outro; não rode `pnpm build`). Faça capturas
de tela a 390 px com o Chrome instalado via Playwright (o comando abaixo funciona; `--wait-for-selector` deve
apontar para um elemento que só existe depois dos dados do mock carregarem, ex. `main h1`, `article`):

```bash
cd "C:/Users/GABRIE~1.CAR/AppData/Local/Temp/claude/C--Users-GABRIEL-CARDOSO-Documents-ERP-Nova-pasta/32f7e6a5-b6b0-4e8c-a7c0-1b90e74732e8/scratchpad"
pnpm dlx playwright@1.56.0 screenshot --channel chrome --viewport-size "390,900" --full-page --wait-for-selector "main article" --wait-for-timeout 5000 "http://localhost:3210/ROTA" "./NOME.png"
```

Abra a imagem (Read) e corrija o que estiver fora do DESIGN.md. Imagens lazy fora da dobra podem aparecer
vazias na captura: isso é esperado. Para páginas muito altas, recorte com `sharp` (disponível em
`apps/web/node_modules`) em fatias de ~1400 px antes de abrir.

Para páginas que exigem sessão (conta, pedidos, checkout), faça login antes no mesmo contexto: o CLI do
Playwright não guarda sessão, então prefira validar essas telas pelo typecheck/lint e por leitura cuidadosa
do JSX, e capture o que for público (ex.: `/entrar`, `/cadastrar`).

## Relatório final (formato)

- Arquivos alterados.
- O que mudou visualmente em cada tela (uma linha por tela).
- Pendências: o que não coube nas regras ou precisa de mudança em componente compartilhado.
