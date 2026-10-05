# DESIGN.md — Paraguai Imports

Este documento é a fonte de verdade visual e de código de UI do projeto. Toda tarefa de interface deve
segui-lo. Os apêndices no final registram a análise da marca (ícone) e as decisões de adaptação tomadas
na implementação, com o mapeamento token → CSS → classe Tailwind.

# Persona

Atue como Engenheiro Frontend Sênior e Designer de Produto de nível internacional.
Referências de qualidade: Amazon, Linear, Vercel, Apple, Stripe, Airbnb e Shopify, cada uma
pelo seu mérito específico:

- Amazon: a estrutura de loja (barra escura com busca larga, faixa de departamentos, vitrines
  densas, caminho de compra amarelo/laranja) que o comprador já sabe usar
- Linear e Vercel: precisão, densidade elegante e bordas finas
- Apple: tipografia e respiro
- Stripe: clareza em dinheiro e checkout
- Airbnb e Shopify: cards de produto e confiança em compra

O resultado nunca pode parecer template (Bootstrap, admin genérico, "landing de IA"
com gradiente roxo) nem cópia da Amazon (logo, nome, sorriso, ícones ou textos dela).
Cada decisão visual deve ter motivo.

# O produto

**Paraguai Imports** é um marketplace PWA mobile-first que conecta vendedores do Paraguai a
compradores no Brasil (referências funcionais: Mercado Livre e Amazon). A marca é o **logo
"Etiqueta"**: uma sacola nas faixas do Paraguai com a etiqueta do Brasil presa na alça, nas
cores vivas das duas bandeiras (Vermelho, Azul, Verde, Amarelo) sobre a barra Marinho do
topo. O app deve transmitir: CONFIANÇA (comprar de outro país dá medo), CLAREZA (preço,
frete, impostos e prazo sempre explícitos) e ENERGIA (ofertas, descoberta) com a
familiaridade de uma grande loja: quem já comprou na Amazon se acha aqui sem pensar.

Fonte da identidade original: `Marketplace Paraguai — identidade.html` (logo A · Etiqueta).
A geometria do logo continua a mesma; a paleta pastel e o nome "Marketplace Paraguai"
foram substituídos em 01/10/2026 (ver Apêndice B, item 10).

# Regra de ouro das cores

A identidade é viva, e cor viva tem dono:

- **Laranja é compra, Amarelo é carrinho, Vermelho é oferta, Azul é ação e link, Verde é
  sucesso.** Cada cor da marca tem um papel fixo; não troque um pelo outro.
- **Conteúdo sobre cor chapada segue o contraste, não o gosto.** Texto e ícone em Tinta
  sobre Laranja, Amarelo e Verde 500 (6,8–12,3:1); branco sobre Azul 600, Vermelho 600 e
  Marinho (5,2–17,8:1). Branco sobre Amarelo, Laranja ou Verde 500 é proibido.
- **Quando a cor precisa ser texto** (link, preço de oferta, erro, sucesso), usa-se o tom
  de texto da família: `primary` = Azul 600, `deal` = Vermelho 600, `danger` = Vermelho 700,
  `success` = Verde 700, `warning` = Amarelo 800. Todos ≥ 4,5:1 sobre branco e sobre o
  Papel cinza do fundo.
- Proporção guia por tela: ~80 % Papel e branco (cards brancos sobre o fundo cinza),
  ~15 % cores vivas da marca, ~5 % Laranja. O Marinho do header e do footer não conta.
- Máximo de UM CTA de compra laranja (`variant="cta"`) por tela. O botão Laranja da busca
  e o badge do carrinho são assinatura da marca e não contam. O Amarelo (`variant="cart"`)
  só aparece em "Adicionar ao carrinho", logo acima do CTA.
- As bandeiras só aparecem na versão da marca (`components/shared/flags.tsx`): Paraguai em
  faixas Vermelho/branco/Azul, Brasil em Verde com losango Amarelo e círculo Azul. NÃO usar
  o brasão, o escudo ou a esfera com a faixa em nenhum lugar.

# Tokens de cor

Implemente como CSS variables no globals.css, via @theme do Tailwind v4, e mapeie
para os tokens do shadcn/ui. Componentes usam APENAS tokens semânticos, nunca hex
direto nem classes de cor cruas.

## Escalas primitivas

A cor da marca é o 500 (400 no Amarelo e no Laranja, que são claros); os demais tons foram
derivados em OKLCH no mesmo matiz e validados com contraste WCAG.

vermelho (Paraguai)
50 #FFF1F2 · 100 #FFE0E3 · 200 #FFC2C8 · 300 #FF94A0 · 400 #FF5468 · 500 #F2263E (marca)
600 #D3102E (oferta) · 700 #AD0B25 · 800 #89051B · 900 #640311

azul (Paraguai)
50 #F0F5FF · 100 #E0EBFF · 200 #C2D6FF · 300 #94B8FF · 400 #5C8FFF · 500 #2E6BFF (marca)
600 #1552EB (primary) · 700 #0B44C8 · 800 #0634A0 · 900 #06267A · 950 #0A1733 (Marinho)

verde (Brasil)
50 #EBFFF0 · 100 #CCF8D8 · 200 #9EEDB4 · 300 #5EDB86 · 400 #1FC762 · 500 #00B852 (marca)
600 #038539 · 700 #026F2F (success) · 800 #065724 · 900 #003F17

amarelo (Brasil)
50 #FFFBEB · 100 #FFF3C2 · 200 #FFE98A · 300 #FFDD47 · 400 #FFD20A (marca, carrinho)
500 #F0BE00 · 600 #C79A00 · 700 #8A6B00 · 800 #6B5300 (warning) · 900 #4D3B00

laranja (compra)
50 #FFF6EB · 100 #FFE8CC · 200 #FFD199 · 300 #FFB55C · 400 #FF9500 (CTA) · 500 #F07E00
600 #C76400 · 700 #9C4D00 · 800 #7A3C00 · 900 #592B00

tinta (neutro frio levemente azulado)
0 #FFFFFF · 50 #F7F8FA · 100 #EFF1F4 · 200 #E1E5EA · 300 #CDD3DA · 400 #98A1AD
500 #5A6575 · 600 #4A5563 · 700 #353F4D · 800 #1F2937 · 900 #0F1729 (Tinta) · 950 #080D1A

papel (cinza do fundo e das bordas)
50 #EAEDF0 (Papel) · 100 #E1E5E9 · 200 #D5DAE0 · 300 #BCC3CC

roxo (campanha: vitrines temáticas, só preenchimento)
50 #F8F5FF · 100 #EFE6FF · 200 #E1CFFF · 300 #CEB0FE · 400 #A866F5 · 500 #8B2FE0 (marca)
600 #771FC3 · 700 #5F08A0 · 800 #4B0680 · 900 #36045C

avulsos: Marinho claro #15284D (faixa de departamentos) · gold #FFA41C (estrela)

## Semânticos (light)

    --background        papel-50      (fundo cinza do app; cards brancos flutuam sobre ele)
    --surface           tinta-0       (cards, caixas de vitrine, sheets)
    --surface-muted     tinta-100     (palco da foto do produto, chips, inputs neutros)
    --border            papel-200
    --border-strong     papel-300     (também --input)
    --text              tinta-900     (Tinta; nunca #000)
    --text-secondary    tinta-600
    --text-muted        tinta-500     (≥ 5:1 inclusive sobre o Papel e surface-muted)
    --primary           azul-600      hover azul-700 · soft azul-100 · on-primary #FFF
    --cta               laranja-400   hover/pressed laranja-500 · on-cta tinta-900
    --cart              amarelo-400   hover amarelo-500 · on-cart tinta-900
    --deal              vermelho-600  on-deal #FFF (selo "Oferta", "-25%", contagem regressiva)
    --success           verde-700     soft verde-100  (frete grátis, entregue)
    --warning           amarelo-800   soft amarelo-100 (estoque baixo, prazo estendido)
    --danger            vermelho-700  soft vermelho-50 (erros SEMPRE com ícone + texto,
                                                         para não confundir com oferta)
    --on-bright         tinta-900     (ícone sobre Verde/Amarelo chapados, nos dois temas)
    --focus-ring        azul-500, 2px, offset 2px
    --brand-deep        azul-950      (Marinho: barra do header, footer, painel, scrim de foto)
    --brand-deep-raised #15284D       (faixa de departamentos, "Voltar ao início")

## Paleta da marca (semânticos de identidade)

Para as superfícies vivas: ícones da faixa de confiança, faixas, wordmark, ilustração.

    --brand-vermelho / -soft    vermelho-500 / vermelho-100
    --brand-azul / -soft        azul-500 / azul-100
    --brand-verde / -soft       verde-500 / verde-100
    --brand-amarelo / -soft     amarelo-400 / amarelo-100
    --brand-laranja / -soft     laranja-400 / laranja-100
    --brand-roxo / -soft        roxo-500 / roxo-100 (campanhas; branco por cima, 5,9:1)
    --brand-tile                amarelo-400 (tile do logo)
    --gold                      #FFA41C (estrelas; ícone, nunca texto)

## Semânticos (dark)

    --background #0A0F1A · --surface #121A2B · --surface-muted #1B2438
    --border #2A3550 · --border-strong #3A4663
    --text #F1F4F8 · --text-secondary #C3CBD6 · --text-muted #98A3B3
    --primary azul-400 com on-primary tinta-900 · --cta laranja-400 · --cart amarelo-400
    --deal vermelho-600 · --success verde-400 · --warning amarelo-400 · --danger vermelho-300
    --brand-deep #060B16 · --brand-deep-raised #0F1A33
    Tons claros e paleta "-soft" viram véus: color-mix da cor a ~20 % sobre a superfície.

Dark mode via classe + prefers-color-scheme. O light é a prioridade visual. O logo não muda
de cor no dark (o tile Amarelo é a própria moldura).

## Assinaturas da marca

- **Barra Marinho** (`bg-brand-deep`): o topo de todas as páginas da vitrine e o footer, com
  texto branco; a faixa de departamentos logo abaixo em `bg-brand-deep-raised`.
- **Faixa das quatro cores** (`brand-quartet`): Vermelho · Azul · Verde · Amarelo, na base
  do footer, no splash e na imagem OG. Nunca como fundo de área grande.
- **Tricolor** (`tricolor-stripe`, 3 px, Vermelho | branco | Azul): as faixas da sacola.
  Só sobre `brand-deep` (header do painel, splash), onde o branco aparece.

# Tipografia

Duas famílias, via `next/font/google` (variáveis `--font-figtree` e `--font-bricolage`):

- **Figtree** 300–700 (`font-sans`, padrão): interface, textos, títulos de seção, preços e
  números. Títulos de seção (`SectionHeader`) e de quad card em 700, como numa loja.
- **Bricolage Grotesque 800** (`font-heading`): só o wordmark ("Paraguai"), as manchetes
  dos banners do hero e os títulos dos tiles de departamento. Sempre com `font-extrabold` e tracking -0.02em. Nunca em preços,
  quantidades, botões ou textos corridos.

Números de preço, quantidade e rastreio usam `tabular-nums` (em Figtree). O "-25%" ao lado
do preço usa Figtree 300 no mesmo tamanho do inteiro, em `text-deal`.

Escala mobile (tamanho/altura de linha, peso, tracking):

- hero 32/36 800 -0.02em e hero-lg 44/48 800 (≥ md): manchete do banner, com font-heading
- display 30/36 semibold -0.02em (valor total no checkout, nota média, preço na PDP)
- title-1 24/32 semibold -0.015em (título de página)
- title-2 20/28 semibold -0.01em (seções; em `SectionHeader` vira 700)
- title-3 17/24 semibold (títulos de card, nome do produto na PDP)
- body 16/24 normal (texto corrido; leading-relaxed em descrições longas)
- body-sm 14/20 normal (metadados, listas densas, links do header)
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
- Espaço entre caixas de vitrine: 16px no mobile, 24px a partir de md.
- Padding interno de card e de caixa: 16px.

Raios (escala compacta de loja):

- 4 (`rounded-sm`: chips, badges, selos de oferta)
- 6 (`rounded-md`: inputs, busca, tiles pequenos)
- 8 (`rounded-lg`: cards, caixas de vitrine, imagens)
- 12 (`rounded-xl`: bottom sheets, modais)
- full (botões, avatares, pills)

Elevação: preferir borda fina + sombra mínima. Sombras em camadas, sutis, tingidas
de Tinta:

- xs 0 1px 2px rgb(15 23 41 / 0.06)
- sm 0 1px 3px rgb(15 23 41 / 0.08), 0 1px 2px rgb(15 23 41 / 0.05)
- md 0 4px 12px rgb(15 23 41 / 0.1) (dropdowns, popovers)
- lg 0 12px 32px rgb(15 23 41 / 0.16) (sheets, modais)

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

## Animações de vitrine

A home é a vitrine e pode ser viva. Estas animações CSS (keyframes em `globals.css`) são as
únicas permitidas fora das regras acima, e só nos lugares listados:

- **Autoplay do hero** (6 s por banner): ponto ativo enche (`animate-progress`), foto ativa em
  zoom lento (`animate-ken-burns`) e texto subindo em sequência (`animate-rise` + delay).
  Pausa no hover do mouse, no foco e pelo botão de pausa (WCAG 2.2.2).
- **Entrada**: quad cards com `animate-rise` em sequência; tiles de departamento, vitrine de
  campanha (≥ lg) e grade de mais vendidos com `reveal` (scroll-driven, sobe ao entrar na tela;
  sem suporte a `animation-timeline` o elemento já aparece). Em listas com rolagem horizontal
  use `lg:reveal`: a timeline pegaria o próprio carrossel.
- **Reflexo** (`shine`): CTA de compra, selo "Oferta", chip vermelho do banner e contagem das
  ofertas. Nada mais brilha.
- **Contínuas**: fotos dos tiles de departamento flutuando fora de fase (`animate-float`), raio
  das ofertas piscando (`animate-flash`), ícone da campanha balançando (`animate-wiggle`) e a
  faixa de confiança correndo (`animate-marquee`, pausa no hover).
- **Hover**: cards e tiles sobem 4 px (`hover:-translate-y-1`) com sombra maior; fotos de quad
  card inclinam ±2°; molduras dos tiles endireitam e crescem. Use as propriedades `translate`,
  `rotate` e `scale` (não `transform`) para não brigar com as animações de entrada.
- Com `prefers-reduced-motion`: sem autoplay nem botão de pausa, marquee parada (sem a cópia
  e rolável), reflexo escondido, `reveal` desligado; o resto cai na regra global (0,01 ms).

# Iconografia e imagem

- lucide-react, stroke 1.75, tamanhos 20 (inline) e 24 (navegação). Sem emojis
  como ícones.
- Imagem de produto: proporção 1:1, object-contain sobre --surface-muted, raio 8,
  next/image com placeholder blur.
- Nunca esticar ou cortar o produto.
- Estados vazios: ilustração linear minimalista em `primary` e neutros + frase curta +
  uma ação.
- Hero da home: fotos dos banners de ponta a ponta com scrim em `brand-deep`; não há mais
  ilustração desenhada (a Ponte da Amizade pastel saiu com a identidade antiga).

# Padrões de componentes

## Botões

Todos em pill (`rounded-full`).

- cta: Laranja com texto Tinta, altura 48, full-width no mobile. Uso: Comprar agora,
  Finalizar compra, Pagar.
- cart: Amarelo com texto Tinta. Uso: Adicionar ao carrinho, logo acima do CTA.
- primary: Azul 600 com texto branco. Uso: ações principais sem conotação de compra.
- secondary: surface + borda + sombra xs. Uso: ações neutras.
- ghost: só texto ou ícone.
- Todos com estado loading (spinner mantendo a largura), disabled e focus-visible.
- Área de toque mínima de 44x44.

## ProductCard

- Imagem 1:1 com botão de favoritar (coração) no canto, em pill translúcida
  com backdrop-blur.
- Selo no canto: "Oferta" em `deal` chapado (com desconto) ou "Novo" em `primary`.
- Título com 2 linhas; sublinha e vira `primary` no hover.
- Cinco estrelas `gold` com a contagem de avaliações.
- Linha de preço: "-25%" em `deal` (300, mesmo tamanho do inteiro), preço atual em --text
  com centavos sobrescritos; embaixo "De: R$ …" riscado em muted.
- Parcelamento em caption.
- "Frete grátis" em `success` com ícone de caminhão (texto, não chip).
- Origem discreta: "Enviado de Ciudad del Este".
- Sobre uma caixa colorida (ofertas) o card mantém borda e fundo branco.
- Hover levanta 4 px e vai a shadow-md; press encolhe para 98 % (`active:scale-[0.98]`).

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
- Faixa de confiança da home (marquee em caixa branca): rota PY → BR com as bandeiras da
  marca e quatro diferenciais em pills chapadas (Azul e Vermelho 600 com texto branco, Verde e
  Amarelo com texto `on-bright`).
- Prazo em faixa de dias úteis.
- Selo Remessa Conforme (`RemessaConformeBadge` / `RemessaConformeSeal`): disco serrilhado Verde com
  anel pontilhado e check em Tinta. Aparece na PDP, no resumo do checkout e no rodapé, e só com
  `NEXT_PUBLIC_REMESSA_CONFORME=true`, que se liga depois do Ato Declaratório da Coana.

## Navegação

- Bottom nav: 64px + safe-area, surface com backdrop-blur e borda superior.
- Item ativo em --primary com barra indicadora de 3 px no topo. Badge do carrinho em --cta.
- Header sticky em Marinho (`brand-deep`), texto branco, links com contorno branco de 1 px
  no hover e anel Amarelo no foco (`link-on-deep`):
  - desktop (≥ md): barra de 64 px com o lockup (logo 40), "Enviar para / CEP" (≥ lg), a
    busca branca de 44 px (raio 6, botão Laranja quadrado à direita), "Olá, faça seu login /
    Conta e favoritos", "Acompanhe seus / Pedidos" (≥ lg) e o carrinho com contador. Embaixo,
    a faixa de departamentos de 40 px em `brand-deep-raised`: Todos (→ departamentos),
    Ofertas do dia, Mais vendidos, Novidades, Lojas, Favoritos e, à direita, "Venda no
    Paraguai Imports". Total: 104 px (`--header-height`).
  - mobile, home: lockup + "Entrar ›" e carrinho numa linha de 56 px; a busca branca de 44 px
    com o botão Laranja; a faixa "Enviar para CEP …" de 40 px em `brand-deep-raised`.
  - mobile, páginas internas: uma linha de 56 px com voltar (ou logo compacto), busca ou
    título, e o carrinho. A busca (`/busca`) desenha a própria barra Marinho com o input.
- Footer: "Voltar ao início" em `brand-deep-raised`, colunas de links (só rotas
  existentes) em `brand-deep`, lockup e a faixa das quatro cores na base. Não aparece nos
  fluxos sem bottom nav (checkout, pagamento, login).
- Hero da home: carrossel de banners de ponta a ponta (até 1500 px), scrim em
  `brand-deep`, chip do título no tom do banner, manchete em hero/hero-lg; setas laterais
  no desktop; pontos com progresso e pausa em todos os tamanhos. A partir de md a base da foto
  dissolve no fundo e os quatro quad cards sobem sobre ela, cada um numa cor chapada:
  Ofertas do dia (`deal`), Departamentos (`primary`), Mais vendidos (`cta`) e Novidades
  (`brand-verde`), com fotos em moldura branca e link "Ver …" ("Ver tudo" no mobile).
- Ordem da home: hero → quad cards → faixa de confiança → Ofertas do dia (caixa `deal` com
  cards brancos) → Ofertas por departamento (tiles na matiz da categoria, `tint-bg-deep`, com
  "até N% off" só quando a categoria tem oferta na home) → vitrine de campanha (`brand-roxo`)
  → lojas em destaque → mais vendidos. Caixas com raio 8, sangrando até a borda no mobile.

# Voz e texto

pt-BR, direto e caloroso, frases curtas. Botões com verbo ("Comprar agora", e não
"Prosseguir"). Evitar jargão de importação. Sempre explicar em uma linha o que um
imposto ou prazo significa.

# Anti-padrões (proibido)

- Gradientes multicoloridos, glassmorphism exagerado, neon, sombras pesadas.
- Tons pastel desbotados como cor de marca (a identidade é viva desde 01/10/2026).
- Texto #000, cinza claro ilegível, preço inteiro em cor (só o "-25%" é `deal`).
- Branco sobre Amarelo, Laranja ou Verde 500; cor 400/500 como texto; Bricolage em preços.
- Laranja fora da compra, Amarelo fora do carrinho, Vermelho de oferta como erro.
- Bordas grossas, cards dentro de cards, mais de um CTA laranja de compra por tela.
- Elementos da Amazon (logo, sorriso, nome, ícones ou textos próprios): copiamos a
  estrutura de loja, não a marca.
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
   - a barra Marinho, a assinatura tricolor sobre brand-deep e a faixa das quatro cores.
4. Em seguida, construa as telas na ordem de prioridade já definida, sempre
   compondo a partir desses componentes.

---

# Apêndice A — A marca: logo "Etiqueta"

Geometria do caminho A do arquivo `Marketplace Paraguai — identidade.html`, nas cores vivas
desde 01/10/2026. Vetor: `apps/web/public/logo.svg` (viewBox 120×120). Componente React com a
mesma geometria: `apps/web/src/components/layout/brand-logo.tsx` (`<BrandLogo size />`).
Lockup com wordmark: `brand-mark.tsx` (`<BrandMark size="md|sm" tone="dark|light" compact />`).
PNGs (manifest, maskable, apple-touch, favicon.ico, favicon-32, mestre 1024 e OG) são
gerados por `pnpm --filter web icons` a partir do SVG.

## O que o logo é

- **Tile**: quadrado de cantos arredondados (raio 25 %) em **Amarelo #FFD20A**.
- **Sacola**: corpo trapezoidal em três faixas — **Vermelho #F2263E**, **branco** com uma
  **estrela #FFA41C** (no lugar do brasão, que é proibido) e **Azul #1552EB**.
- **Alça**: arco em **Tinta #0F1729**, traço 5 % da largura, pontas arredondadas.
- **Etiqueta do Brasil**: presa na alça por um barbante Tinta, girada 16°: retângulo
  **Verde #00B852**, losango **Amarelo #FFD20A** e círculo **Azul**. É a leitura
  "produto do Paraguai, com destino ao Brasil".

## Detalhe por tamanho (o componente escolhe sozinho pelo `size`)

| Tamanho  | Desenho                                                               | Uso                       |
| -------- | --------------------------------------------------------------------- | ------------------------- |
| ≥ 42 px  | completo                                                              | auth, instalar, OG        |
| 28–41 px | sem a estrela                                                         | header, painéis, compacto |
| < 28 px  | sem estrela, barbante e círculo da etiqueta; alça mais grossa (8/120) | favicon, ícones pequenos  |

## Wordmark

Duas linhas à direita do logo, gap 10: "Paraguai" em Bricolage Grotesque 800, tracking
-0.02em — `text-title-2` no desktop (logo 40) e `text-title-3` no mobile (logo 36); embaixo
"IMPORTS" em Figtree 700, `text-caption`, caixa alta, tracking 0.22em, em `brand-amarelo`
sobre o Marinho (tone dark, o padrão) ou `primary` sobre superfícies claras (tone light).

## Como isso vira sistema

| Elemento do logo              | Token / uso no app                                                         |
| ----------------------------- | -------------------------------------------------------------------------- |
| Tile Amarelo                  | `--brand-tile` e `--cart`. Maskable e splash usam o mesmo tom até a borda. |
| Faixas Vermelho/branco/Azul   | `--deal` (Vermelho 600), `primary` (Azul 600) e a `tricolor-stripe`.       |
| Etiqueta Verde/Amarelo        | `success` (Verde 700), `warning` (Amarelo 800); ícones chapados da home.   |
| Alça e barbante Tinta         | `--text` e `--on-bright`: conteúdo sobre as cores claras é Tinta.          |
| Estrela #FFA41C               | `--gold` (`fill-gold`): estrelas de avaliação. **Nunca** como texto.       |
| Formas cheias e cantos suaves | Botões em pill e ícones lucide com traço 1.75–2.25.                        |

Regras práticas: o logo nunca recebe sombra, contorno, recolorização nem versão sem tile
(sem o tile a faixa branca some sobre fundos claros). Não usar os caminhos B e C.

# Apêndice B — Implementação e decisões

## Tokens → CSS → Tailwind

Definidos em `apps/web/src/app/globals.css`. Primitivos e semânticos ficam em `:root` / `.dark`; o bloco
`@theme inline` expõe tudo ao Tailwind v4 e mapeia os tokens do shadcn/ui.

| Token do documento   | CSS variable                                      | Classe Tailwind                                                           |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| background           | `--background`                                    | `bg-background`                                                           |
| surface              | `--surface` (= `--card`)                          | `bg-surface` / `bg-card`                                                  |
| surface-muted        | `--surface-muted` (= `--muted`)                   | `bg-surface-muted` / `bg-muted`                                           |
| border / strong      | `--border` / `--border-strong`                    | `border-border` (padrão) / `border-border-strong`                         |
| text                 | `--text` (= `--foreground`)                       | `text-foreground`                                                         |
| text-secondary       | `--text-secondary`                                | `text-foreground-secondary`                                               |
| text-muted           | `--text-muted` (= `--muted-foreground`)           | `text-foreground-muted` / `text-muted-foreground`                         |
| primary + hover/soft | `--primary`, `--primary-hover`, `--primary-soft`  | `bg-primary`, `hover:bg-primary-hover`, `bg-primary-soft` (= `bg-accent`) |
| on-primary           | `--on-primary` (= `--primary-foreground`)         | `text-primary-foreground`                                                 |
| cta + hover/pressed  | `--cta`, `--cta-hover`, `--cta-pressed`           | `bg-cta`, `hover:bg-cta-hover`, `active:bg-cta-pressed`                   |
| on-cta               | `--on-cta`                                        | `text-cta-foreground`                                                     |
| cart + hover / on    | `--cart`, `--cart-hover`, `--on-cart`             | `bg-cart`, `hover:bg-cart-hover`, `text-cart-foreground`                  |
| deal / on-deal       | `--deal`, `--on-deal`                             | `bg-deal`, `text-deal`, `text-deal-foreground`                            |
| on-bright            | `--on-bright`                                     | `text-on-bright` (ícone sobre Verde/Amarelo chapados)                     |
| success / soft       | `--success`, `--success-soft`                     | `text-success`, `bg-success-soft`                                         |
| warning / soft       | `--warning`, `--warning-soft`                     | `text-warning`, `bg-warning-soft`                                         |
| danger / soft        | `--danger` (= `--destructive`), `--danger-soft`   | `text-danger`, `bg-danger-soft`                                           |
| focus-ring           | `--focus-ring` (= `--ring`)                       | utilitário `focus-ring` (outline 2 px, offset 2 px)                       |
| brand-deep / raised  | `--brand-deep`, `--brand-deep-raised`             | `bg-brand-deep`, `bg-brand-deep-raised`                                   |
| brand-tile, gold     | `--brand-tile`, `--gold`                          | `bg-brand-tile`, `text-gold`/`fill-gold`                                  |
| paleta da marca      | `--brand-vermelho[-soft]`, `--brand-azul[-soft]`… | `bg-brand-verde`, `bg-brand-amarelo-soft`, `text-brand-amarelo`           |
| assinaturas          | —                                                 | utilitários `brand-quartet`, `tricolor-stripe`, `link-on-deep`            |
| overlay              | `--overlay`                                       | `bg-overlay` (backdrop de sheets/diálogos)                                |

Tipografia: `text-hero`, `text-hero-lg`, `text-display`, `text-title-1`, `text-title-2`, `text-title-3`,
`text-body`, `text-body-sm`, `text-caption` já trazem tamanho, altura de linha, peso e tracking. A família
não faz parte da escala (o Tailwind não permite): títulos pedem `font-heading` explicitamente, para que
`display`/`title-1` continuem em Figtree quando são preços. Raios: `rounded-sm` 4 · `rounded-md` 6 ·
`rounded-lg` 8 · `rounded-xl` 12 · `rounded-full`. Sombras: `shadow-xs|sm|md|lg`. Motion: `ease-standard`,
`ease-exit`, `duration-150|200|300`, utilitário `pressable` (scale 0.98 em 200 ms).

A paleta padrão do Tailwind foi **desligada** (`--color-*: initial`): só existem as escalas deste documento
(`vermelho-*`, `azul-*`, `verde-*`, `amarelo-*`, `laranja-*`, `tinta-*`, `papel-*`), `white`, `black` (apenas overlays)
e os semânticos. Uma classe como `bg-orange-500` ou a antiga `bg-blue-600` simplesmente não compila.

## Decisões de adaptação

1. **Bottom sheets**: construídos sobre `@base-ui/react/drawer` (`components/ui/bottom-sheet.tsx`), que já
   entrega arraste para fechar, snap e acessibilidade. `motion` fica com o contador do carrinho, o pulso de
   "adicionar ao carrinho" e a troca de imagens da galeria, como o documento pede.
2. **Dark mode**: `next-themes` com `attribute="class"` e `enableSystem`, mais `color-scheme`. O light é o
   padrão e o que se valida visualmente; o dark é funcional e usa os semânticos da seção "Semânticos (dark)".
3. **Cards de produto** têm padding interno de 12 px (exceção documentada ao "16 px de card"): em duas colunas
   a 390 px cada card tem 171 px e 16 px comeria 19 % da largura.
4. **Cores por categoria** (`lib/palette.ts`, utilitários `tint-*`) existem apenas nos tiles de categoria: o tile
   da home é `tint-bg-deep` (oklch 0,55 / 0,2, chapado vivo) com ícone branco (≥ 3,9:1 em todas as matizes);
   `tint-bg`/`tint-fg` ficam para o fallback sem foto. Não entram em nenhum outro lugar.
5. **Estados vazios** usam ilustrações lineares inline (`components/shared/illustrations.tsx`) em `primary` e
   neutros, sem imagens externas. As bandeiras (`components/shared/flags.tsx`) são arte da identidade e, como
   o logo, usam as cores do asset em hex (exceção documentada à regra de tokens).
6. **Styleguide `/design`** é interno: textos em pt-BR fixos (fora do next-intl) e `robots: noindex`.
7. **Sem aliases legados**: as classes do redesign anterior (`ink-*`, `line-*`, `canvas-*`, `surface-strong`,
   `shadow-card|float|cta|ink`, `rounded-2xl/3xl/4xl`, `animate-rise`) foram removidas de `globals.css` após a
   migração de todas as telas (25/09/2026). O mapeamento usado está em `docs/MIGRATION_BRIEF.md`.
8. **Fotografia real (30/09/2026)**: produtos, categorias, banners e capas de loja usam fotos (WebP) geradas por
   `apps/web/scripts/fetch-product-images.mjs` a partir de `product-images.manifest.json` (ver `docs/MOCKS.md ›
Imagens`). Regras derivadas:
   - Os assets de produto são normalizados para **1:1** no build; por isso `object-contain` preenche o palco sem
     padding (o "respiro" vem da própria foto). Uploads de vendedor que não sejam quadrados continuam em
     `object-contain` sobre `surface-muted`, nunca cortados.
   - O `placeholder="blur"` usa a **cor dominante** de cada asset (`lib/images.ts › blurDataUrlFor`), não um
     cinza genérico: a foto "revela" sobre o próprio tom.
   - Sobre fotos, texto branco só com **scrim em `brand-deep`** (`bg-linear-to-t from-brand-deep/85 …`), que é um
     degradê de uma cor só para contraste, não decoração. Banners da home, tiles de categoria (`variant="card"`)
     e a capa da loja seguem isso; o tom do banner (`red`/`blue`/`neutral`) vira apenas o chip do título.
   - O `ProductCard` tem corpo de estrutura fixa (título → avaliação → preço → rodapé) para alinhar preços entre
     vizinhos; a linha de avaliação existe mesmo vazia. No carrossel a largura é 176 px (`w-44`).
9. **Identidade "Etiqueta" (30/09/2026; paleta substituída pelo item 10)**: a paleta da bandeira (azul #0038A8 / vermelho #D52B1E / navy) e a
   Geist deram lugar à identidade pastel do arquivo `Marketplace Paraguai — identidade.html`, logo A.
   Decisões de implementação:
   - O CTA passou a ter **texto Tinta** (on-cta), não branco: branco sobre Coral dá 2,3:1.
   - `primary` é **Pervinca 600** (#455BB3), não a Pervinca da identidade: ~80 pontos do código usam
     `text-primary` como texto e a Pervinca 400 dá 2,6:1 sobre branco. O pastel fica em `--brand-pervinca`.
   - A fita da base do header tem **4 px** (a identidade desenha 5) e a barra desktop tem **80 px** (84 na
     identidade), para respeitar o grid de 8; o eyebrow "MARKETPLACE" usa 12 px (a identidade usa 10–11)
     pelo mínimo de 12 px. Total do header desktop: 84 px (`--header-height`).
   - O hero usa raio 24 (a identidade desenha 28 no desktop) para ficar na escala de raios.
   - Todos os pares texto/fundo foram validados (≥ 4,5:1 texto; ≥ 3:1 ícone) — ver `/design › Cores`.
10. **Paraguai Imports, cores vivas e estrutura de loja (01/10/2026)**: o app passou a se chamar
    **Paraguai Imports** (`site.ts`, `common.siteName`, wordmark "Paraguai / IMPORTS", manifest, OG, PDF do
    boleto) e a identidade pastel do item 9 deu lugar a cores vivas, com a estrutura de navegação de uma grande
    loja (referência: Amazon). Decisões:
    - As famílias foram renomeadas para o que são: Coral → **Vermelho**, Pervinca → **Azul**, Menta → **Verde**,
      Manteiga → **Amarelo**, mais o **Laranja** novo para a compra. Lilás, Céu e a fita Pervinca
      (`brand-ribbon`) saíram; o Papel virou o cinza #EAEDF0 para os cards brancos se destacarem.
    - CTA de compra **Laranja** e "Adicionar ao carrinho" **Amarelo** (`variant="cart"`), ambos com texto
      Tinta; ofertas em **Vermelho 600** (`deal`), que também é o "-25%" ao lado do preço (antes era verde).
    - Header Marinho de duas faixas (barra de 64 px + departamentos de 40 px), footer novo, hero em carrossel
      com quad cards sobrepostos e vitrines em caixas brancas; títulos de seção em Figtree 700.
    - Raios mais compactos (4/6/8/12) e botões em pill; o grid de 8 px continua valendo para espaçamento.
    - O logo manteve a geometria e trocou só as cores; o nome é "Paraguai Imports" em todos os idiomas (marca
      não se traduz). As chaves de armazenamento local (`mktpy.*`) não mudaram, para não perder sessão,
      carrinho e favoritos de quem já usa o app.
    - Todos os pares texto/fundo novos estão em `/design › Cores` com a razão calculada; a única falha é o
      `gold` das estrelas (ícone decorativo; a nota e a contagem ao lado carregam a informação), como antes.
11. **Vitrine viva (01/10/2026)**: a home ganhou cor e movimento a pedido (referência: blocos coloridos
    de loja). Quad cards em cores chapadas, caixa de ofertas Vermelha, tiles de departamento na matiz
    da categoria com foto flutuando, vitrine de campanha em **Roxo** (família nova, só preenchimento) e
    a faixa de confiança em marquee; o ícone de categoria em grade saiu da home (o `variant="icon"` do
    `CategoryTile` continua disponível). As animações e onde podem aparecer estão em Movimento ›
    Animações de vitrine; o autoplay do hero foi verificado (troca a cada 6 s, pausa no botão) e o
    reduced-motion também (sem autoplay, marquee parada, sem reflexo).
