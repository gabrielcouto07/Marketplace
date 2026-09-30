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
Brasil (referência funcional: Mercado Livre). A marca é o **logo A "Etiqueta"**: uma
sacola nas faixas do Paraguai com a etiqueta do Brasil presa na alça, desenhada numa
paleta pastel própria (Coral, Pervinca, Menta, Manteiga) com textos em Tinta. O app
deve transmitir: CONFIANÇA (comprar de outro país dá medo), CLAREZA (preço, frete,
impostos e prazo sempre explícitos) e ENERGIA (ofertas, descoberta) com um tom
amigável e lúdico. Premium, mas acessível: nada de luxo frio.

Fonte da identidade: `Marketplace Paraguai — identidade.html` (boards "Header —
desktop", "Header — mobile", "Logo — três caminhos" e "Identidade — cores e tipos").
O caminho escolhido é o **A · Etiqueta**; B (Ponte) e C (Dupla) ficam descartados.

# Regra de ouro das cores

A identidade é pastel, e pastel não é cor de texto:

- **Pastel é preenchimento, Tinta é conteúdo.** Coral #FF8B7B, Pervinca #7F9BFF,
  Menta #5DCB94 e Manteiga #FFD15C (e seus tons suaves) só aparecem como fundo de
  botões, tiles, chips, faixas e ilustração. Texto e ícone por cima são sempre
  Tinta #26253A (contraste 5,7–10,3:1). Branco sobre pastel é proibido (2,0–2,6:1).
- **Quando a cor precisa ser texto** (link, ícone ativo, erro, sucesso), usa-se o tom
  600–800 da mesma família: `primary` = Pervinca 600, `danger` = Coral 700,
  `success` = Menta 700, `warning` = Manteiga 800. Todos ≥ 4,5:1 sobre branco, Papel
  e o próprio tom suave.
- Proporção guia por tela: ~80 % Papel e branco, ~15 % pastéis da marca, ~5 % Coral.
- Máximo de UM CTA de compra coral (`variant="cta"`) por tela. O círculo coral da
  busca no header e o badge do carrinho são assinatura da marca e não contam.
- As bandeiras só aparecem na versão da marca: Paraguai em faixas Coral/branco/
  Pervinca, Brasil em Menta com losango Manteiga e círculo Pervinca. NÃO usar o
  brasão, o escudo ou a esfera com a faixa em nenhum lugar.

# Tokens de cor

Implemente como CSS variables no globals.css, via @theme do Tailwind v4, e mapeie
para os tokens do shadcn/ui. Componentes usam APENAS tokens semânticos, nunca hex
direto nem classes de cor cruas.

## Escalas primitivas

O tom 400 é a cor exata da identidade e o 100 é o tom suave da identidade; os demais
foram derivados em OKLCH (mesmo matiz) e validados com contraste WCAG.

coral
50 #FEEFEC · 100 #FFE1DB (suave) · 200 #FEC7BE · 300 #FFAB9E · 400 #FF8B7B (Coral)
500 #EA7869 · 600 #C45C4F · 700 #A0463B · 800 #7F362D · 900 #5D2821

pervinca
50 #EEF2FE · 100 #E1E8FF (suave) · 200 #C0D0FE · 300 #A0B6FE · 400 #7F9BFF (Pervinca)
500 #6E88EA · 600 #455BB3 · 700 #364895 · 800 #283775 · 900 #1C2754

menta
50 #EBFAF1 · 100 #D6F4E4 (suave) · 200 #ABE9C6 · 300 #81DCAB · 400 #5DCB94 (Menta)
500 #48B882 · 600 #1E905F · 700 #0E764C · 800 #075C3A · 900 #0A432A

manteiga
50 #FFFAEE · 100 #FFF1C9 (suave) · 200 #FFE6AD · 300 #FFDC89 · 400 #FFD15C (Manteiga)
500 #EBBD46 · 600 #9F7A00 · 700 #836400 · 800 #684F00 · 900 #4E3A00

tinta (neutro frio levemente violeta, derivado do texto)
0 #FFFFFF · 50 #F7F7FC · 100 #F1F0F8 · 200 #E2E2EC · 300 #CACBD9 · 400 #9C9CB1
500 #6A6880 · 600 #5E5C72 · 700 #45445F · 800 #35344C · 900 #26253A (Tinta) · 950 #171626

papel (neutro quente de fundo e bordas)
50 #F7F6F2 (Papel) · 100 #F0EEE9 · 200 #E4E2DA · 300 #D0CEC4

avulsos: lilás #E6E3FF (atalho da conta) · céu #E8F1FF (hero) · gold #FFC53D (estrela)

## Semânticos (light)

    --background        papel-50      (fundo do app; cards brancos se destacam sobre ele)
    --surface           tinta-0       (cards, sheets, header)
    --surface-muted     tinta-100     (busca, inputs, chips, palco da foto do produto)
    --border            papel-200
    --border-strong     papel-300
    --text              tinta-900     (Tinta; nunca #000)
    --text-secondary    tinta-600
    --text-muted        tinta-500     (≥ 4,7:1 inclusive sobre surface-muted e céu)
    --primary           pervinca-600  hover pervinca-700 · soft pervinca-100 · on-primary #FFF
    --cta               coral-400     hover/pressed coral-500 · on-cta tinta-900 (texto escuro!)
    --success           menta-700     soft menta-100  (frete grátis, % de desconto, entregue)
    --warning           manteiga-800  soft manteiga-100 (estoque baixo, prazo estendido)
    --danger            coral-700     soft coral-50   (erros SEMPRE com ícone + texto,
                                                        para não confundir com o CTA)
    --focus-ring        pervinca-500, 2px, offset 2px
    --brand-deep        tinta-900     (barra fixa escura, header do painel, scrim de foto)

## Paleta da marca (semânticos de identidade)

Para as superfícies lúdicas da identidade: atalhos do header, hero, chips de confiança,
contagem de ofertas. Sempre com conteúdo em `text-foreground` por cima.

    --brand-coral / -soft / -strong    coral-400 / coral-100 / coral-600 (ícone ≥ 3:1)
    --brand-pervinca / -soft           pervinca-400 / pervinca-100
    --brand-menta / -soft              menta-400 / menta-100
    --brand-manteiga / -soft           manteiga-400 / manteiga-100
    --brand-lilas                      #E6E3FF
    --brand-ceu                        #E8F1FF
    --brand-tile                       manteiga-100 (tile do logo)
    --gold                             #FFC53D (estrelas; ícone, nunca texto)

## Semânticos (dark)

    --background #12111F · --surface tinta-900 · --surface-muted tinta-800
    --border #3E3D54 · --border-strong tinta-700
    --text tinta-50 · --text-secondary tinta-300 · --text-muted #A6A6B9
    --primary pervinca-300 com on-primary tinta-900 · --cta coral-400 com on-cta tinta-900
    --success menta-400 · --warning manteiga-400 · --danger coral-300
    Tons suaves e paleta da marca viram véus: color-mix da cor 400 a ~20 % sobre tinta-900.

Dark mode via classe + prefers-color-scheme. O light é a prioridade visual. O logo e a
arte do hero não mudam de cor no dark (o tile Manteiga é a própria moldura).

## Assinaturas da marca

- **Fita Pervinca** (`brand-ribbon`, 4 px, `--brand-pervinca`): base do header em todas as
  páginas da vitrine, no mesmo tom do tabuleiro da ponte do hero; o header não tem borda inferior.
- **Faixa das quatro cores** (`brand-quartet`): Coral · Pervinca · Menta · Manteiga, em
  splash, imagem OG e peças de marca. Nunca como fundo de área grande.
- **Tricolor** (`tricolor-stripe`, 3 px, Coral | branco | Pervinca): as faixas da sacola.
  Só sobre `brand-deep` (header do painel, footer, splash), onde o branco aparece.

# Tipografia

Duas famílias, via `next/font/google` (variáveis `--font-figtree` e `--font-bricolage`):

- **Figtree** 400–700 (`font-sans`, padrão): interface, textos, preços e números.
- **Bricolage Grotesque 800** (`font-heading`): só títulos — saudação do hero, títulos de
  seção (`SectionHeader`), wordmark. Sempre com `font-extrabold` e tracking -0.02em.
  Nunca em preços, quantidades, botões ou textos corridos.

Números de preço, quantidade e rastreio usam `tabular-nums` (em Figtree).

Escala mobile (tamanho/altura de linha, peso, tracking):

- hero 32/36 800 -0.02em e hero-lg 44/48 800 (≥ md): saudação da home, com font-heading
- display 30/36 semibold -0.02em (valor total no checkout, nota média)
- title-1 24/32 semibold -0.015em (título de página)
- title-2 20/28 semibold -0.01em (seções; em `SectionHeader` vira Bricolage 800)
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
- 12 (botões, inputs, tiles de atalho no mobile)
- 16 (cards, imagens, tiles de atalho no desktop)
- 24 (bottom sheets, cartão do hero)
- full (avatares, pills, busca, botão de busca)

Elevação: preferir borda fina + sombra mínima. Sombras em camadas, sutis, tingidas
de Tinta:

- xs 0 1px 2px rgb(38 37 58 / 0.05)
- sm 0 1px 3px rgb(38 37 58 / 0.06), 0 1px 2px rgb(38 37 58 / 0.04)
- md 0 4px 12px rgb(38 37 58 / 0.08) (dropdowns, popovers)
- lg 0 12px 32px rgb(38 37 58 / 0.12) (sheets, modais)

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
- Estados vazios: ilustração linear minimalista em `primary` e neutros + frase curta +
  uma ação.
- Ilustração de marca (hero da home): a Ponte da Amizade com um caminhão indo do
  Paraguai ao Brasil, em formas cheias pastel, sem contorno
  (`features/home/components/hero-illustration.tsx`).

# Padrões de componentes

## Botões

- primary-cta: Coral com texto Tinta, altura 48, full-width no mobile. Uso: Comprar
  agora, Finalizar compra, Pagar.
- primary: Pervinca 600 com texto branco. Uso: ações principais sem conotação de compra.
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
- Chips de confiança da home com o ícone num círculo pastel (Menta, Lilás, Coral,
  Manteiga), como os atalhos do header.
- Prazo em faixa de dias úteis.

## Navegação

- Bottom nav: 64px + safe-area, surface com backdrop-blur e borda superior.
- Ícone ativo em --primary com indicador pill atrás. Badge do carrinho em --cta.
- Header sticky, superfície branca sólida, fita Pervinca de 4 px na base:
  - desktop (≥ md): barra de 80 px com o lockup (logo 48), a busca em pill de 56 px
    (`surface-muted`, placeholder à esquerda, botão circular coral de 44 px com a lupa
    em Tinta à direita) e três atalhos em tiles pastel de 48 px, raio 16: Favoritos
    (Coral suave), Conta (Lilás), Carrinho (Manteiga suave). Página atual ganha anel
    inset em Tinta a 20 %.
  - mobile, home: duas linhas — lockup (logo 44) + Conta e Carrinho em tiles de 44 px,
    raio 12; embaixo a busca em pill de 52 px com o círculo coral.
  - mobile, páginas internas: uma linha de 64 px com voltar (ou logo compacto), busca
    de 48 px ou título, e o tile do carrinho.
- Hero da home: cartão Céu (raio 24) com o selo da rota PY → BR, a saudação em
  hero/hero-lg, a pill branca do CEP (pin em `brand-coral-strong`) e a ilustração da
  ponte — à direita a partir de md, embaixo no mobile.

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
- Texto #000, cinza claro ilegível, preço em coral (coral é CTA, não preço).
- Texto branco sobre pastel; pastel (400) como cor de texto; Bricolage em preços.
- Bordas grossas, cards dentro de cards, mais de um CTA coral de compra por tela.
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
   - a assinatura tricolor sobre brand-deep, a fita Pervinca e a faixa das quatro cores.
4. Em seguida, construa as telas na ordem de prioridade já definida, sempre
   compondo a partir desses componentes.

---

# Apêndice A — A marca: logo A "Etiqueta"

Fonte: board "Logo — três caminhos" do arquivo `Marketplace Paraguai — identidade.html`
(caminho A). Vetor: `apps/web/public/logo.svg` (viewBox 120×120). Componente React com a
mesma geometria: `apps/web/src/components/layout/brand-logo.tsx` (`<BrandLogo size />`).
Lockup com wordmark: `brand-mark.tsx` (`<BrandMark size="md|sm" tone="light|dark" compact />`).
PNGs (manifest, maskable, apple-touch, favicon.ico, favicon-32, mestre 1024 e OG) são
gerados por `pnpm --filter web icons` a partir do SVG.

## O que o logo é

- **Tile**: quadrado de cantos arredondados (raio 25 %) em **Manteiga suave #FFF1C9**.
- **Sacola**: corpo trapezoidal em três faixas — **Coral #FF8B7B**, **branco** com uma
  **estrela #FFC53D** (no lugar do brasão, que é proibido) e **Pervinca #7F9BFF**.
- **Alça**: arco em **Tinta #26253A**, traço 5 % da largura, pontas arredondadas.
- **Etiqueta do Brasil**: presa na alça por um barbante Tinta, girada 16°: retângulo
  **Menta #5DCB94**, losango **Manteiga #FFD15C** e círculo **Pervinca**. É a leitura
  "produto do Paraguai, com destino ao Brasil".

## Detalhe por tamanho (o componente escolhe sozinho pelo `size`)

| Tamanho  | Desenho                                                               | Uso                        |
| -------- | --------------------------------------------------------------------- | -------------------------- |
| ≥ 42 px  | completo                                                              | header, auth, instalar, OG |
| 28–41 px | sem a estrela                                                         | logo compacto, painéis     |
| < 28 px  | sem estrela, barbante e círculo da etiqueta; alça mais grossa (8/120) | favicon, ícones pequenos   |

## Wordmark

Duas linhas à direita do logo, gap 12: "MARKETPLACE" em Figtree 700, `text-caption`, caixa
alta, tracking 0.16em, `text-foreground-secondary`; "Paraguai" em Bricolage Grotesque 800,
tracking -0.02em — `text-title-1` no desktop (logo 48) e `text-title-2` no mobile (logo 44).
Sobre `brand-deep` (tone dark) o texto fica branco e o logo não muda.

## Como isso vira sistema

| Elemento do logo              | Token / uso no app                                                           |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Tile Manteiga suave           | `--brand-tile`. Maskable e splash usam o mesmo tom até a borda.              |
| Faixas Coral/branco/Pervinca  | `--cta` (Coral) e a família Pervinca (`primary` = 600); a `tricolor-stripe`. |
| Etiqueta Menta/Manteiga       | `success` (Menta 700) e `warning` (Manteiga 800); tiles e chips pastel.      |
| Alça e barbante Tinta         | `--text`: todo conteúdo sobre pastel é Tinta.                                |
| Estrela #FFC53D               | `--gold` (`fill-gold`): estrelas de avaliação. **Nunca** como texto.         |
| Faixa Pervinca da sacola      | A fita Pervinca do header (`brand-ribbon`), mesmo tom do tabuleiro da ponte. |
| Formas cheias e cantos suaves | Raios generosos (16/24) e ícones lucide com traço 1.75–2.25.                 |

Regras práticas: o logo nunca recebe sombra, contorno, recolorização nem versão sem tile
(sem o tile a faixa branca some sobre fundos claros). Não usar os caminhos B e C.

# Apêndice B — Implementação e decisões

## Tokens → CSS → Tailwind

Definidos em `apps/web/src/app/globals.css`. Primitivos e semânticos ficam em `:root` / `.dark`; o bloco
`@theme inline` expõe tudo ao Tailwind v4 e mapeia os tokens do shadcn/ui.

| Token do documento   | CSS variable                                      | Classe Tailwind                                                                    |
| -------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| background           | `--background`                                    | `bg-background`                                                                    |
| surface              | `--surface` (= `--card`)                          | `bg-surface` / `bg-card`                                                           |
| surface-muted        | `--surface-muted` (= `--muted`)                   | `bg-surface-muted` / `bg-muted`                                                    |
| border / strong      | `--border` / `--border-strong`                    | `border-border` (padrão) / `border-border-strong`                                  |
| text                 | `--text` (= `--foreground`)                       | `text-foreground`                                                                  |
| text-secondary       | `--text-secondary`                                | `text-foreground-secondary`                                                        |
| text-muted           | `--text-muted` (= `--muted-foreground`)           | `text-foreground-muted` / `text-muted-foreground`                                  |
| primary + hover/soft | `--primary`, `--primary-hover`, `--primary-soft`  | `bg-primary`, `hover:bg-primary-hover`, `bg-primary-soft` (= `bg-accent`)          |
| on-primary           | `--on-primary` (= `--primary-foreground`)         | `text-primary-foreground`                                                          |
| cta + hover/pressed  | `--cta`, `--cta-hover`, `--cta-pressed`           | `bg-cta`, `hover:bg-cta-hover`, `active:bg-cta-pressed`                            |
| on-cta               | `--on-cta`                                        | `text-cta-foreground`                                                              |
| success / soft       | `--success`, `--success-soft`                     | `text-success`, `bg-success-soft`                                                  |
| warning / soft       | `--warning`, `--warning-soft`                     | `text-warning`, `bg-warning-soft`                                                  |
| danger / soft        | `--danger` (= `--destructive`), `--danger-soft`   | `text-danger`, `bg-danger-soft`                                                    |
| focus-ring           | `--focus-ring` (= `--ring`)                       | utilitário `focus-ring` (outline 2 px, offset 2 px)                                |
| brand-deep           | `--brand-deep`                                    | `bg-brand-deep`                                                                    |
| brand-tile, gold     | `--brand-tile`, `--gold`                          | `bg-brand-tile`, `text-gold`/`fill-gold`                                           |
| paleta da marca      | `--brand-coral[-soft\|-strong]`, `--brand-lilas`… | `bg-brand-coral-soft`, `bg-brand-lilas`, `bg-brand-ceu`, `text-brand-coral-strong` |
| assinaturas          | —                                                 | utilitários `brand-ribbon`, `brand-quartet`, `tricolor-stripe`                     |
| overlay              | `--overlay`                                       | `bg-overlay` (backdrop de sheets/diálogos)                                         |

Tipografia: `text-hero`, `text-hero-lg`, `text-display`, `text-title-1`, `text-title-2`, `text-title-3`,
`text-body`, `text-body-sm`, `text-caption` já trazem tamanho, altura de linha, peso e tracking. A família
não faz parte da escala (o Tailwind não permite): títulos pedem `font-heading` explicitamente, para que
`display`/`title-1` continuem em Figtree quando são preços. Raios: `rounded-sm` 8 · `rounded-md` 12 ·
`rounded-lg` 16 · `rounded-xl` 24 · `rounded-full`. Sombras: `shadow-xs|sm|md|lg`. Motion: `ease-standard`,
`ease-exit`, `duration-150|200|300`, utilitário `pressable` (scale 0.98 em 200 ms).

A paleta padrão do Tailwind foi **desligada** (`--color-*: initial`): só existem as escalas deste documento
(`coral-*`, `pervinca-*`, `menta-*`, `manteiga-*`, `tinta-*`, `papel-*`), `white`, `black` (apenas overlays)
e os semânticos. Uma classe como `bg-orange-500` ou a antiga `bg-blue-600` simplesmente não compila.

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
   neutros, sem imagens externas. A ilustração do hero e as bandeiras (`hero-illustration.tsx`) são arte da
   identidade e, como o logo, usam as cores do asset em hex (exceção documentada à regra de tokens).
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
9. **Identidade "Etiqueta" (30/09/2026)**: a paleta da bandeira (azul #0038A8 / vermelho #D52B1E / navy) e a
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
