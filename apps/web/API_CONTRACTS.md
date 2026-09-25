# API Contracts — Marketplace de Produtos Paraguaios

Especificação dos endpoints REST que o frontend consome (hoje via MSW) e que o backend
**ASP.NET Core Web API + PostgreSQL** deverá implementar. Os DTOs TypeScript equivalentes
estão em [`packages/contracts/src/index.ts`](../../packages/contracts/src/index.ts) e os
handlers mock em [`src/mocks/handlers`](src/mocks/handlers).

## Convenções gerais

| Item         | Regra                                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL     | `NEXT_PUBLIC_API_URL` (ex.: `https://api.exemplo.com/api`). Em dev com mock: `/api`.                                                                                                                                                                    |
| Formato      | JSON, `camelCase` (System.Text.Json `JsonNamingPolicy.CamelCase`).                                                                                                                                                                                      |
| IDs          | `string` GUID (`Guid` no .NET).                                                                                                                                                                                                                         |
| Datas        | ISO 8601 em UTC (`DateTimeOffset`), ex.: `2026-09-25T13:00:00.000Z`.                                                                                                                                                                                    |
| Dinheiro     | Objeto `Money { amount: int, currency: "BRL"\|"PYG"\|"USD" }`. `amount` sempre inteiro em unidades mínimas (centavos para BRL/USD; guaranis inteiros para PYG). **Nunca decimal/float no JSON.** No .NET: `record Money(long Amount, string Currency)`. |
| Câmbio       | Fração exata `{ numerator, denominator }` (ver `ExchangeRateDto`). Conversão: `round(amount * numerator / denominator)`.                                                                                                                                |
| Enums        | Serializados como string (`JsonStringEnumConverter`). Nomes em PascalCase pt-BR, ex.: `AguardandoPagamento`.                                                                                                                                            |
| Paginação    | Query `page` (1-based) e `pageSize`; resposta `{ items, page, pageSize, totalCount }`.                                                                                                                                                                  |
| Erros        | `application/problem+json` simplificado: `{ status, code, message, errors?: { campo: string[] }, traceId }`. 400/422 para validação, 401 sessão, 403 permissão, 404, 409 conflito de estado, 500.                                                       |
| Auth         | `Authorization: Bearer <accessToken>` (JWT). Refresh via `POST /auth/refresh`. Recomendação: refresh token em cookie httpOnly.                                                                                                                          |
| Idempotência | `POST /orders` exige `idempotencyKey` (UUID gerado no cliente). Mesma chave → mesma resposta.                                                                                                                                                           |
| Locale       | Header `Accept-Language: pt-BR` ou `es-PY` para textos gerados no servidor (descrições de timeline, mensagens de erro).                                                                                                                                 |

Legenda de status: **✅ consumido hoje pelo front (mockado)** · **🔜 previsto (contrato definido, sem UI ou sem mock)**.

---

## 1. Catálogo

### ✅ `GET /home`

Agregado da página inicial.

**Response** `HomeDto`

```json
{
  "banners": [{ "id": "…", "title": "…", "subtitle": "…", "imageUrl": "…", "href": "/busca?onlyOffers=true", "tone": "blue|red|neutral" }],
  "categories": [CategoryDto],
  "offers": [ProductSummaryDto],
  "newArrivals": [ProductSummaryDto],
  "bestSellers": [ProductSummaryDto],
  "featuredSellers": [SellerSummaryDto]
}
```

### ✅ `GET /categories` → `CategoryDto[]`

### ✅ `GET /categories/{slug}` → `CategoryDto` (404 se não existir)

`CategoryDto { id, slug, name, iconKey, imageUrl, parentId, productCount }`

### ✅ `GET /products` — busca/listagem

Query params (todos opcionais):

| Param                  | Tipo                                                          | Descrição                |
| ---------------------- | ------------------------------------------------------------- | ------------------------ |
| `q`                    | string                                                        | texto livre (nome, loja) |
| `categorySlug`         | string                                                        | filtra por categoria     |
| `sellerSlug`           | string                                                        | filtra por loja          |
| `minPrice`, `maxPrice` | int                                                           | em centavos de BRL       |
| `freeShipping`         | bool                                                          |                          |
| `onlyOffers`           | bool                                                          | `isOffer = true`         |
| `minRating`            | number                                                        | 0–5                      |
| `sort`                 | `relevance\|priceAsc\|priceDesc\|newest\|bestSelling\|rating` |                          |
| `page`, `pageSize`     | int                                                           | padrão 1 / 20 (máx. 60)  |

**Response** `ProductSearchResultDto = PagedResult<ProductSummaryDto> & { facets }`

```json
{
  "items": [ProductSummaryDto], "page": 1, "pageSize": 20, "totalCount": 64,
  "facets": {
    "categories": [{ "slug": "celulares", "name": "Celulares", "count": 8 }],
    "sellers": [{ "slug": "nippon-center", "name": "Nippon Center", "count": 5 }],
    "priceRange": { "min": Money, "max": Money }
  }
}
```

### ✅ `GET /products/suggestions?q=` → `[{ slug, name, thumbnailUrl }]` (máx. 6)

### ✅ `GET /products/{slug}` → `ProductDetailDto`

### ✅ `GET /products/{id}/reviews?page&pageSize` → `PagedResult<ReviewDto>`

### ✅ `GET /products/{id}/reviews/summary` → `ReviewSummaryDto { average, total, distribution[5] }`

### ✅ `GET /products/{id}/questions?page&pageSize` → `PagedResult<QuestionDto>`

### ✅ `POST /products/{id}/questions` (auth) — body `{ question }` → `201 QuestionDto`

### 🔜 `POST /products/{id}/reviews` (auth, apenas com pedido Entregue/Concluido) — `{ rating, title?, comment }`

**`ProductSummaryDto`**

```
id, slug, name, thumbnailUrl, price: Money, compareAtPrice: Money|null, referencePrice: Money (PYG),
discountPercent, rating, reviewCount, soldCount, stock, freeShipping, isNew, isOffer, categoryId,
seller: SellerSummaryDto, createdAt
```

**`ProductDetailDto`** = summary + `description, images[{id,url,alt,sortOrder}], variantOptions[{name,values[]}],
variants[{id, sku, attributes{}, price, compareAtPrice, stock, imageId}], attributes[{name,value}],
categoryPath[], originCity, handlingDays{min,max}, warrantyMonths, questionCount`.

---

## 2. Lojas (vendedores)

### ✅ `GET /sellers` → `SellerSummaryDto[]`

### ✅ `GET /sellers/{slug}` → `SellerDto`

### ✅ `GET /sellers/{slug}/reviews?page&pageSize` → `PagedResult<ReviewDto>`

`SellerDto { id, slug, name, logoUrl, reputationLevel 1–5, isOfficialStore, city, description, ruc, country: "PY",
memberSince, rating, reviewCount, productCount, metrics { salesCount, positiveRatingPercent, onTimeShippingPercent,
avgResponseTimeHours }, exchangePolicy, bannerUrl, categories[] }`

---

## 3. CEP, frete e câmbio

### ✅ `GET /postal-codes/{cep}` → `PostalCodeLookupDto { postalCode, street, neighborhood, city, state }`

404 se inexistente; 422 se formato inválido. (Backend pode proxyar ViaCEP/BrasilAPI com cache.)

### ✅ `POST /shipping/quotes` — cotação por vendedor

**Request** `ShippingQuoteRequest`

```json
{
  "postalCode": "01310100",
  "sellerId": "guid",
  "items": [{ "productId": "guid", "variantId": null, "quantity": 1 }]
}
```

**Response** `ShippingQuoteDto`

```json
{ "postalCode": "01310100", "destination": { "city": "São Paulo", "state": "SP" }, "sellerId": "guid",
  "options": [{ "id": "guid", "carrier": "Correo Paraguayo + Correios", "service": "Internacional Econômico",
               "price": Money, "estimatedDays": { "min": 12, "max": 25 }, "description": "…" }] }
```

Regras: prazos em **dias úteis** e sempre em faixa; frete grátis retorna `price.amount = 0`.

### ✅ `GET /exchange-rates?from=BRL&to=PYG` → `ExchangeRateDto[]`

```json
{
  "id": "guid",
  "from": "BRL",
  "to": "PYG",
  "numerator": 1389,
  "denominator": 100,
  "displayRate": "R$ 1,00 = ₲ 1.389",
  "quotedAt": "…",
  "expiresAt": "…"
}
```

### 🔜 `GET /orders/{id}/tracking` (auth) → `{ trackingCode, events: TrackingEventDto[] }` — já mockado; o backend deve

integrar com a transportadora/Correios e normalizar códigos (`POSTED`, `EXPORT`, `ARRIVED_BR`, `CUSTOMS`,
`CUSTOMS_RELEASED`, `OUT_FOR_DELIVERY`, `DELIVERED`).

---

## 4. Checkout e pedidos

### ✅ `POST /checkout/quotes` — cotação completa (trava câmbio)

**Request** `CheckoutQuoteRequest`

```json
{
  "postalCode": "01310100",
  "couponCode": "PARAGUAI10",
  "groups": [
    {
      "sellerId": "guid",
      "shippingOptionId": "guid|null",
      "items": [{ "productId": "guid", "variantId": "guid|null", "quantity": 2 }]
    }
  ]
}
```

**Response** `CheckoutQuoteDto`

```
quoteId, groups[{ seller, lines[{productId, variantId, name, variantLabel, thumbnailUrl, quantity, unitPrice, lineTotal}],
subtotal, shippingOptions[], selectedShippingOptionId, shipping }],
subtotal, shippingTotal, estimatedImportTax, importTaxRateBasisPoints (6000 = 60%), discount, total,
totalReference (PYG), exchangeRate: ExchangeRateDto, lockedUntil (ISO; 15 min)
```

Regras: `quoteId` expira em `lockedUntil`; `POST /orders` com quote expirada → 422 `quoteId`.
O imposto é **estimativa** (exibida como tal); o valor cobrado pela Receita pode diferir.

### ✅ `POST /orders` (auth) — fecha a compra

**Request** `PlaceOrderRequest`

```json
{ "quoteId": "guid", "addressId": "guid", "exchangeRateId": "guid", "idempotencyKey": "uuid",
  "groups": [{ "sellerId": "guid", "shippingOptionId": "guid", "items": [...] }],
  "payment": { "method": "Pix|Boleto|Cartao", "payerDocument": "52998224725",
               "card": { "token": "tok_…", "holderName": "…", "brand": "Visa", "last4": "4242", "installments": 6 } } }
```

**Response** `201 PlaceOrderResponseDto { purchaseId, orders: OrderDto[] (um por vendedor), payment: PaymentDto }`

- O cartão **nunca** trafega em claro: o front tokeniza no SDK do gateway e envia `token`.
- Uma compra (`purchaseId`) gera **N pedidos** (um por vendedor) e **1 pagamento** com split entre vendedores (ver §6).
- Status inicial: `AguardandoPagamento` (Pix/boleto) ou `Pago` (cartão aprovado).

### ✅ `GET /orders?status&page&pageSize` (auth) → `PagedResult<OrderDto>`

### ✅ `GET /orders/{id}` (auth) → `OrderDto` (aceita `id` ou `number`)

### ✅ `GET /purchases/{purchaseId}/orders` (auth) → `OrderDto[]`

### ✅ `POST /orders/{id}/cancel` (auth) → `OrderDto` — permitido em `AguardandoPagamento|Pago|EmPreparacao`, senão 409 `ORDER_NOT_CANCELLABLE`

### ✅ `POST /orders/{id}/disputes` (auth) → `201 OrderDto` (status `EmDisputa`)

### 🔜 `POST /orders/{id}/confirm-receipt` (auth) → `Concluido`

### 🔜 `GET /orders/{id}/invoice` → PDF da declaração/invoice

**`OrderDto`**

```
id, number ("PY-2026-000123"), purchaseId, status: OrderStatus, createdAt, updatedAt, seller: SellerSummaryDto,
items[OrderItemDto], shippingAddress: AddressDto, shippingOption: ShippingOptionDto, trackingCode, trackingEvents[],
estimatedDelivery { min, max } (datas ISO), totals { subtotal, shipping, importTax, discount, total, totalReference },
exchangeRate, payment { id, method, status }, timeline[{ status, occurredAt, description, location }]
```

**Ciclo de vida (`OrderStatus`)**

```
AguardandoPagamento → Pago → EmPreparacao → Enviado → EmTransitoInternacional → Entregue → Concluido
        └→ Cancelado (até EmPreparacao)         Entregue/Enviado ─→ EmDisputa → Devolvido → Reembolsado
```

Transições são feitas pelo backend (webhooks de pagamento/transporte, ações do vendedor/admin). O front apenas exibe
a `timeline` e oferece `cancel`/`disputes`.

---

## 5. Pagamentos

### ✅ `GET /payments/{id}` → `PaymentDto`

```
id, purchaseId, method, status: Pendente|Aprovado|Recusado|Expirado|Estornado, amount: Money, createdAt, paidAt,
pix: { qrCodePayload (EMV copia-e-cola), qrCodeImageUrl, expiresAt } | null,
boleto: { barcode, digitableLine, pdfUrl, dueDate } | null,
card: { brand, last4, installments, installmentAmount } | null
```

O front faz **polling a cada 5 s** enquanto `Pendente`. Alternativa futura: SSE `GET /payments/{id}/events`.

### ✅ (somente mock) `POST /payments/{id}/simulate-approval` — aprova imediatamente. **Não implementar em produção.**

### 🔜 `GET /payments/{id}/boleto.pdf` → PDF

### 🔜 `POST /payments/{id}/refund` (admin/seller) → `PaymentDto` (status `Estornado`)

---

## 6. Split, repasses (payouts) e webhooks — 🔜

Modelo sugerido: gateway com **split de pagamento** (ex.: Pagar.me/Asaas/Mercado Pago com marketplace). Cada
`PlaceOrderResponseDto.payment` é uma cobrança única com regras de split por vendedor
(`amount - platformFee - paymentFee`), respeitando o câmbio travado (`exchangeRateId`) para o repasse em PYG/USD.

### 🔜 `GET /seller/payouts?page&pageSize` (auth vendedor) → `PagedResult<PayoutDto>`

`PayoutDto { id, sellerId, period {min,max}, gross, platformFee, paymentFee, net, status: Agendado|Processando|Pago|Falhou, scheduledFor, paidAt }`

### 🔜 `GET /seller/payouts/{id}` → `PayoutDto` + itens

### 🔜 `GET /admin/payouts`, `POST /admin/payouts/{id}/retry`

### 🔜 Webhooks recebidos pelo backend (endpoint interno, assinatura HMAC no header `X-Signature`)

`POST /webhooks/payments` e `POST /webhooks/shipping` — corpo `WebhookEventDto<T>`:

```json
{
  "id": "evt_…",
  "type": "payment.approved",
  "occurredAt": "…",
  "payload": { "paymentId": "…", "purchaseId": "…" }
}
```

Tipos: `payment.approved|declined|expired|refunded`, `shipment.updated`, `dispute.opened|resolved`.
Efeitos esperados: `payment.approved` → todos os pedidos da compra passam a `Pago`; `shipment.updated` → novo
`TrackingEventDto` e possível transição `Enviado → EmTransitoInternacional → Entregue`.

---

## 7. Autenticação e conta

| Método     | Rota                    | Body                                                                | Resposta                                                                            |
| ---------- | ----------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| ✅ POST    | `/auth/login`           | `{ email, password }`                                               | `AuthResponseDto { accessToken, refreshToken, expiresAt, user }`                    |
| ✅ POST    | `/auth/register`        | `{ fullName, email, phone, password }`                              | `201 AuthResponseDto`                                                               |
| ✅ POST    | `/auth/google`          | `{ idToken }` (Google Identity Services)                            | `AuthResponseDto`                                                                   |
| ✅ POST    | `/auth/forgot-password` | `{ email }`                                                         | `202` (sempre, sem revelar existência)                                              |
| 🔜 POST    | `/auth/reset-password`  | `{ token, password }`                                               | `204`                                                                               |
| ✅ POST    | `/auth/refresh`         | cookie/`{ refreshToken }`                                           | `AuthResponseDto`                                                                   |
| ✅ POST    | `/auth/logout`          | —                                                                   | `204`                                                                               |
| ✅ GET     | `/me`                   | —                                                                   | `UserProfileDto { id, fullName, email, phone, cpf, avatarUrl, roles[], createdAt }` |
| ✅ PUT     | `/me`                   | `{ fullName, phone, cpf }` (CPF validado com dígitos verificadores) | `UserProfileDto`                                                                    |
| ✅ GET     | `/me/addresses`         | —                                                                   | `AddressDto[]`                                                                      |
| ✅ POST    | `/me/addresses`         | `AddressInput`                                                      | `201 AddressDto`                                                                    |
| ✅ PUT     | `/me/addresses/{id}`    | `AddressInput`                                                      | `AddressDto`                                                                        |
| ✅ DELETE  | `/me/addresses/{id}`    | —                                                                   | `204`                                                                               |
| 🔜 GET/PUT | `/me/favorites`         | sincronização dos favoritos locais                                  | `FavoriteDto[]`                                                                     |
| 🔜 GET/PUT | `/me/cart`              | sincronização do carrinho local (`CartDto`)                         | `CartDto`                                                                           |

Mock: usuário `demo@mktpy.com` / `123456`. Comprador identificado por **CPF**; vendedor por **RUC** (validação módulo 11 em `lib/validation/documents.ts`).

---

## 8. Painel do vendedor — 🔜 (esqueleto de rotas no front)

| Método   | Rota                                                                                  | Descrição                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| GET      | `/seller/dashboard?from&to`                                                           | `SellerDashboardDto { grossSales, ordersCount, pendingShipments, openQuestions, reputationLevel }`                                              |
| GET/POST | `/seller/products` · PUT/DELETE `/seller/products/{id}`                               | CRUD de produtos e variantes; upload de imagens via URL pré-assinada do **Cloudflare R2** (`POST /seller/uploads` → `{ uploadUrl, publicUrl }`) |
| GET      | `/seller/orders?status` · POST `/seller/orders/{id}/ship` `{ carrier, trackingCode }` | pedidos da loja e postagem                                                                                                                      |
| GET      | `/seller/questions?unanswered` · POST `/seller/questions/{id}/answer` `{ text }`      |                                                                                                                                                 |
| GET/PUT  | `/seller/profile`                                                                     | dados da loja, RUC, política de troca                                                                                                           |
| GET      | `/seller/payouts`                                                                     | ver §6                                                                                                                                          |

## 9. Admin — 🔜

`GET /admin/overview`, `GET/PUT /admin/sellers` (aprovação, reputação), `GET /admin/buyers`, `GET /admin/orders`,
`GET/POST /admin/disputes/{id}/resolve` `{ outcome: "Devolvido"|"Reembolsado"|"Encerrada", note }`,
`GET /admin/payouts`, `GET/PUT /admin/settings` (alíquota estimada de importação, taxas da plataforma, câmbio manual).

---

## Comportamentos do mock que o backend deve replicar (ou que são só para demo)

- Latência 300–800 ms e 3% de erro aleatório em `GET /products` (demo de resiliência) — **só mock**.
- `GET /products?q=erro` → 500; CEP `00000-000` → 404; CEP `99999-999` → 500 — **só mock**.
- Pix/boleto pendentes são aprovados automaticamente após 20 s — **só mock** (produção: webhook do PSP).
- Cartão com final `0000` é recusado — **só mock**.
- Cupom `PARAGUAI10` = 10% no subtotal.
- Alíquota estimada de importação: 60% (basis points 6000) sobre produtos + frete. Em produção, parametrizar por
  faixa de valor (Remessa Conforme / ICMS) em `/admin/settings`.
