# DESIGN.md — Marketplace Paraguai

Este documento é a fonte de verdade visual e de código de UI do projeto. Toda tarefa de interface deve
segui-lo. Os apêndices no final registram a análise da marca (ícone) e as decisões de adaptação tomadas
na implementação, com o mapeamento token → CSS → classe Tailwind.

# Persona

Atue como Engenheiro Frontend Sênior e Designer de Produto de nível internacional.
Referências de qualidade: Linear, Vercel, Apple, Stripe, Airbnb e Shopify, cada uma
pelo seu mérito específico:

- Linear e Vercel: precisão, densidade elegante e bordas finas
- Apple: tipografia e respiro
- Stripe: clareza em dinheiro e checkout
- Airbnb e Shopify: cards de produto e confiança em compra

O resultado nunca pode parecer template (Bootstrap, admin genérico, "landing de IA"
com gradiente roxo). Cada decisão visual deve ter motivo.

# O produto

Marketplace PWA mobile-first que conecta vendedores do Paraguai a compradores no
Brasil (referência funcional: Mercado Livre). A marca é uma sacola de compras nas
cores da bandeira paraguaia (vermelho, branco, azul). O app deve transmitir:
CONFIANÇA (comprar de outro país dá medo), CLAREZA (preço, frete, impostos e prazo
sempre explícitos) e ENERGIA (ofertas, descoberta). Premium, mas acessível: nada
de luxo frio.

# Regra de ouro das cores

As cores exatas da bandeira são MARCA, não decoração:

- #0038A8 (azul) e #D52B1E (vermelho) aparecem em pontos focais: logo, CTAs,
  estado ativo, badges.
- Áreas grandes usam neutros ou azul-marinho profundo (blue-900/950), nunca a cor
  saturada chapada.
- Proporção guia por tela: ~85% neutros, ~10% azul, ~5% vermelho.
- Máximo de UM botão vermelho (CTA primário) visível por tela.
- NÃO usar o brasão ou escudo nacional em nenhum lugar.

# Tokens de cor

Implemente como CSS variables no globals.css, via @theme do Tailwind v4, e mapeie
para os tokens do shadcn/ui. Componentes usam APENAS tokens semânticos, nunca hex
direto nem classes de cor cruas.

## Escalas primitivas

blue (Azul Paraguai)
50 #EFF4FD · 100 #DCE6FA · 200 #BACDF4 · 300 #8AAAEA · 400 #5580DC
500 #2A5DC7 · 600 #0038A8 (bandeira) · 700 #002F8E · 800 #002672
900 #0A1F52 · 950 #061333

red (Vermelho Paraguai)
50 #FEF2F1 · 100 #FDE3E0 · 200 #FAC7C1 · 300 #F49E95 · 400 #E96A5D
500 #D52B1E (bandeira) · 600 #BA2419 · 700 #9A1E15 · 800 #7A1912 · 900 #56130E

neutral (zinco levemente frio, harmoniza com o azul)
0 #FFFFFF · 50 #F8F8F9 · 100 #F1F1F3 · 200 #E4E4E8 · 300 #D0D0D6
400 #A3A3AD · 500 #74747F · 600 #55555F · 700 #3F3F48 · 800 #28282F
900 #18181D · 950 #0F0F12

green 50 #F0FDF4 · 600 #15803D · 700 #166534
amber 50 #FFFBEB · 600 #B45309 · 700 #92400E

## Semânticos (light)

    --background        neutral-50    (fundo do app; cards brancos se destacam sobre ele)
    --surface           neutral-0     (cards, sheets, header)
    --surface-muted     neutral-100   (fundo de imagem de produto, inputs, chips)
    --border            neutral-200
    --border-strong     neutral-300
    --text              neutral-900   (nunca #000)
    --text-secondary    neutral-600
    --text-muted        neutral-500   (somente sobre surface branca; validar 4.5:1)
    --primary           blue-600      hover blue-700 · soft blue-50 · on-primary #FFF
    --cta               red-500       hover red-600 · pressed red-700 · on-cta #FFF
    --success           green-600     soft green-50  (frete grátis, % de desconto, entregue)
    --warning           amber-600     soft amber-50  (estoque baixo, prazo estendido)
    --danger            red-700       soft red-50    (erros SEMPRE com ícone + texto,
                                                      para não confundir com o CTA)
    --focus-ring        blue-500, 2px, offset 2px
    --brand-deep        blue-950      (hero, splash, footer, header do painel)

## Semânticos (dark)

    --background neutral-950 · --surface neutral-900 · --surface-muted neutral-800
    --border neutral-800 · --border-strong neutral-700
    --text neutral-50 · --text-secondary neutral-400
    --primary blue-400 · --cta red-500 (mantém o texto branco legível)

Dark mode via classe + prefers-color-scheme. O light é a prioridade visual.

## Assinatura tricolor

Uma faixa de 3px vermelho | branco | azul. Ela só aparece sobre superfícies escuras
ou azuis (splash, hero da home, footer, onboarding), onde o branco é visível. Em
superfícies claras, a marca vive só no logo. É um detalhe de assinatura, não um
padrão repetido.

# Tipografia

Fonte: Geist Sans (pacote `geist`, via next/font), com fallback para system-ui.
Números de preço, quantidade e rastreio usam `tabular-nums`.

Escala mobile (tamanho/altura de linha, peso, tracking):

- display 30/36 semibold -0.02em (hero, valor total no checkout)
- title-1 24/32 semibold -0.015em (título de página)
- title-2 20/28 semibold -0.01em (seções)
- title-3 17/24 semibold (títulos de card, nome do produto na PDP)
- body 16/24 normal (texto corrido; leading-relaxed em descrições longas)
- body-sm 14/20 normal (metadados, listas densas)
- caption 12/16 medium +0.01em (badges, labels, legendas)

Regras:

- No máximo 3 tamanhos por componente.
- Hierarquia por peso e cor antes de tamanho.
- Inputs sempre com 16px ou mais (evita zoom no iOS).
- Nada abaixo de 12px.
- Títulos de card de produto limitados a 2 linhas (line-clamp).

# Espaçamento, raio e elevação

Grid de 8px: todo padding, margin e gap de layout é múltiplo de 8
(8, 16, 24, 32, 40, 48, 64). O valor 4px é permitido só dentro de componentes
(ícone e texto, badge).

- Margem lateral mobile: 16px.
- Espaço entre seções: 32px.
- Padding interno de card: 16px.

Raios:

- 8 (chips, badges)
- 12 (botões, inputs)
- 16 (cards, imagens)
- 24 (bottom sheets, topo)
- full (avatares, pills)

Elevação: preferir borda fina + sombra mínima. Sombras em camadas, sutis e frias:

- xs 0 1px 2px rgb(15 15 18 / 0.05)
- sm 0 1px 3px rgb(15 15 18 / 0.06), 0 1px 2px rgb(15 15 18 / 0.04)
- md 0 4px 12px rgb(15 15 18 / 0.08) (dropdowns, popovers)
- lg 0 12px 32px rgb(15 15 18 / 0.12) (sheets, modais)

Nenhuma sombra escura e pesada, em nenhum lugar.

# Movimento

- Durações: 150ms (hover, cor), 200ms (press, toggles), 300ms (sheets, páginas).
- Easing padrão: cubic-bezier(0.2, 0, 0, 1). Saídas mais rápidas que entradas.
- Proibido `transition-all`. Use `transition-colors`, `transition-transform`,
  `transition-opacity` ou propriedades explícitas.
- Press em elementos tocáveis: scale(0.98). Nada de hover como única affordance
  (é mobile).
- Use a biblioteca `motion` apenas para bottom sheets, contador do carrinho,
  "adicionar ao carrinho" (item voando até o ícone ou badge pulsando) e troca de
  imagens da galeria.
- Use a View Transitions API entre listagem e página de produto, quando suportada.
- Respeitar `prefers-reduced-motion`: animações viram fade simples ou nada.

# Iconografia e imagem

- lucide-react, stroke 1.75, tamanhos 20 (inline) e 24 (navegação). Sem emojis
  como ícones.
- Imagem de produto: proporção 1:1, object-contain sobre --surface-muted, raio 16,
  next/image com placeholder blur.
- Nunca esticar ou cortar o produto.
- Estados vazios: ilustração linear minimalista em azul e neutros + frase curta +
  uma ação.

# Padrões de componentes

## Botões

- primary-cta: vermelho, altura 48, full-width no mobile. Uso: Comprar agora,
  Finalizar compra, Pagar.
- primary: azul. Uso: ações principais sem conotação de compra.
- secondary: surface + borda. Uso: Adicionar ao carrinho, ao lado do CTA.
- ghost: só texto ou ícone.
- Todos com estado loading (spinner mantendo a largura), disabled e focus-visible.
- Área de toque mínima de 44x44.

## ProductCard

- Imagem 1:1 com botão de favoritar (coração) no canto, em pill translúcida
  com backdrop-blur.
- Título com 2 linhas.
- Linha de preço: preço antigo riscado em muted, preço atual grande em --text
  com centavos menores sobrescritos, % de desconto em --success.
- Parcelamento em body-sm.
- Badge "Frete grátis" em success-soft.
- Origem discreta: "Enviado de Ciudad del Este".
- Hover e press elevam de xs para sm.

## PriceTag

- BRL sempre em destaque.
- Referência em guaranis logo abaixo em caption muted ("≈ ₲ 245.000").
- Valores em unidades mínimas (inteiros), formatados com Intl.NumberFormat.

## Confiança

Estes elementos são o diferencial do produto e precisam ser bonitos, não
burocráticos:

- SellerBadge (reputação em barra, tempo de envio).
- "Compra garantida" com ícone de escudo.
- Linha de impostos de importação estimados, sempre visível no checkout.
- Prazo em faixa de dias úteis.

## Navegação

- Bottom nav: 64px + safe-area, surface com backdrop-blur e borda superior.
- Ícone ativo em --primary com indicador pill atrás. Badge do carrinho em --cta.
- Header sticky translúcido com a busca como elemento principal (input pill 48px).

## Bottom sheets

Usados para filtros, variações, frete por CEP e seleção de pagamento. Topo com
raio 24, handle visível, fechamento por arraste.

## Feedback

- Skeletons com shimmer sutil, no formato exato do conteúdo.
- Toasts discretos no topo.
- Nenhum spinner de página inteira.

## OrderTimeline

Vertical, com pontos conectados.

- Passado: --primary preenchido.
- Atual: anel pulsando.
- Futuro: neutral-300.
- Inclui o status "Em trânsito internacional" com ícone próprio.

## Formulários

- Label acima do campo, helper text abaixo.
- Máscaras de CPF, RUC, CEP e cartão.
- Validação inline no blur, nunca a cada tecla.

# Voz e texto

pt-BR, direto e caloroso, frases curtas. Botões com verbo ("Comprar agora", e não
"Prosseguir"). Evitar jargão de importação. Sempre explicar em uma linha o que um
imposto ou prazo significa.

# Anti-padrões (proibido)

- Gradientes multicoloridos, glassmorphism exagerado, neon, sombras pesadas.
- Texto #000, cinza claro ilegível, preço em vermelho (vermelho é CTA, não preço).
- Bordas grossas, cards dentro de cards, mais de um CTA vermelho por tela.
- Texto longo centralizado, ícones de tamanhos misturados, espaçamentos fora do grid.
- Placeholders tipo "// sua lógica aqui", lorem ipsum ou componentes incompletos.

# Diretrizes de código

- TypeScript strict, sem `any`. Componentes pequenos, semânticos e acessíveis
  (WCAG AA, foco visível, aria correto).
- Variantes de componentes com `class-variance-authority` + `tailwind-merge`
  (padrão shadcn). Nada de strings de classe gigantes repetidas.
- Mobile-first real: desenhar para 390px, adaptar para cima (sm/md/lg).
  Respeitar safe-area (viewport-fit=cover).
- Código completo e pronto para produção.

# Primeira tarefa

1. Salve este documento como DESIGN.md na raiz do repositório e referencie-o no
   CLAUDE.md para que toda tarefa futura o siga.
2. Implemente os tokens (cores light e dark, tipografia, raios, sombras, motion)
   no globals.css e no tema do Tailwind, integrados ao shadcn/ui.
3. Crie a rota /design (styleguide vivo) exibindo:
   - paleta com contrastes;
   - escala tipográfica;
   - todas as variantes de botão e estado;
   - inputs;
   - ProductCard (normal, com desconto, sem estoque, skeleton);
   - PriceTag;
   - SellerBadge;
   - OrderTimeline;
   - bottom nav;
   - um bottom sheet de exemplo;
   - a assinatura tricolor sobre fundo blue-950.
4. Em seguida, construa as telas na ordem de prioridade já definida, sempre
   compondo a partir desses componentes.

---

# Apêndice A — A marca: ícone principal

Arquivo original: `apps/web/public/brand/app-icon-1024.png` (1024×1024, flat). Versão vetorial reconstruída
a partir dele, usada em todo o app: `apps/web/public/logo.svg`. Componente React com a mesma geometria:
`apps/web/src/components/layout/brand-logo.tsx` (`<BrandLogo tile />` para o ícone completo,
`<BrandLogo />` só a sacola, para superfícies escuras).

## O que o ícone é

- **Tile**: quadrado de cantos arredondados (raio ≈ 22 %, estilo iOS) em **navy #0E1B3D**.
- **Sacola**: corpo trapezoidal (mais largo embaixo, cantos suaves) dividido em três faixas horizontais
  iguais: **vermelho #E4312B**, **branco**, **azul #2F6BFF** — a bandeira do Paraguai lida como sacola.
- **Alça**: arco branco, traço grosso (≈ 5 % da largura), sem cabos finos.
- **Estrela**: uma estrela dourada **#FFC629** de cinco pontas arredondadas no centro da faixa branca. Ela
  substitui o brasão da bandeira (que é proibido) e dá o toque de "achado/oferta".
- **Sparkles**: dois traços dourados no canto superior direito, sugerindo novidade e energia.

## Como isso vira sistema

| Elemento do ícone             | Token / uso no app                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Navy do tile #0E1B3D          | `--brand-tile` (`bg-brand-tile`). Só no símbolo da marca, ícones do app, splash e OG. Áreas escuras de UI usam `brand-deep`. |
| Vermelho/azul da sacola       | São cores do **asset**, calibradas para tela. A UI usa as cores da bandeira (`--cta` #D52B1E, `--primary` #0038A8).          |
| Dourado #FFC629               | `--gold` (`text-gold`, `fill-gold`): estrelas de avaliação e o próprio logo. **Nunca** como texto ou fundo de texto.         |
| Sacola tricolor               | A assinatura tricolor de 3 px (`tricolor-stripe`) é a versão "linha" da sacola, só sobre `brand-deep`/`brand-tile`.          |
| Formas cheias e cantos suaves | Justificam os raios generosos (16 em cards, 24 em sheets) e ícones lucide com traço 1.75.                                    |

Regras práticas: o logo com tile aparece em superfícies claras (header, painel, splash de instalação) em
32–40 px; sobre `brand-deep` usa-se a sacola sem tile. O ícone não recebe sombra, contorno nem recolorização.

# Apêndice B — Implementação e decisões

## Tokens → CSS → Tailwind

Definidos em `apps/web/src/app/globals.css`. Primitivos e semânticos ficam em `:root` / `.dark`; o bloco
`@theme inline` expõe tudo ao Tailwind v4 e mapeia os tokens do shadcn/ui.

| Token do documento   | CSS variable                                     | Classe Tailwind                                                           |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| background           | `--background`                                   | `bg-background`                                                           |
| surface              | `--surface` (= `--card`)                         | `bg-surface` / `bg-card`                                                  |
| surface-muted        | `--surface-muted` (= `--muted`)                  | `bg-surface-muted` / `bg-muted`                                           |
| border / strong      | `--border` / `--border-strong`                   | `border-border` (padrão) / `border-border-strong`                         |
| text                 | `--text` (= `--foreground`)                      | `text-foreground`                                                         |
| text-secondary       | `--text-secondary`                               | `text-foreground-secondary`                                               |
| text-muted           | `--text-muted` (= `--muted-foreground`)          | `text-foreground-muted` / `text-muted-foreground`                         |
| primary + hover/soft | `--primary`, `--primary-hover`, `--primary-soft` | `bg-primary`, `hover:bg-primary-hover`, `bg-primary-soft` (= `bg-accent`) |
| on-primary           | `--on-primary` (= `--primary-foreground`)        | `text-primary-foreground`                                                 |
| cta + hover/pressed  | `--cta`, `--cta-hover`, `--cta-pressed`          | `bg-cta`, `hover:bg-cta-hover`, `active:bg-cta-pressed`                   |
| on-cta               | `--on-cta`                                       | `text-cta-foreground`                                                     |
| success / soft       | `--success`, `--success-soft`                    | `text-success`, `bg-success-soft`                                         |
| warning / soft       | `--warning`, `--warning-soft`                    | `text-warning`, `bg-warning-soft`                                         |
| danger / soft        | `--danger` (= `--destructive`), `--danger-soft`  | `text-danger`, `bg-danger-soft`                                           |
| focus-ring           | `--focus-ring` (= `--ring`)                      | utilitário `focus-ring` (outline 2 px, offset 2 px)                       |
| brand-deep           | `--brand-deep`                                   | `bg-brand-deep`                                                           |
| brand-tile, gold     | `--brand-tile`, `--gold`                         | `bg-brand-tile`, `text-gold`/`fill-gold`                                  |
| overlay              | `--overlay`                                      | `bg-overlay` (backdrop de sheets/diálogos)                                |

Tipografia: `text-display`, `text-title-1`, `text-title-2`, `text-title-3`, `text-body`, `text-body-sm`,
`text-caption` já trazem tamanho, altura de linha, peso e tracking. Raios: `rounded-sm` 8 · `rounded-md` 12 ·
`rounded-lg` 16 · `rounded-xl` 24 · `rounded-full`. Sombras: `shadow-xs|sm|md|lg`. Motion: `ease-standard`,
`ease-exit`, `duration-150|200|300`, utilitário `pressable` (scale 0.98 em 200 ms).

A paleta padrão do Tailwind foi **desligada** (`--color-*: initial`): só existem as escalas deste documento,
`white`, `black` (apenas overlays) e os semânticos. Uma classe como `bg-orange-500` simplesmente não compila.

## Decisões de adaptação

1. **Bottom sheets**: construídos sobre `@base-ui/react/drawer` (`components/ui/bottom-sheet.tsx`), que já
   entrega arraste para fechar, snap e acessibilidade. `motion` fica com o contador do carrinho, o pulso de
   "adicionar ao carrinho" e a troca de imagens da galeria, como o documento pede.
2. **Dark mode**: `next-themes` com `attribute="class"` e `enableSystem`, mais `color-scheme`. O light é o
   padrão e o que se valida visualmente; o dark é funcional e usa os semânticos da seção "Semânticos (dark)".
3. **Cards de produto** têm padding interno de 12 px (exceção documentada ao "16 px de card"): em duas colunas
   a 390 px cada card tem 171 px e 16 px comeria 19 % da largura.
4. **Tintas por categoria** (`lib/palette.ts`, utilitários `tint-*`) continuam existindo apenas nos tiles de
   categoria, como cor de descoberta em pastel oklch de baixa croma. Não entram em nenhum outro lugar.
5. **Estados vazios** usam ilustrações lineares inline (`components/shared/illustrations.tsx`) em `primary` e
   neutros, sem imagens externas.
6. **Styleguide `/design`** é interno: textos em pt-BR fixos (fora do next-intl) e `robots: noindex`.
7. **Sem aliases legados**: as classes do redesign anterior (`ink-*`, `line-*`, `canvas-*`, `surface-strong`,
   `shadow-card|float|cta|ink`, `rounded-2xl/3xl/4xl`, `animate-rise`) foram removidas de `globals.css` após a
   migração de todas as telas (25/09/2026). O mapeamento usado está em `docs/MIGRATION_BRIEF.md`.
