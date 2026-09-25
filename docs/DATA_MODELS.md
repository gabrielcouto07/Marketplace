# Modelos de dados (DTOs) e regras de negócio

Fonte da verdade: [`packages/contracts/src/index.ts`](../packages/contracts/src/index.ts). Este documento explica o
porquê de cada modelo e como mapeá-lo para o .NET/PostgreSQL.

## Primitivos

### `Money`

```ts
interface Money {
  amount: number;
  currency: "BRL" | "PYG" | "USD";
}
```

- `amount` **inteiro** em unidades mínimas: BRL/USD → centavos (2 casas); PYG → guaranis (0 casas).
- Operações em `lib/money`: `add`, `subtract`, `multiply` (fator inteiro), `multiplyBasisPoints` (percentuais em
  bp, 10000 = 100%, arredondamento half-up), `sum`, `convert`, `splitInstallments` (última parcela absorve o resto).
- Formatação com `Intl.NumberFormat` (`formatMoney`, `formatMoneyParts`). Locale natural da moeda (pt-BR para BRL,
  es-PY para PYG) — o símbolo `₲` é normalizado.
- .NET: `record Money(long Amount, string Currency)`; coluna `numeric(18,0)`/`bigint` + `char(3)`.

### `ExchangeRateDto`

Fração exata `numerator/denominator` para evitar float: `toMinor = round(fromMinor × num / den)`.
Ex.: BRL→PYG `1389/100` (1 centavo → 13,89 guaranis), PYG→BRL `72/1000`. Tem `id`, `quotedAt`, `expiresAt` e
`displayRate` pronto para exibir. O `id` é enviado no `PlaceOrderRequest` (`exchangeRateId`) e gravado no pedido
(`OrderDto.exchangeRate`) — **câmbio travado no momento do checkout** e mostrado ao usuário.

### `PagedResult<T>` — `{ items, page, pageSize, totalCount }` (page 1-based).

### `ApiErrorDto` — `{ status, code, message, errors?, traceId? }` (ProblemDetails simplificado).

## Catálogo

| DTO                              | Campos-chave                                                                                                                                       | Observações                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `CategoryDto`                    | `slug`, `name`, `iconKey`, `parentId`                                                                                                              | 8 categorias raiz; `iconKey` mapeia para lucide (`CategoryIcon`)                    |
| `ProductSummaryDto`              | `price`, `compareAtPrice`, `referencePrice` (PYG), `discountPercent`, `rating`, `soldCount`, `stock`, `freeShipping`, `isNew`, `isOffer`, `seller` | tudo que o `ProductCard` precisa, sem detalhes pesados                              |
| `ProductDetailDto`               | + `description`, `images[]`, `variantOptions[]`, `variants[]`, `attributes[]`, `originCity`, `handlingDays`, `warrantyMonths`                      | variantes = produto cartesiano das opções; cada variante tem preço/estoque próprios |
| `ReviewDto` / `ReviewSummaryDto` | `rating`, `verifiedPurchase`, `distribution[5]`                                                                                                    |                                                                                     |
| `QuestionDto`                    | `answer: {text, answeredAt}                                                                                                                        | null`                                                                               |     |
| `SellerSummaryDto` / `SellerDto` | `reputationLevel 1–5`, `isOfficialStore`, `ruc`, `metrics`                                                                                         | reputação estilo termômetro                                                         |

**Variações**: `variantOptions` descreve as opções (Cor, Tamanho…); `variants[].attributes` é o mapa
`{ Cor: "Preto", Armazenamento: "256 GB" }`. Preço exibido = variante selecionada ou `price` base.

## Carrinho (cliente)

`features/cart/store.ts` guarda `CartLine` com **snapshot** (nome, imagem, preço, loja) para renderizar offline;
chave `productId:variantId`. Agrupamento por vendedor (`groupBySeller`) é derivado, nunca persistido.
`CartDto`/`CartLineDto` existem no contrato para futura sincronização (`PUT /me/cart`).

## Frete e endereço

- `AddressDto` (Brasil): CEP 8 dígitos, UF 2 letras, `isDefault`. Comprador é sempre destinatário no BR.
- `ShippingQuoteRequest` é **por vendedor** (origem diferente por loja) → `ShippingOptionDto[]` com `estimatedDays`
  em faixa de **dias úteis** (prazos longos: 12–25 econômico, 5–10 expresso).
- `PostalCodeLookupDto` preenche o formulário de endereço.

## Checkout e pedidos

- `CheckoutQuoteDto` consolida grupos (loja → linhas, opções de frete, subtotal), totais, `estimatedImportTax`
  (alíquota em bp em `importTaxRateBasisPoints`), `discount`, `total`, `totalReference` (PYG), `exchangeRate` e
  `lockedUntil` (15 min).
- `PlaceOrderRequest` → `PlaceOrderResponseDto { purchaseId, orders[], payment }`: **1 compra = N pedidos (um por
  vendedor) = 1 pagamento**.
- `OrderDto.status: OrderStatus` (enum de string):

| Status                    | Significado                          | Quem transita            |
| ------------------------- | ------------------------------------ | ------------------------ |
| `AguardandoPagamento`     | criado, Pix/boleto pendente          | sistema                  |
| `Pago`                    | pagamento aprovado (webhook)         | sistema                  |
| `EmPreparacao`            | vendedor separando                   | vendedor                 |
| `Enviado`                 | postado no Paraguai (`trackingCode`) | vendedor                 |
| `EmTransitoInternacional` | exportação/alfândega BR              | rastreio                 |
| `Entregue`                | entregue                             | rastreio                 |
| `Concluido`               | comprador confirmou / prazo          | comprador/sistema        |
| `Cancelado`               | antes do envio                       | comprador/vendedor/admin |
| `EmDisputa`               | comprador abriu disputa              | comprador                |
| `Devolvido`               | produto voltou                       | admin                    |
| `Reembolsado`             | estorno concluído                    | admin/sistema            |

Constantes exportadas: `ORDER_STATUSES` (todos) e `ORDER_HAPPY_PATH` (caminho feliz, usado pela `OrderTimeline`).
`timeline[]` registra cada transição; `trackingEvents[]` são eventos brutos da transportadora.
`estimatedDelivery` é uma faixa de datas (`DateRange`) calculada a partir de `estimatedDays` + postagem.

## Pagamentos

`PaymentDto` polimórfico por `method`: `pix` (payload EMV copia-e-cola + expiração 30 min), `boleto` (linha
digitável, código de barras, vencimento 3 dias, PDF), `card` (bandeira, last4, parcelas). Status:
`Pendente | Aprovado | Recusado | Expirado | Estornado`.

## Auth / conta

`UserProfileDto.cpf` só dígitos (11), validado com dígitos verificadores; `roles: Comprador | Vendedor | Admin`.
`AuthResponseDto` traz `accessToken` + `refreshToken` + `user`. Vendedor identificado por **RUC** (`SellerDto.ruc`,
validação módulo 11 em `lib/validation/documents.ts`).

## Futuro (contrato definido)

`SellerDashboardDto`, `PayoutDto` (`Agendado | Processando | Pago | Falhou`, gross/platformFee/paymentFee/net),
`WebhookEventDto<T>` (`payment.*`, `shipment.updated`, `dispute.*`), `FavoriteDto`, `CartDto`.

## Mapeamento sugerido para PostgreSQL

| Tabela                 | Colunas principais                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories`           | id uuid, slug unique, name, parent_id                                                                                                                                 |
| `sellers`              | id, slug, name, ruc unique, city, reputation_level smallint, is_official bool                                                                                         |
| `products`             | id, seller_id, category_id, slug unique, name, description, price_amount bigint, price_currency char(3), compare_at_amount, stock int, free_shipping bool, created_at |
| `product_variants`     | id, product_id, sku, attributes jsonb, price_amount, stock                                                                                                            |
| `product_images`       | id, product_id, url (R2), sort_order                                                                                                                                  |
| `reviews`, `questions` | product_id, user_id, rating/answer…                                                                                                                                   |
| `addresses`            | id, user_id, postal_code char(8), … is_default                                                                                                                        |
| `exchange_rates`       | id, from, to, numerator bigint, denominator bigint, quoted_at, expires_at                                                                                             |
| `purchases`            | id, user_id, payment_id, exchange_rate_id, created_at                                                                                                                 |
| `orders`               | id, number unique, purchase_id, seller_id, status (enum), address snapshot jsonb, shipping_option jsonb, totals jsonb, tracking_code                                  |
| `order_items`          | id, order_id, product_id, variant_id, name/thumbnail snapshot, quantity, unit_price_amount                                                                            |
| `order_events`         | order_id, status, occurred_at, description, location                                                                                                                  |
| `payments`             | id, purchase_id, method, status, amount, pix/boleto/card jsonb                                                                                                        |
| `payouts`              | id, seller_id, period, gross/fees/net, status                                                                                                                         |
| `webhook_events`       | id, type, payload jsonb, processed_at (idempotência)                                                                                                                  |
