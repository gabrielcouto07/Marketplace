# Design system

Fonte visual: protótipo "Marketplace App" no Claude Design (arquivo `Marketplace App.dc.html`), mobile-first em 390 px.
Identidade: azul **#0038A8** e vermelho **#D52B1E** da bandeira do Paraguai sobre um **canvas cinza-azulado** com
cartões brancos sem borda, cantos generosos, tipografia **Plus Jakarta Sans** e tintas de cor por categoria.
A personalidade vem de quatro coisas: hero azul com formas decorativas, botão de busca flutuante na bottom nav,
tintas oklch por categoria/loja e micro-animações (pressable, rise, pop, bump).

## Tokens (`apps/web/src/app/globals.css`)

Definidos como CSS custom properties em `:root` (light) e `.dark`, expostos ao Tailwind v4 via `@theme inline`.

### Cores

| Token / classe                                      | Valor                             | Uso                                                          |
| --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| `bg-background`                                     | #F3F5F9                           | fundo da página (canvas)                                     |
| `bg-card` / `bg-popover`                            | #FFFFFF                           | cartões, sheets, inputs                                      |
| `text-foreground`                                   | #0F1728                           | títulos e texto principal                                    |
| `text-body`                                         | #3D4658                           | texto corrido (descrições, avaliações)                       |
| `text-muted-foreground`                             | #5A6478                           | secundário (metadados, hints)                                |
| `text-placeholder` / `text-ink-400`                 | #7A8398                           | placeholders, nav inativa                                    |
| `text-chevron` / `text-ink-300`                     | #9AA2B4                           | chevrons e ícones decorativos                                |
| `border-border` (`line-100`)                        | #EEF0F4                           | divisores internos                                           |
| `border-input` (`line-200`)                         | #E1E5EC                           | bordas de inputs, chips e opções                             |
| `border-line-300`                                   | #C7CEDB                           | bordas tracejadas ("+ Novo endereço")                        |
| `bg-surface` / `bg-surface-strong`                  | #F3F5F9 / #E6E9EF                 | trilhos, tiles, fundos de imagem, segmented control          |
| `bg-primary` / `text-primary`                       | #0038A8 (`primary-hover` #002E8A) | botão principal, links, estados ativos, foco                 |
| `bg-accent` / `text-accent-foreground`              | #EEF3FC / #0038A8                 | pílulas e caixas informativas azuis                          |
| `bg-selected`                                       | #F5F8FE                           | opção selecionada (endereço, frete, pagamento, variação)     |
| `bg-cta` / `text-cta`                               | #D52B1E (`cta-hover` #B72316)     | "Comprar agora", selos de oferta, badge do carrinho          |
| `bg-destructive-soft` / `text-destructive`          | #FDEEEC / #B42318                 | erros, "Sair", cancelado                                     |
| `bg-success-soft` / `text-success`                  | #E9F6EE / #15803D                 | frete grátis, aprovado, compra verificada                    |
| `bg-warning-soft` / `text-warning`                  | #FFF4E0 / #9A4A06                 | aguardando pagamento, offline, "faltam R$ X"                 |
| `bg-ink` / `text-ink-foreground` / `text-ink-muted` | #0F1728 / #FFF / #AFB8CC          | barras flutuantes, toasts, câmbio travado, chips de contagem |
| `text-star` / `fill-star`                           | #E29A00                           | estrelas de avaliação                                        |
| `brand-blue-50…900`, `brand-red-50…900`             | escalas                           | detalhes de marca (faixa tricolor, hover)                    |

Tintas por categoria/loja (`src/lib/palette.ts`): `categoryHue(slug)` devolve uma matiz fixa por categoria
(eletrônicos 255, perfumes 350, informática 220, celulares 295, bebidas 50, casa 175, esportes 145, moda 25; slugs
novos caem num hash) e as utilidades `tint-bg` (oklch 0.945/0.045), `tint-bg-strong` (0.9/0.07), `tint-bg-deep`
(0.6/0.15) e `tint-fg` leem `--hue` do elemento (`style={hueStyle(hue)}`). `sellerColor(slug)` dá a cor de marca de
cada loja para o avatar com iniciais (`initials(name)`).

### Contraste (WCAG AA)

| Combinação                                       | Razão             | Resultado               |
| ------------------------------------------------ | ----------------- | ----------------------- |
| Branco sobre `#0038A8` (hero, botão primário)    | ≈ 10,9:1          | AAA                     |
| Branco sobre `#D52B1E` (CTA)                     | ≈ 5,2:1           | AA (texto ≥ 14 px bold) |
| `#5A6478` (muted) sobre branco / sobre `#F3F5F9` | ≈ 6,6:1 / ≈ 6,0:1 | AA                      |
| `#0F1728` sobre `#F3F5F9`                        | ≈ 16:1            | AAA                     |
| `#15803D` sobre `#E9F6EE`                        | ≈ 4,9:1           | AA                      |
| `#9A4A06` sobre `#FFF4E0`                        | ≈ 6,3:1           | AA                      |
| `#B42318` sobre `#FDEEEC`                        | ≈ 6,0:1           | AA                      |

Regra: texto de UI nunca abaixo de `muted-foreground`; texto sobre vermelho sempre branco e ≥ 14 px bold ou ≥ 16 px;
`text-placeholder` só em placeholders e rótulos inativos da bottom nav (11 px bold).

### Raios, sombras e tipografia

| Classe                                         | Valor         | Uso                                                      |
| ---------------------------------------------- | ------------- | -------------------------------------------------------- |
| `rounded-sm` / `rounded-md`                    | 10 / 12 px    | chips pequenos, botões `sm`, thumbnails                  |
| `rounded-lg`                                   | 14 px         | botões-ícone 44 px, inputs, caixas de ícone, stepper     |
| `rounded-xl`                                   | 16 px         | botões, cartões de opção, imagens de card                |
| `rounded-2xl`                                  | 20 px         | cards pequenos (produto, loja em destaque, menus)        |
| `rounded-3xl`                                  | 24 px         | cards de conteúdo, estados vazios                        |
| `rounded-4xl`                                  | 28 px         | bottom sheets                                            |
| `shadow-card` / `shadow-float`                 | 1 px / 2–8 px | cards / botões brancos flutuantes                        |
| `shadow-cta` / `shadow-primary` / `shadow-ink` | coloridas     | CTA vermelho / busca flutuante / barras escuras e toasts |

Tipografia (Plus Jakarta Sans via `next/font`, pesos 400–800): título de página 28 px/800 `tracking-[-0.03em]`;
seção 18 px/800 `tracking-tight`; título de card 15–16 px/800; corpo 13–14 px; rótulos, chips e botões 700;
preço inteiro 800 com `tabular-nums`. Nomes de produto usam peso 500 em 13 px (2 linhas).

### Animações e feedback

`pressable` (encolhe a 97 % no toque — cards, tiles, botões), `animate-rise` (entrada com fade + 10 px; usar
`animationDelay` escalonado em listas), `animate-pop` (coração ao favoritar), `animate-bump` (badge do carrinho ao
mudar), `shimmer` (skeletons). Todas desligam com `prefers-reduced-motion`.

## Layout

| Token                          | Valor                    | Uso                                                                                         |
| ------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------- |
| `--header-height`              | 3.5rem                   | reservado (barra desktop tem 64 px)                                                         |
| `--bottom-nav-height`          | 4.75rem (76 px)          | bottom nav; `h-bottom-nav`, `pb-[calc(var(--bottom-nav-height)+var(--safe-bottom)+1.5rem)]` |
| `--safe-top` / `--safe-bottom` | `env(safe-area-inset-*)` | iPhone; utilitários `pt-safe`, `pb-safe`                                                    |
| Gutter                         | 16 px (`px-4`)           | `PageContainer` (max-w-6xl); carrosséis sangram com `-mx-4 px-4`                            |
| Toque                          | ≥ 44 px                  | `Button size="icon"` 44 px, inputs 48 px, `touch-target`                                    |

Estrutura das telas (mobile): faixa tricolor de 4 px no topo → **cabeçalho da página** (um de três tipos) → conteúdo
em cards sobre o canvas → bottom nav (Início · Categorias · **Buscar flutuante** · Carrinho · Conta).

| Cabeçalho                                                             | Onde                                    | Componente                                          |
| --------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| Hero azul (marca, favoritos, carrinho, botão de busca, entrega)       | Home                                    | `features/home/components/home-hero.tsx`            |
| Barra translúcida com `BackButton` + título 19 px (+ atalho de busca) | páginas internas com `title`/`showBack` | `Header` (mobile)                                   |
| Botões brancos flutuantes sobre imagem/hero                           | produto, loja                           | `BackButton` + `Button variant="white" size="icon"` |

Em ≥ `md` o `Header` mostra sempre a barra branca com `BrandMark`, campo de busca e atalhos; a bottom nav some.
Barras fixas no rodapé usam `StickyBar` (`light`: total do checkout / comprar; `ink`: resumo do carrinho).

## Componentes

### shadcn/ui (`components/ui`)

Estilo **base-nova** sobre **Base UI** — sem `asChild`; composição por `render={<Link href="…" />}`. Ajustes desta
identidade: `Button` (h-12, `font-bold`, variantes `default | cta | outline | soft | secondary | ghost | white | ink |
destructive | success | link`; tamanhos `xs | sm | default | lg | icon | icon-sm | icon-lg`), `Input`/`Textarea`
(48 px, borda 1,5 px, foco azul), `Tabs` (segmented control de largura total; `variant="line"`), `Sheet side="bottom"`
(alça, 28 px, `pb-safe`), `Dialog` (24 px, `shadow-ink`), `Badge` (pílulas 22 px: `default | cta | soft | success |
warning | danger | ink | secondary | outline`), `Skeleton` (shimmer), `Card` (24 px, sem borda), `Checkbox` 22 px,
`Switch` 48×28, `Progress` (trilho 6 px), toasts `sonner` no estilo ink.

### Compartilhados (`components/shared`)

| Componente                                                                                                                     | Descrição                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProductCard` / `ProductCardSkeleton`                                                                                          | card branco 20 px: imagem 1:1 arredondada, selos em pílula (-%, Novo), coração, nome 2 linhas, ★ nota · vendidos, riscado, preço, parcela, frete grátis; `layout="row"` = 160 px |
| `PriceTag`                                                                                                                     | símbolo/inteiro/decimais com o inteiro em 800; `installments="short                                                                                                              | long"`, `showDiscountBadge`, referência PYG; tamanhos sm/md/lg                     |
| `RatingStars`                                                                                                                  | `variant="full"` (5 estrelas com meia) ou `compact` (★ + nota)                                                                                                                   |
| `SellerBadge` (`inline                                                                                                         | pill                                                                                                                                                                             | card`), `SellerAvatar`(iniciais na cor da loja),`ReputationMeter`, `OfficialBadge` | identidade da loja |
| `CategoryTile` (`icon                                                                                                          | card`)                                                                                                                                                                           | atalho de categoria com tinta própria                                              |
| `QuantityStepper`                                                                                                              | trilho cinza + botões brancos; lixeira no mínimo                                                                                                                                 |
| `FavoriteButton` (`sm                                                                                                          | md`)                                                                                                                                                                             | círculo branco em cards / quadrado branco em galerias, com pop                     |
| `EmptyState` / `ErrorState`                                                                                                    | card branco com ícone em quadrado colorido (`tone="blue                                                                                                                          | red                                                                                | green"`)           |
| `SectionHeader`                                                                                                                | 18 px/800 com ícone (raio das ofertas) e chip `meta` (contagem regressiva)                                                                                                       |
| `HorizontalScroller`, `BackButton`, `OrderStatusBadge` / `OrderTimeline`, `CategoryIcon`, `FormField`, `CepShippingCalculator` | utilitários                                                                                                                                                                      |

### Layout (`components/layout`)

`StoreShell` (faixa tricolor, `Header`, `OfflineBanner`, `main`, `BottomNav`, `InstallPrompt`; props `title`, `showBack`,
`hideSearch`, `action`, `hideBottomNav`), `PageContainer`, `StickyBar`, `Header` (barra mobile condicional + barra
desktop), `BottomNav` (busca flutuante 60 px), `BrandMark` (símbolo com faixa tricolor + wordmark, `tone="dark|light"`),
`TricolorStripe`, `InstallPrompt`, `OfflineBanner`, `PanelShell`, `Providers`, `PwaProvider`.

## Acessibilidade

- Foco visível (`focus-visible:ring-*`) em todos os controles; `aria-current="page"` na navegação; `aria-pressed` em chips.
- Labels em inputs (visíveis ou `sr-only`), `aria-invalid`/`aria-describedby` nos formulários.
- Imagens de produto com `alt` = nome; decorativas com `alt=""` / `aria-hidden`.
- Contraste conforme tabela acima; animações respeitam `prefers-reduced-motion`.

## Modo escuro

Tokens redefinidos em `.dark` (`next-themes` com `attribute="class"`, hoje fixo em light — `enableSystem={false}`).
Para ativar: trocar `defaultTheme`/`enableSystem` em `components/layout/providers.tsx`. Sem prioridade visual agora.
