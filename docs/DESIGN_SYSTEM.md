# Design system

Identidade: sacola de compras nas cores da bandeira do Paraguai. Estética limpa, confiável, estilo marketplace
moderno, mobile-first (~390 px), cantos arredondados (`--radius: 0.75rem`), tipografia **Inter** (`next/font`).

## Tokens de cor (`src/app/globals.css`)

Definidos como CSS custom properties em `:root` (light) e `.dark`, e expostos ao Tailwind v4 via `@theme inline`.

| Escala | Base | Uso | Classes Tailwind |
| --- | --- | --- | --- |
| `--py-blue-50…900` | **#0038A8** (600) | primária: header, links, estados ativos, foco | `bg-brand-blue-600`, `text-brand-blue-700`… |
| `--py-red-50…900` | **#D52B1E** (500) | CTA ("Comprar", "Adicionar ao carrinho"), selos de oferta, badge do carrinho | `bg-brand-red-500`, `text-brand-red-600`… |
| `--py-neutral-0…900` | #FFFFFF / slate frio | fundos, textos, bordas | `bg-neutral-50`, `text-neutral-600`, `border-neutral-200` |
| `--py-success-*` | #15803D | apenas status de sucesso (frete grátis, pagamento aprovado) | `text-success`, `bg-success-soft` |
| `--py-warning-*` | #B45309 | pendências (aguardando pagamento, offline) | `text-warning`, `bg-warning-soft` |

Tokens semânticos (mapeados para shadcn): `--primary` = blue-600, `--cta` = red-500 (+ `--cta-hover`), `--accent` =
blue-50/700, `--destructive` = red-600, `--muted-foreground` = neutral-600, `--border` = neutral-200, `--ring` =
blue-500, `--header`/`--header-foreground`, `--surface`.

### Contraste (WCAG AA)

| Combinação | Razão | Resultado |
| --- | --- | --- |
| Branco sobre `#0038A8` (header, botão primário) | ≈ 10,9:1 | AAA |
| Branco sobre `#D52B1E` (CTA) | ≈ 5,2:1 | AA (texto normal) |
| `#475569` (muted-foreground) sobre branco | ≈ 7,6:1 | AAA |
| `#0038A8` link sobre branco | ≈ 10,9:1 | AAA |
| `#15803D` sucesso sobre branco | ≈ 5,1:1 | AA |
| `#B45309` warning sobre `#FFFBEB` | ≈ 5,6:1 | AA |

Regra: texto de UI nunca abaixo de `neutral-600` sobre branco; texto sobre vermelho sempre branco e ≥ 14 px bold ou
≥ 16 px.

### Modo escuro

Tokens redefinidos em `.dark` (`next-themes` com `attribute="class"`, hoje fixo em light — `enableSystem={false}`).
Para ativar: trocar `defaultTheme`/`enableSystem` em `components/layout/providers.tsx`. Sem prioridade visual agora.

## Detalhe de marca

- **Faixa tricolor** (`.tricolor-stripe`, 4 px vermelho/branco/azul) sob o header (`TricolorStripe`) e no rodapé da
  imagem de splash/OG (`public/og-default.png`).
- **Logo** `public/logo.svg` (placeholder: sacola com listras + estrela). Ícones do manifest gerados por
  `scripts/generate-icons.mjs` (192, 512, maskable 192/512, apple-touch 180, favicon 32, OG 1200×630).

## Layout e espaçamento

| Token | Valor | Uso |
| --- | --- | --- |
| `--header-height` | 3.5rem (56 px) | header sticky; `h-header` |
| `--bottom-nav-height` | 3.75rem (60 px) | bottom nav; `h-bottom-nav`, `pb-[calc(var(--bottom-nav-height)+var(--safe-bottom)+1rem)]` |
| `--safe-top` / `--safe-bottom` | `env(safe-area-inset-*)` | iPhone (viewport-fit=cover); utilitários `pt-safe`, `pb-safe` |
| Gutter | 16 px (`px-4`) | `PageContainer` (max-w-6xl) |
| Toque | ≥ 44 px | `Button` default `h-11`, `size="icon"` = 44 px, `Input` `h-11`; utilitário `touch-target` |

Grid de produtos: 2 colunas no mobile, 3–5 em telas maiores; carrosséis horizontais com `snap-x` (`HorizontalScroller`).

## Componentes

### shadcn/ui (`components/ui`)
Estilo **base-nova** sobre **Base UI** (`@base-ui/react`). Diferenças em relação ao Radix:
- não há `asChild` — use `render={<Link href="…" />}` em `Button`, `*Trigger`, `Badge`;
- `Select` do Base UI é verboso; para selects simples em mobile preferimos `<select>` nativo estilizado;
- `Sheet`/`Dialog`/`Drawer` funcionam controlados (`open`, `onOpenChange`).
Tamanhos foram ajustados para toque (botão 44 px, input 44 px, tabs 40 px). Variantes extras do `Button`: `cta`
(vermelho) e `success`.

### Compartilhados (`components/shared`)
| Componente | Descrição |
| --- | --- |
| `ProductCard` / `ProductCardSkeleton` | card denso: imagem quadrada, selos (-%/Novo/Esgotado), PriceTag, frete grátis, rating, loja, favorito |
| `PriceTag` | BRL em destaque (símbolo/inteiro/decimais separados), riscado, referência PYG, parcelas; tamanhos sm/md/lg |
| `RatingStars` | 0–5 com meia estrela, contagem, `aria-label` |
| `SellerBadge` / `ReputationMeter` | inline (nome + selo oficial) ou card (logo, cidade, termômetro 1–5) |
| `FavoriteButton` | toggle persistido, `aria-pressed`, toast |
| `QuantityStepper` | −/+ com input numérico, remove no mínimo, ≥ 44 px |
| `OrderStatusBadge` / `OrderTimeline` | badge por status com ícone e tom; timeline vertical com ramificações (cancelado/disputa) |
| `EmptyState` / `ErrorState` | estados caprichados; `ErrorState` diferencia offline/404/genérico e oferece retry |
| `SectionHeader`, `HorizontalScroller`, `CategoryIcon` | utilitários de layout |
| `CepShippingCalculator` (features/shipping) | input CEP + cotação por vendedor |

### Layout (`components/layout`)
`Header` (logo, busca sempre visível, carrinho com badge, voltar em páginas internas), `BottomNav` (Início,
Categorias, Carrinho c/ badge, Favoritos, Conta; some em ≥ md), `TricolorStripe`, `InstallPrompt`,
`OfflineBanner`, `StoreShell` (casca padrão), `Providers`, `PwaProvider`.

## Acessibilidade
- Foco visível (`focus-visible:ring-*`) em todos os controles; `aria-current="page"` na navegação.
- Labels em inputs (visíveis ou `sr-only`), `aria-invalid`/`aria-describedby` nos formulários.
- Imagens de produto com `alt` = nome; decorativas com `alt=""`.
- Contraste conforme tabela acima; `prefers-reduced-motion` respeitado nas animações do shadcn (`shimmer`).
