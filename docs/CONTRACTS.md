# API Contracts — Marketplace de Produtos Paraguaios

Especificação dos endpoints REST que o frontend consome (hoje via MSW) e que o backend
**ASP.NET Core Web API + PostgreSQL** deverá implementar. Os DTOs TypeScript equivalentes
estão em [`packages/contracts/src/index.ts`](../packages/contracts/src/index.ts) e os
handlers mock em [`apps/web/src/mocks/handlers`](../apps/web/src/mocks/handlers).

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
No modo `RemessaConforme` (padrão) os tributos são **definitivos** e vêm discriminados em `taxes` (soma das remessas) e em
`groups[].taxes` (uma remessa por loja); no modo `Flat` são estimativa. Ver a seção "Atualizações de 2026-10-05".

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

---

## Atualizações de 2026-10-01 (integrações)

Mudanças aditivas: clientes antigos continuam funcionando. O backend em `apps/api` implementa tudo abaixo.

| Onde | O que mudou |
| --- | --- |
| `ShippingOptionDto` | `+ provider` (`table`, `correios`…) e `+ serviceCode`; o `id` continua estável por (provedor, serviço, loja, zona do CEP) |
| `CheckoutQuoteDto` | `+ postalCode` (CEP cotado) e `+ couponCode`; `POST /orders` responde 422 em `addressId` quando o endereço tem outro CEP |
| `OrderDto` | `+ carrier` |
| `GET /orders/{id}/tracking` | `OrderTrackingDto { trackingCode, carrier, trackingUrl, events }` (link na transportadora quando há template) |
| `POST /orders/{id}/confirm-receipt` | `Entregue → Concluido` pelo comprador |
| `PaymentDto` | `+ refundedAmount` |
| `GET /payments/{id}` | exige sessão do dono (ou admin). `GET /payments/{id}/boleto.pdf?t=` aceita o link assinado emitido na criação do boleto |
| `SellerProductDto` / `SellerProductInput` | `+ weightGrams`, `+ dimensions { lengthCm, widthCm, heightCm }`, `+ hsCode` (cotação com transportadoras) |
| `SellerProfileDto` / `SellerProfileInput` / `SellerRegisterRequest` | `+ originPostalCode`, `+ phone` |
| `POST /seller/register` | a loja nasce `Pendente` e aparece na vitrine após aprovação do admin |
| `AskQuestionRequest` | só `{ question }` |
| Webhooks | `POST /webhooks/payments/{gateway}` (`fake`, `mercadopago`) e `POST /webhooks/shipping/{provider}` (`generic`); rotas antigas continuam como alias. Idempotentes por (provedor, id do evento); resposta ≠ 2xx = reenviar; 404 enquanto a cobrança/pedido não existe |
| Erros | 404/405/415 também em `application/problem+json`; novos códigos 409 `DATA_CONFLICT`, 502 `UPSTREAM_UNAVAILABLE`, 504 `UPSTREAM_TIMEOUT`, 422 `SHIPPING_UNAVAILABLE` |
| Cartão | `card.brand` é o `payment_method_id` do Mercado Pago (`visa`, `master`, `amex`, `elo`, `hipercard`); o front tokeniza com o SDK JS (`NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`) |
| Front | envia `Accept-Language` e `credentials: include`, timeout de 20 s; `POST /auth/logout` com `{ refreshToken }`; access token de 60 min renovado em 401 |

## Atualizações de 2026-10-05 (Remessa Conforme)

Mudanças aditivas, implementadas na API (`apps/api`) e no mock. Regras, cálculo e integrações em
[`REMESSA_CONFORME.md`](REMESSA_CONFORME.md).

| Onde | O que mudou |
| --- | --- |
| `ImportTaxBreakdownDto` (novo) | `regime` (`RemessaConforme`\|`Estimativa`), `isFinal`, `products`, `freight`, `insurance`, `otherExpenses`, `discount`, `customsValue`, `customsValueUsd`, `importDuty` + `importDutyBasisPoints` + `importDutyDeduction`, `icms` + `icmsBasisPoints` + `icmsState`, `ibs` (`ibsState` + `ibsMunicipal`, com as alíquotas), `cbs` + `cbsBasisPoints`, `totalTaxes`, `total`, `effectiveBasisPoints`, `usdRate` (`UsdRateDto`), `exceedsSimplifiedLimit` |
| `CheckoutQuoteDto` | `+ taxes` (soma das remessas); `importTaxRateBasisPoints` passa a ser a alíquota efetiva |
| `CheckoutGroupDto` | `+ taxes` (a remessa da loja) e `+ discount` (desconto rateado) |
| `OrderTotalsDto` | `+ taxes` (gravado na compra; nulo em pedidos antigos) |
| `OrderDto` | `+ shipment` (`ShipmentDto`: status, provedor, `sandbox`, rastreio, declaração, `hasLabel`, `labelUrl` só para vendedor/admin, DIR, situação aduaneira, `remittance`) |
| `AddressDto` / `AddressInput` | `+ recipientCpf` (obrigatório, validado; só o dono vê). `POST /orders` responde 422 em `addressId` sem CPF válido ou com CPF irregular no Serpro |
| `SellerProfileDto` | `+ verification` (`SellerVerificationDto`: endereço de origem, responsável, tipo e documento mascarado, URLs do documento e da constância do RUC, `complete`, `verifiedAt`, `suspensionReason`) |
| `SellerProfileInput` / `SellerRegisterRequest` | `+ legalAddress`, `+ responsibleName`, `+ responsibleDocumentType` (`CedulaPy`\|`Cpf`\|`Passaporte`), `+ responsibleDocument` (vazio mantém o atual), `+ identityDocumentUrl`, `+ rucCertificateUrl` — obrigatórios |
| `ProductStatus` | `+ EmAnalise`, `+ Bloqueado` (só a plataforma aplica) |
| `SellerProductDto` / `SellerProductListItemDto` | `+ moderationReason`, `+ moderationNote`, `+ hsCodeDescription`; `hsCode` (NCM de 8 dígitos) obrigatório para `status: Ativo` |
| `AdminProductListItemDto` | `+ moderationReason`, `+ hsCode`, `+ openReports` |
| `AdminSellerListItemDto` / `AdminSellerDetailDto` | `+ verified`, `+ occurrences` / `+ verification`, `+ occurrences[]` |
| `AdminSellerUpdateRequest` | `+ suspensionReason` (obrigatório ao suspender); aprovar loja pendente exige documentos verificados |
| `PlatformSettingsDto` | `+ icmsStateOverrides`, `+ ibsStateBasisPoints`, `+ ibsMunicipalBasisPoints`, `+ cbsBasisPoints`, `+ insuranceBasisPoints`, `+ otherExpensesAmount`, `+ sellerStrikeLimit`, `+ strikeWindowDays`, `+ priceFloorPercent`, `+ protectedBrands`, `+ requirePlatformLabel`; `importTaxMode` padrão `RemessaConforme` |
| `POST /seller/orders/{id}/ship` | body opcional; com a etiqueta emitida usa o rastreio dela; sem etiqueta → 409 `LABEL_REQUIRED` (salvo `requirePlatformLabel = false`) |

### Novos endpoints

| Método | Rota | Auth | Resposta |
| --- | --- | --- | --- |
| GET | `/taxes/estimate?amount=&state=` | — | `ImportTaxBreakdownDto` (produtos sem frete; PDP e carrinho) |
| GET | `/ncm?q=` | — | `NcmLookupDto[]` (até 20) |
| GET | `/ncm/{code}` | — | `NcmLookupDto { code, formatted, description, official }`; 422 formato, 404 fora da tabela vigente |
| POST | `/products/{id}/reports` | comprador | `201 ProductReportDto`; body `{ reason, details? }`; 409 `REPORT_ALREADY_OPEN` |
| POST | `/seller/orders/{id}/shipment` | vendedor | `201 ShipmentDto`; 409 `SHIPMENT_EXISTS`/`ORDER_INVALID_TRANSITION`, 422 com o que falta na declaração, 503 operador não configurado |
| GET | `/seller/orders/{id}/shipment` | vendedor | `ShipmentDto` |
| GET | `/seller/orders/{id}/shipment/label` | vendedor | `application/pdf` |
| GET | `/seller/shipping-policy` | vendedor | `SellerShippingPolicyDto { requirePlatformLabel, carrierConfigured, sandbox, carrier }` |
| GET | `/admin/compliance?cycle=` | admin | `ComplianceDashboardDto` |
| GET / POST | `/admin/compliance/occurrences` | admin | `PagedResult<ComplianceOccurrenceDto>` (filtros `indicator`, `sellerId`, `status`) / `201 ComplianceOccurrenceDto` |
| POST | `/admin/compliance/occurrences/{id}/status` | admin | `ComplianceOccurrenceDto`; `Contestada`/`Anulada` exigem `reason` |
| GET | `/admin/reports?status=` | admin | `PagedResult<ProductReportDto>` |
| POST | `/admin/reports/{id}/resolve` | admin | `ProductReportDto`; body `{ upheld, indicator?, blockProduct, note? }` |
| POST | `/admin/products/{id}/moderate` | admin | `AdminProductListItemDto`; body `{ action: aprovar\|bloquear\|analisar, reason?, note? }` |
| POST | `/admin/sellers/{id}/verify` | admin | `AdminSellerDetailDto`; body `{ approve, note? }` (recusa exige `note`) |
| GET | `/admin/shipments?status=&q=` | admin | `PagedResult<AdminShipmentListItemDto>` |
| GET | `/admin/shipments/{id}/label` | admin | `application/pdf` (segunda via no sandbox) |
| POST | `/admin/shipments/{id}/retry` | admin | `ShipmentDto`; só remessas `Falhou` (409 `SHIPMENT_NOT_FAILED`) |
| GET | `/admin/integrations` | admin | `IntegrationStatusDto[]` (`key`, `mode`, `configured`, `requiresCredential`, `missing[]`, `detail`) |
