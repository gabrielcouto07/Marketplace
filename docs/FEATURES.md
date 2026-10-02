# Features — o que está pronto, o que é mock, o que falta

Legenda: ✅ pronto (UI + mock) · 🧪 mock/demonstração · 🧱 esqueleto · 🔜 próximo passo.

## Vitrine e fluxo de compra — `app/[locale]/(store)`

| Rota                           | View                                                                                                                            | Status | Detalhes                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                            | `features/home/components/home-view.tsx`                                                                                        | ✅     | banners com autoplay e dots, barra de confiança, grid de categorias, carrosséis de ofertas / novidades / mais vendidos, lojas em destaque; skeletons e `ErrorState`                                                                                                                                                                                                                                                     |
| `/busca`                       | `features/catalog/components/search-view.tsx`                                                                                   | ✅     | filtros em **bottom sheet** (mobile) / sidebar (desktop): preço, categoria, loja, frete grátis, avaliação, ofertas; ordenação (select nativo); chips de filtros ativos; infinite scroll (IntersectionObserver + botão); filtros na URL (`search-filters.ts`); `?q=erro` demonstra o erro 500                                                                                                                            |
| `/categorias`                  | `categories-view.tsx`                                                                                                           | ✅     | grid das 8 categorias com ícone e contagem                                                                                                                                                                                                                                                                                                                                                                              |
| `/lojas`                       | `features/seller/components/stores-view.tsx`                                                                                    | ✅     | todas as lojas em cards de confiança (`SellerBadge` card); ordenação em destaque / reputação / nome e filtro "Lojas oficiais" na URL (`?sort=&official=`); "Ver tudo" de Lojas em destaque na home                                                                                                                                                                                                                      |
| `/categoria/[slug]`            | `category-header.tsx` + `search-view.tsx`                                                                                       | ✅     | mesma busca com categoria fixa                                                                                                                                                                                                                                                                                                                                                                                          |
| `/produto/[slug]`              | `product-view.tsx` (+ `product-gallery`, `variant-selector`, `product-reviews`, `product-questions`, `cep-shipping-calculator`) | ✅     | galeria com swipe/thumbnails, variações com combinações sem estoque desabilitadas, preço BRL + PYG + cotação, estoque, stepper, **Comprar agora** / **Adicionar ao carrinho** (toast), barra fixa mobile, compartilhar, cálculo de frete por CEP (persistido), card do vendedor com métricas, descrição, características, avaliações com distribuição, perguntas (login obrigatório para perguntar)                     |
| `/loja/[slug]`                 | `features/seller/components/seller-view.tsx`                                                                                    | ✅     | banner, logo, selo oficial, termômetro de reputação, RUC, cidade, métricas; abas Produtos / Avaliações / Políticas                                                                                                                                                                                                                                                                                                      |
| `/favoritos`                   | `favorites-view.tsx`                                                                                                            | ✅     | persistido em localStorage (offline), estado vazio com CTA                                                                                                                                                                                                                                                                                                                                                              |
| `/carrinho`                    | `features/cart/components/cart-view.tsx`                                                                                        | ✅     | **agrupado por vendedor**, quantidade com remover/desfazer, remover loja, subtotal por loja, referência PYG, resumo fixo no rodapé, aviso offline, CTA muda para "Entre para finalizar" sem sessão                                                                                                                                                                                                                      |
| `/checkout`                    | `features/checkout/components/checkout-view.tsx`                                                                                | ✅     | página única com stepper: endereço (radio cards + novo endereço em sheet), frete **por vendedor** (cotação automática), pagamento Pix / boleto / cartão (máscaras, bandeira por BIN, parcelas), CPF do pagador, cupom, resumo com **impostos de importação estimados** (alíquota exibida), total BRL + PYG e **câmbio travado** com contagem regressiva e "Atualizar resumo" ao expirar; idempotência no `POST /orders` |
| `/pagamento/[paymentId]`       | `features/payments/components/payment-view.tsx`                                                                                 | ✅ 🧪  | Pix: QR code (`qrcode.react`), copia-e-cola, expiração, status com polling; boleto: linha digitável, barras, vencimento, PDF; cartão: aprovado/recusado; botão **Simular pagamento (mock)**; redireciona à confirmação quando aprovado                                                                                                                                                                                  |
| `/pedido/confirmado?purchase=` | `features/orders/components/confirmation-view.tsx`                                                                              | ✅     | "Pedido confirmado!" ou "Quase lá!" (pendente → Pagar agora), N pedidos por loja, itens, frete, entrega estimada, totais e cotação usada                                                                                                                                                                                                                                                                                |
| `/instalar`                    | `features/account/components/install-view.tsx`                                                                                  | ✅     | botão "Instalar agora" (Android), instruções Android / iOS / desktop, detecção de app já instalado                                                                                                                                                                                                                                                                                                                      |
| `/offline`                     | `features/home/components/offline-content.tsx`                                                                                  | ✅     | fallback do service worker                                                                                                                                                                                                                                                                                                                                                                                              |
| `/design`                      | `features/design/components/design-view.tsx`                                                                                    | ✅     | styleguide vivo (interno, pt-BR, `noindex`): marca, paleta com contrastes WCAG, tipografia, raios/sombras, movimento, botões, formulários, ProductCard/PriceTag, confiança, OrderTimeline, bottom nav, bottom sheet, feedback                                                                                                                                                                                           |
| `*` (404)                      | `app/[locale]/not-found.tsx`                                                                                                    | ✅     | localizado, com CTA para a home                                                                                                                                                                                                                                                                                                                                                                                         |

## Área do comprador — `app/[locale]/(account)`

| Rota                  | View                                           | Status | Detalhes                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/entrar`             | `features/auth/components/login-view.tsx`      | ✅ 🧪  | e-mail + senha (toggle), Google (mock), `?next=` seguro, erros 422 nos campos, dica do usuário demo                                                                                        |
| `/cadastrar`          | `register-view.tsx`                            | ✅ 🧪  | nome, e-mail, celular (máscara), senha/confirmação, termos; `existe@mktpy.com` demonstra duplicidade                                                                                       |
| `/recuperar-senha`    | `forgot-password-view.tsx`                     | ✅ 🧪  | envio de link (202 sempre)                                                                                                                                                                 |
| `/redefinir-senha`    | `reset-password-view.tsx`                      | ✅     | destino do link do e-mail (`?token=`): nova senha + confirmação; link inválido/vencido oferece pedir outro; encerra as sessões antigas                                                      |
| `/conta`              | `features/account/components/account-view.tsx` | ✅     | card de convidado ou saudação; menu (pedidos, dados, endereços, favoritos, instalar, painéis), **troca de idioma**, sair                                                                   |
| `/conta/perfil`       | `profile-view.tsx`                             | ✅     | nome, telefone, **CPF validado** (dígitos verificadores)                                                                                                                                   |
| `/conta/enderecos`    | `addresses-view.tsx` + `address-form.tsx`      | ✅     | CRUD com busca de CEP, padrão, exclusão com diálogo                                                                                                                                        |
| `/conta/pedidos`      | `features/orders/components/orders-view.tsx`   | ✅     | filtros Todos / Em andamento / Concluídos, infinite scroll, badge de status                                                                                                                |
| `/conta/pedidos/[id]` | `order-detail-view.tsx`                        | ✅     | **timeline** com ramificações, rastreio (código + eventos), entrega estimada, itens, endereço, pagamento (+ Pagar agora), totais com cotação, cancelar / abrir disputa / comprar novamente |

## Painéis — ✅ (mock + API)

| Rota                                                                                                        | Arquivo                                                                                                                                 | Conteúdo                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/vendedor`, `/vendedor/{produtos,pedidos,perguntas,repasses,configuracoes}`                                | `features/seller-panel/components/seller-panel.tsx`, `seller-questions.tsx`, `seller-payouts.tsx` + `components/layout/panel-shell.tsx` | dashboard com KPIs da API; produtos (CRUD, upload, NCM/HS); pedidos com **preparar / enviar / cancelar (estorno + estoque automáticos)**; **perguntas dos compradores com resposta publicada na página do produto**; **repasses** (totais por situação + ledger por pedido); aviso de loja **Pendente/Suspensa**; configurações com RUC |
| `/admin`, `/admin/{vendedores,compradores,produtos,pedidos,pagamentos,repasses,cupons,cambio,configuracoes,auditoria}` | `features/admin/components/admin-panel.tsx`                                                                                             | visão geral, aprovação de lojas, bloqueio de usuários, transições de pedido (máquina de estados), disputas, estornos, repasses, cupons, câmbio, parâmetros da plataforma, auditoria; `robots: noindex`                                                                                                                                   |

## Transversal

| Item                                                                        | Status                                          | Onde                                                                                        |
| --------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Design tokens (DESIGN.md: light/dark, tipografia, raios, sombras, motion)   | ✅                                              | `src/app/globals.css` — ver `DESIGN.md` (raiz) e `/design`                                  |
| Header com busca sempre visível + bottom nav com badge                      | ✅                                              | `components/layout`                                                                         |
| i18n pt-BR / es-PY                                                          | ✅                                              | `src/i18n` — ver `I18N.md`                                                                  |
| MSW + fixtures (64 produtos, 8 lojas, 8 categorias, 11 pedidos)             | ✅ 🧪                                           | `src/mocks` — ver `MOCKS.md`                                                                |
| PWA: manifest, ícones maskable, SW (Serwist), offline, prompt de instalação | ✅                                              | ver `PWA.md`                                                                                |
| Carrinho/favoritos offline                                                  | ✅                                              | Zustand persist                                                                             |
| SEO: `generateMetadata`, sitemap, robots, URLs amigáveis                    | ✅ (títulos derivados do slug enquanto há mock) | `app/*.ts`, páginas                                                                         |
| Acessibilidade (labels, foco, roles, toque ≥ 44 px)                         | ✅                                              | componentes                                                                                 |
| ESLint + Prettier + TS strict sem `any`                                     | ✅                                              | `pnpm lint` / `pnpm typecheck` limpos (1 warning do React Compiler sobre `react-hook-form`) |

## O que é mock (substituir na integração)

- Toda a API (`src/mocks`): catálogo, lojas, CEP, frete, câmbio, cotação, pedidos, pagamentos, auth, endereços.
- Aprovação automática de Pix/boleto em 20 s e `POST /payments/{id}/simulate-approval`.
- Login Google (token fictício), tokens de sessão `mock.<uuid>`.
- Cartão tokenizado como `tok_mock`; recusa por final `0000`.
- KPIs do painel do vendedor (valores fixos).
- Imagens SVG geradas (sem marcas) e logo placeholder.

## Problemas conhecidos

- Rotas inexistentes renderizam a página 404 localizada, mas o **status HTTP é 200** (interação entre o rewrite de
  locale do next-intl e o catch-all `[...rest]` que chama `notFound()`). Verificado em dev e produção. Não afeta o
  usuário; afeta apenas crawlers. Alternativa: tratar no `proxy.ts` ou usar `pathnames`/`localePrefix: "always"`.
- O `MockProvider` bloqueia a renderização até o MSW iniciar (~100 ms no primeiro acesso) — comportamento intencional
  apenas com `NEXT_PUBLIC_API_MOCKING=true`.
- `generateMetadata` de produto/categoria/loja usa títulos derivados do slug enquanto não há API real.

## Revisão funcional de 2026-10-02

Varredura completa (vitrine, carrinho, checkout, pagamento, conta, painéis, API) com correções já aplicadas:

- **Dinheiro**: pagamento confirmado depois de o comprador cancelar todos os pedidos é estornado na hora; cobrança de
  compra toda cancelada deixa de ser pagável (vira `Expirado`); aprovação/expiração/recusa da cobrança é atômica
  (job × webhook × simulação não se atropelam); cupom reconferido ao fechar o pedido (limite/validade) e devolvido
  quando a compra nunca é paga; cartão não expira em 30 min (análise antifraude pode levar dias).
- **Checkout**: número do pedido colidindo em compras simultâneas é refeito automaticamente (antes virava 409);
  loja suspensa/pendente ou produto arquivado entre a cotação e o pedido são barrados; a cotação anterior fica na
  tela durante a recotação (sem voltar aos skeletons); "Pagar" espera a recotação pendente; parcelas com a mesma
  regra do backend; Pix/boleto que o gateway não conseguiu gerar não aparece como "cartão recusado".
- **Vitrine**: estoque reservado/devolvido some/volta na hora da página pública (cache invalidado); troca de
  produto relacionado não herda variação/CEP do anterior; filtro de preço aceita "1.500,00"; compartilhar cancelado
  não copia o link; busca sem termo não carrega o catálogo à toa; chamadas públicas vão sem token (cache de saída da
  API vale para quem está logado).
- **Conta/sessão**: página de redefinição de senha (o link do e-mail levava a 404); `?next=` só aceita caminhos
  internos; renovação falha por rede/429 não derruba a sessão; sessão sincronizada entre abas; refresh prefere o
  cookie; vínculo Google a conta local sem e-mail verificado apaga a senha antiga (anti-takeover); bloqueio pelo
  admin vale em até 30 s para o JWT vivo; abas da lista de pedidos filtram no servidor; "Comprar de novo" usa
  preço/estoque atuais e pula indisponíveis; `acceptTerms` enviado e exigido no cadastro.
- **Painéis**: perguntas e repasses do vendedor saíram do esqueleto; loja cancela pedido pago; folha de envio não
  reaproveita o rastreio do pedido anterior; upload de várias fotos não perde as primeiras; produto arquivado abre
  como rascunho; campo NCM/HS; aviso de loja pendente/suspensa; admin não força "Pago" sem gateway nem "Reembolsado"
  sem estorno; repasse de pedido cancelado não pode ser pago; lista de usuários paginada no SQL.
- **Plataforma**: SW desligado quando o mock está ativo (os dois disputavam o escopo "/"); catálogo com preço em
  NetworkFirst; caches privados não guardados e limpos no logout; reload automático após deploy; `setRequestLocale`
  em todas as páginas; slugs com ponto passam pelo locale; API exige Postgres fora de Development e só semeia o
  catálogo de demonstração com `SeedDemoData`; `/health` checa o banco; `Retry-After` no 429; CEP/frete anônimos
  com rate limit; `UseRateLimiter` depois da autenticação.

### Ainda em aberto (não corrigido nesta rodada)

- Variantes de produto não são editáveis no painel do vendedor (estoque de produto com variações só via API/admin).
- Sem token de concorrência em `Product`: editar o produto enquanto uma venda reserva estoque pode sobrescrever o estoque.
- Repasses `Agendado` não avançam sozinhos (não há job): o admin marca "Processando"/"Pago".
- Cotação manual de câmbio é substituída pela próxima importação do provedor externo (se configurado).
- Boleto no Mercado Pago precisa do endereço do pagador no `CreatePaymentRequest` (hoje só o CPF).
- Sem `HydrationBoundary` (prefetch no servidor): home e produto renderizam skeleton no HTML.
- Carrinho/favoritos não sincronizam com a conta (`PUT /me/cart|favorites` existem, o front não usa); LGPD
  (exportar/excluir conta) sem tela.
- Cache de saída do catálogo é por instância: com mais de uma réplica da API, use Redis (`IOutputCacheStore`).

## Próximos passos sugeridos

1. Unificar `components/shared/form-field.tsx` (frente checkout) e `features/auth/components/form-field.tsx` (frente auth) em um único componente.
2. Prefetch server-side (`HydrationBoundary`) e metadata real a partir da API.
3. Testes: unitários de `lib/money` e `lib/validation` (Vitest) e e2e do fluxo de compra (Playwright) usando os mocks.
4. Editor de variantes no painel do vendedor e token de concorrência no produto.
5. Sincronização de carrinho/favoritos com a conta (`PUT /me/cart`, `PUT /me/favorites`) e telas LGPD.
6. Notificações push (Web Push) para status de pedido.
