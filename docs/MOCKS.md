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
  slug (`slugify(nome)-<cat3><n>`), imagens `/images/products/<cat>-<n>-<1..3>.svg`, variantes (produto cartesiano,
  +18% por degrau da 1ª opção quando ela é "tamanho/capacidade"), estoque (alguns esgotados), avaliações (3–6) com
  distribuição, perguntas (1–4), `isNew` (< 30 dias), `isOffer` (≥ 15% off), `freeShipping` (≥ R$ 300 e sorteio).
- **Câmbio**: BRL→PYG 1389/100, PYG→BRL 72/1000, USD→BRL 540/100.
- **Usuário demo**: `demo@mktpy.com` / `123456`, CPF `529.982.247-25` (válido), 2 endereços (SP e PR).
- **Pedidos (11)**: um em cada status do ciclo de vida, com timeline, rastreio (quando enviado), pagamento
  correspondente (Pix/boleto/cartão) — `orders.ts`.
- **Frete** (`shipping.ts`): região pelo 1º dígito do CEP → cidade/UF, acréscimo de preço e dias; duas opções
  (econômico 12–25 d.u., expresso 5–10 d.u.); frete grátis quando todos os itens da loja têm `freeShipping` e o
  subtotal ≥ R$ 300.

## Imagens placeholder

`scripts/generate-product-images.mjs` gera SVGs locais (sem marcas): 192 imagens de produto (64 × 3 variações de
tom/rotação), 8 de categoria, 3 banners, 8 logos e 8 banners de loja. `pnpm images` para regerar. Os SVGs são
servidos por `next/image` com `dangerouslyAllowSVG` + CSP restritiva.

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
