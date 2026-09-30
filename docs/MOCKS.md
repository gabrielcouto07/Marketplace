# Mocks (MSW) e fixtures

Ativação: `NEXT_PUBLIC_API_MOCKING=true` (`.env.local`). Com `false`, o app fala direto com `NEXT_PUBLIC_API_URL`.

## Como funciona

| Camada              | Arquivo                                                | Descrição                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker do navegador | `src/mocks/browser.ts` + `public/mockServiceWorker.js` | `setupWorker(...handlers)`; iniciado por `MockProvider` **antes** de renderizar os filhos (evita a primeira query escapar). `onUnhandledRequest: "bypass"`.                                                                 |
| Servidor Node       | `src/mocks/server.ts` + `src/instrumentation.ts`       | `setupServer` no runtime Node do Next para interceptar `fetch` de servidor (metadata/sitemap). Não intercepta requests **de entrada** (`curl /api/...` no dev retorna 404 do Next — esperado).                              |
| Handlers            | `src/mocks/handlers/*.ts`                              | um arquivo por domínio (`catalog`, `sellers`, `shipping`, `checkout`, `orders`, `auth`), agregados em `handlers/index.ts`. Rotas usam o prefixo `*/api` para casar `/api/...` (browser) e `http://host/api/...` (Node).     |
| "Banco"             | `src/mocks/db.ts`                                      | estado mutável (usuário, endereços, pedidos, pagamentos, perguntas, tokens). No browser é espelhado em `localStorage["mktpy.mockdb.v1"]` para sobreviver a reloads; pedidos seed são sempre reinjetados. `resetDb()` limpa. |
| Fixtures            | `src/mocks/fixtures/*.ts`                              | dados determinísticos (PRNG `mulberry32` + `guid(key)`), iguais no servidor e no cliente                                                                                                                                    |

## Fixtures

- **Categorias (8)**: eletrônicos, perfumes, informática, celulares, bebidas, casa, esportes, moda (`base.ts`).
- **Lojas (8)** com reputação 3–5, RUC válido, cidade (Ciudad del Este, Asunción, Salto del Guairá, Pedro Juan
  Caballero), métricas e política de troca (`base.ts`).
- **Produtos (64)**: 8 templates por categoria em `product-templates.json` (nomes genéricos, sem marcas), preço base
  em centavos, `compareAt`, atributos, variações (Cor/Tamanho/Armazenamento/Volume…), garantia. `products.ts` gera
  slug (`slugify(nome)-<cat3><n>`), imagens `/images/products/<cat>-<n>-<1..3>.webp`, variantes (produto cartesiano,
  +18% por degrau da 1ª opção quando ela é "tamanho/capacidade"), estoque (alguns esgotados), avaliações (3–6) com
  distribuição, perguntas (1–4), `isNew` (< 30 dias), `isOffer` (≥ 15% off), `freeShipping` (≥ R$ 300 e sorteio).
- **Câmbio**: BRL→PYG 1389/100, PYG→BRL 72/1000, USD→BRL 540/100.
- **Contas demo** (senha `123456` para todas):
  - `demo@mktpy.com` — comprador (CPF `529.982.247-25`, 2 endereços SP/PR, 11 pedidos em todos os status);
  - `loja@mktpy.com` — vendedor da **TecnoCentro CDE**, entra no painel `/vendedor`;
  - `admin@mktpy.com` — administrador, entra em `/admin` (via `/admin/entrar`).
    O mock tem um usuário ativo por vez: trocar de conta substitui `db.user`; pedidos/endereços são compartilhados.
- **Pedidos (11)**: um em cada status do ciclo de vida, com timeline, rastreio (quando enviado), pagamento
  correspondente (Pix/boleto/cartão) — `orders.ts`.
- **Frete** (`shipping.ts`): região pelo 1º dígito do CEP → cidade/UF, acréscimo de preço e dias; duas opções
  (econômico 12–25 d.u., expresso 5–10 d.u.); frete grátis quando todos os itens da loja têm `freeShipping` e o
  subtotal ≥ R$ 300.

## Imagens (fotografias reais)

As fotos de produto, categoria, banner e capa de loja são fotografias do Unsplash (licença livre para uso
comercial, sem atribuição obrigatória), baixadas e otimizadas localmente:

| Arquivo                                | Papel                                                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/product-images.manifest.json` | IDs de foto por template (`<categoria>-<n>`: até 3 fotos), por categoria, por banner e por loja. Quando um template tem menos de 3 fotos, o script gera recortes de detalhe da primeira. |
| `scripts/fetch-product-images.mjs`     | Baixa (cache em `scripts/.image-cache`, ignorado no git) e gera WebP: produtos 800×800, categorias 640×640, banners 1200×600, capas de loja 1200×400. `pnpm --filter web images`.        |
| `src/lib/image-blur.json`              | Cor dominante de cada asset, gerada pelo mesmo script; `lib/images.ts › blurDataUrlFor(url)` monta o placeholder de `next/image` com ela.                                                |
| `scripts/generate-product-images.mjs`  | Só o que continua vetorial: monogramas das lojas (`/images/sellers/*.svg`) e `/images/products/placeholder.svg` (anúncio sem foto). Roda no `prebuild`.                                  |

Os WebP são commitados (≈ 9 MB) e ficam **fora do precache** do service worker (`serwist.config.mjs › globIgnores`);
o runtime caching `images` (CacheFirst, 30 dias) guarda só o que o usuário viu. Para trocar uma foto, edite o ID no
manifest e rode `pnpm --filter web images --force`. Os nomes dos templates em `product-templates.json` (cópia
idêntica em `apps/api/.../Seed/`) foram ajustados para casar com as fotos disponíveis.

## Painéis do vendedor e do admin no mock

`handlers/seller-panel.ts` e `handlers/admin.ts` cobrem todos os endpoints de `/seller/*` e `/admin/*` usados pelos
painéis, sobre o **catálogo vivo** (`src/mocks/catalog-state.ts`): fixtures + `db.productOverrides` /
`db.customProducts` / `db.sellerOverrides` / `db.customSellers`. Tudo que o painel altera aparece na vitrine
(home, busca, produto, loja e checkout leem de lá).

| Recurso                                            | Comportamento no mock                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/seller/register`                                 | cria a loja (status **Pendente** até o admin aprovar), associa ao usuário e devolve nova sessão com o papel Vendedor                              |
| `/seller/products`                                 | lista/cria/edita/arquiva; produtos criados entram no catálogo público; `Arquivado`/`Rascunho` somem da vitrine                                    |
| `/seller/orders/:id/prepare` · `/ship`             | `Pago → EmPreparacao → Enviado`, com rastreio e evento de postagem                                                                                |
| `/seller/uploads` + `PUT/GET /uploads/mock/*`      | upload em duas etapas; os bytes ficam em base64 no `db` (orçamento ~3 MB) e são servidos pelo próprio MSW (`unoptimized` no `next/image`)         |
| `/admin/overview`                                  | KPIs, vendas por dia (30 d), pedidos por status e recentes, calculados a partir de `db.orders`/`db.payments`                                      |
| `/admin/users`                                     | 3 contas demo + 6 compradores fictícios; bloquear/desbloquear/anonimizar em `db.userStates`                                                       |
| `/admin/sellers` · `/products`                     | moderação por overrides (status, reputação, loja oficial, preço, estoque)                                                                         |
| `/admin/orders` · `/payments` · `/payouts`         | transições com rastreio/nota, resolução de disputa, estorno (pedido → Reembolsado), repasses derivados dos pedidos pagos (taxas de `db.settings`) |
| `/admin/coupons` · `/exchange-rates` · `/settings` | CRUD persistido; cupons alimentam a cotação do checkout; nova cotação vira a taxa ativa                                                           |
| `/admin/audit`                                     | toda mutação registra uma entrada (`action`, `target`, e-mail)                                                                                    |

## Latência, erros e gatilhos de teste

| Comportamento                                                                                                           | Onde                                        |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Latência aleatória 300–800 ms em todos os handlers                                                                      | `handlers/utils.ts` (`simulateLatency`)     |
| 3% de erro 500 aleatório em `GET /products`                                                                             | `NEXT_PUBLIC_MOCK_ERROR_RATE` (padrão 0.03) |
| `GET /products?q=erro` → 500 sempre                                                                                     | testar `ErrorState` + retry                 |
| CEP `00000-000` → 404; `99999-999` → 500                                                                                | calculadora de frete                        |
| Login com e-mail diferente do demo → 422 `email`; senha ≠ 123456 → 422 `password`                                       | formulário de login                         |
| Cadastro com `existe@mktpy.com` → 422 duplicado                                                                         | formulário de cadastro                      |
| Cartão com `last4 = 0000` → pagamento `Recusado`                                                                        | checkout                                    |
| Cupom `PARAGUAI10` → 10% de desconto                                                                                    | checkout                                    |
| Pix/boleto aprovados automaticamente após 20 s (`settlePendingPayments`) ou via `POST /payments/{id}/simulate-approval` | página de pagamento                         |
| Cotação de checkout expira em 15 min (`lockedUntil`); `quoteId` inválido → 422                                          | checkout                                    |
| Rotas autenticadas (`/orders`, `/me`, `/purchases`) exigem `Authorization: Bearer mock.<uuid>` emitido no login         | `db.tokens`                                 |

## Adicionando um endpoint mock

1. Declare o DTO em `packages/contracts/src/index.ts`.
2. Adicione a função em `features/<dominio>/api` (`xxxApi.*` + hook).
3. Crie o handler em `src/mocks/handlers/<dominio>.ts` usando `API`, `simulateLatency`, `paginate`, `problem/notFound/validation`.
4. Documente em `apps/web/API_CONTRACTS.md`.
