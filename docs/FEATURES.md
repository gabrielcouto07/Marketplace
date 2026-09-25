# Features — o que está pronto, o que é mock, o que falta

Legenda: ✅ pronto (UI + mock) · 🧪 mock/demonstração · 🧱 esqueleto · 🔜 próximo passo.

## Vitrine e fluxo de compra — `app/[locale]/(store)`

| Rota | View | Status | Detalhes |
| --- | --- | --- | --- |
| `/` | `features/home/components/home-view.tsx` | ✅ | banners com autoplay e dots, barra de confiança, grid de categorias, carrosséis de ofertas / novidades / mais vendidos, lojas em destaque; skeletons e `ErrorState` |
| `/busca` | `features/catalog/components/search-view.tsx` | ✅ | filtros em **bottom sheet** (mobile) / sidebar (desktop): preço, categoria, loja, frete grátis, avaliação, ofertas; ordenação (select nativo); chips de filtros ativos; infinite scroll (IntersectionObserver + botão); filtros na URL (`search-filters.ts`); `?q=erro` demonstra o erro 500 |
| `/categorias` | `categories-view.tsx` | ✅ | grid das 8 categorias com ícone e contagem |
| `/categoria/[slug]` | `category-header.tsx` + `search-view.tsx` | ✅ | mesma busca com categoria fixa |
| `/produto/[slug]` | `product-view.tsx` (+ `product-gallery`, `variant-selector`, `product-reviews`, `product-questions`, `cep-shipping-calculator`) | ✅ | galeria com swipe/thumbnails, variações com combinações sem estoque desabilitadas, preço BRL + PYG + cotação, estoque, stepper, **Comprar agora** / **Adicionar ao carrinho** (toast), barra fixa mobile, compartilhar, cálculo de frete por CEP (persistido), card do vendedor com métricas, descrição, características, avaliações com distribuição, perguntas (login obrigatório para perguntar) |
| `/loja/[slug]` | `features/seller/components/seller-view.tsx` | ✅ | banner, logo, selo oficial, termômetro de reputação, RUC, cidade, métricas; abas Produtos / Avaliações / Políticas |
| `/favoritos` | `favorites-view.tsx` | ✅ | persistido em localStorage (offline), estado vazio com CTA |
| `/carrinho` | `features/cart/components/cart-view.tsx` | ✅ | **agrupado por vendedor**, quantidade com remover/desfazer, remover loja, subtotal por loja, referência PYG, resumo fixo no rodapé, aviso offline, CTA muda para "Entre para finalizar" sem sessão |
| `/checkout` | `features/checkout/components/checkout-view.tsx` | ✅ | página única com stepper: endereço (radio cards + novo endereço em sheet), frete **por vendedor** (cotação automática), pagamento Pix / boleto / cartão (máscaras, bandeira por BIN, parcelas), CPF do pagador, cupom, resumo com **impostos de importação estimados** (alíquota exibida), total BRL + PYG e **câmbio travado** com contagem regressiva e "Atualizar resumo" ao expirar; idempotência no `POST /orders` |
| `/pagamento/[paymentId]` | `features/payments/components/payment-view.tsx` | ✅ 🧪 | Pix: QR code (`qrcode.react`), copia-e-cola, expiração, status com polling; boleto: linha digitável, barras, vencimento, PDF; cartão: aprovado/recusado; botão **Simular pagamento (mock)**; redireciona à confirmação quando aprovado |
| `/pedido/confirmado?purchase=` | `features/orders/components/confirmation-view.tsx` | ✅ | "Pedido confirmado!" ou "Quase lá!" (pendente → Pagar agora), N pedidos por loja, itens, frete, entrega estimada, totais e cotação usada |
| `/instalar` | `features/account/components/install-view.tsx` | ✅ | botão "Instalar agora" (Android), instruções Android / iOS / desktop, detecção de app já instalado |
| `/offline` | `features/home/components/offline-content.tsx` | ✅ | fallback do service worker |
| `*` (404) | `app/[locale]/not-found.tsx` | ✅ | localizado, com CTA para a home |

## Área do comprador — `app/[locale]/(account)`

| Rota | View | Status | Detalhes |
| --- | --- | --- | --- |
| `/entrar` | `features/auth/components/login-view.tsx` | ✅ 🧪 | e-mail + senha (toggle), Google (mock), `?next=` seguro, erros 422 nos campos, dica do usuário demo |
| `/cadastrar` | `register-view.tsx` | ✅ 🧪 | nome, e-mail, celular (máscara), senha/confirmação, termos; `existe@mktpy.com` demonstra duplicidade |
| `/recuperar-senha` | `forgot-password-view.tsx` | ✅ 🧪 | envio de link (202 sempre) |
| `/conta` | `features/account/components/account-view.tsx` | ✅ | card de convidado ou saudação; menu (pedidos, dados, endereços, favoritos, instalar, painéis), **troca de idioma**, sair |
| `/conta/perfil` | `profile-view.tsx` | ✅ | nome, telefone, **CPF validado** (dígitos verificadores) |
| `/conta/enderecos` | `addresses-view.tsx` + `address-form.tsx` | ✅ | CRUD com busca de CEP, padrão, exclusão com diálogo |
| `/conta/pedidos` | `features/orders/components/orders-view.tsx` | ✅ | filtros Todos / Em andamento / Concluídos, infinite scroll, badge de status |
| `/conta/pedidos/[id]` | `order-detail-view.tsx` | ✅ | **timeline** com ramificações, rastreio (código + eventos), entrega estimada, itens, endereço, pagamento (+ Pagar agora), totais com cotação, cancelar / abrir disputa / comprar novamente |

## Painéis — 🧱 esqueleto

| Rota | Arquivo | Conteúdo |
| --- | --- | --- |
| `/vendedor`, `/vendedor/{produtos,pedidos,perguntas,repasses,configuracoes}` | `features/seller-panel/components/seller-panel.tsx` + `components/layout/panel-shell.tsx` | layout com sidebar/tabs, dashboard com 4 KPIs (valores fixos), placeholders; configurações demonstram validação de **RUC** |
| `/admin`, `/admin/{vendedores,compradores,pedidos,disputas,repasses,configuracoes}` | `features/admin/components/admin-panel.tsx` | layout + placeholders; `robots: noindex` |

## Transversal

| Item | Status | Onde |
| --- | --- | --- |
| Design tokens (escalas 50–900, dark mode) | ✅ | `src/app/globals.css` — ver `DESIGN_SYSTEM.md` |
| Header com busca sempre visível + bottom nav com badge | ✅ | `components/layout` |
| i18n pt-BR / es-PY | ✅ | `src/i18n` — ver `I18N.md` |
| MSW + fixtures (64 produtos, 8 lojas, 8 categorias, 11 pedidos) | ✅ 🧪 | `src/mocks` — ver `MOCKS.md` |
| PWA: manifest, ícones maskable, SW (Serwist), offline, prompt de instalação | ✅ | ver `PWA.md` |
| Carrinho/favoritos offline | ✅ | Zustand persist |
| SEO: `generateMetadata`, sitemap, robots, URLs amigáveis | ✅ (títulos derivados do slug enquanto há mock) | `app/*.ts`, páginas |
| Acessibilidade (labels, foco, roles, toque ≥ 44 px) | ✅ | componentes |
| ESLint + Prettier + TS strict sem `any` | ✅ | `pnpm lint` / `pnpm typecheck` limpos (1 warning do React Compiler sobre `react-hook-form`) |

## O que é mock (substituir na integração)

- Toda a API (`src/mocks`): catálogo, lojas, CEP, frete, câmbio, cotação, pedidos, pagamentos, auth, endereços.
- Aprovação automática de Pix/boleto em 20 s e `POST /payments/{id}/simulate-approval`.
- Login Google (token fictício), tokens de sessão `mock.<uuid>`.
- Cartão tokenizado como `tok_mock`; recusa por final `0000`.
- KPIs do painel do vendedor (valores fixos).
- Imagens SVG geradas (sem marcas) e logo placeholder.

## Próximos passos sugeridos

1. Backend .NET seguindo `apps/web/API_CONTRACTS.md` (ver `BACKEND_INTEGRATION.md`).
2. Unificar `components/shared/form-field.tsx` (frente checkout) e `features/auth/components/form-field.tsx` (frente auth) em um único componente.
3. Prefetch server-side (`HydrationBoundary`) e metadata real quando a API existir.
4. Testes: unitários de `lib/money` e `lib/validation` (Vitest) e e2e do fluxo de compra (Playwright) usando os mocks.
5. Painéis de vendedor/admin com dados reais; upload de imagens para R2.
6. Sincronização de carrinho/favoritos com a conta (`PUT /me/cart`, `PUT /me/favorites`).
7. Notificações push (Web Push) para status de pedido.
