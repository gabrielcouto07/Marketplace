# Integração com o backend ASP.NET Core

O backend existe em [`apps/api`](../apps/api/README.md) (.NET 10, Minimal APIs, EF Core com PostgreSQL ou SQLite) e
implementa todos os endpoints ✅ de `docs/CONTRACTS.md`, com os mesmos IDs determinísticos do mock.

## 1. Rodando junto com o front (desenvolvimento)

```bash
pnpm api          # API em http://localhost:5210 (SQLite + seed + usuário demo)
pnpm dev          # PWA em http://localhost:3210
```

`apps/web/.env.local`:

```env
NEXT_PUBLIC_API_MOCKING=false
API_PROXY_URL=http://localhost:5210   # next.config.ts encaminha /api/* → backend (mesma origem)
```

Alternativa sem proxy: `NEXT_PUBLIC_API_URL=http://localhost:5210/api` e a origem do front em `Cors:Origins` da API.

Sem `ConnectionStrings:Postgres` a API usa SQLite (`.data/marketplace.dev.db`, `EnsureCreated`, sem migrations). Quando as
entidades mudam, o arquivo é recriado automaticamente na subida (hash do schema guardado em `__schema_hash`; o seed roda
de novo). `Database:RecreateSqliteOnSchemaChange=false` troca a recriação por um erro pedindo para apagar o arquivo.

Com o mock desligado, `MockProvider` não bloqueia a renderização e `instrumentation.ts` não registra o MSW.

## 2. Contrato

- JSON `camelCase`, GUIDs, ISO 8601 UTC com `Z`, `Money` inteiro, enums como string — configurado em
  `Marketplace.Api/Infrastructure/JsonSetup.cs`.
- Erros em `application/problem+json` no formato `ApiErrorDto` (`{ status, code, message, errors, traceId }`), inclusive
  401/403 do JWT e 429 do rate limit.
- OpenAPI em `/openapi/v1.json` (UI em `/scalar`). Para gerar tipos:
  `pnpm dlx openapi-typescript http://localhost:5210/openapi/v1.json -o packages/contracts/src/generated.ts`.

## 3. Autenticação

- JWT Bearer (`Authorization: Bearer <accessToken>`), emitido em `/auth/login|register|google|refresh`.
- Refresh token rotativo devolvido no body **e** em cookie `mktpy_refresh` (httpOnly, `Path=/api/auth`). Com o proxy
  do Next o cookie funciona no PWA; `POST /auth/refresh` aceita body `{ refreshToken }` ou o cookie.
- Google: configure `Auth:Google:ClientId` na API e troque `useGoogleLogin` para obter o `idToken` real via Google
  Identity Services.
- O front já intercepta **401** em `lib/api/http.ts`: chama `POST /auth/refresh` uma única vez (single-flight),
  repete a requisição com o token novo e, se a renovação falhar, encerra a sessão e limpa o cache de queries. O access
  token dura 60 min por padrão (`Auth:Jwt:AccessTokenMinutes`); o refresh token (30 d) vai no body e no cookie httpOnly
  e o front envia `credentials: include`. O logout envia `{ refreshToken }` para revogá-lo.

## 4. Pagamentos

- Todos os gateways ficam registrados ao mesmo tempo (`IPaymentGatewayRegistry`); `Payments:Provider` escolhe quem cria
  cobranças novas. Consultas, estornos e webhooks usam o gateway gravado em `payments.gateway`, então trocar de
  provedor não quebra cobranças antigas.
- `Payments:Provider=Fake` (padrão em dev): Pix/boleto aprovados após `AutoApproveAfterSeconds` (20 s em Development) ou
  por `POST /payments/{id}/simulate-approval` (só Development); cartão final `0000` recusado. **Fora de Development o
  fake é recusado na inicialização** (a menos de `Payments:AllowFakeOutsideDevelopment=true`, para homologação).
  O webhook fake (`POST /webhooks/payments/fake`) exige `Payments:Fake:WebhookSecret` — segredo vazio nunca valida.
- `Payments:Provider=MercadoPago`: informe `AccessToken`, `WebhookSecret` (obrigatório fora de Development) e
  `NotificationUrl` (`https://api.seudominio.com/api/webhooks/payments/mercadopago`). Cartão: tokenize no navegador com
  o SDK JS (`NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` no front) e envie `card.token` + `brand` já como `payment_method_id`
  (`visa`, `master`, `amex`, `elo`, `hipercard`). Pix devolve `qrCodePayload` + `qrCodeImageUrl` (base64); boleto devolve
  a linha digitável (47 dígitos, derivada do código de barras) e `pdfUrl` do gateway. Assinatura `x-signature` validada
  com tolerância de `SignatureToleranceMinutes` (replay).
- Webhooks são idempotentes por (gateway, id do evento) e registrados em `webhook_events` (`attempts`, `error`,
  `processed_at`). Resposta ≠ 2xx faz o gateway reenviar: um pagamento ainda não encontrado responde 404 de propósito
  (o webhook pode chegar antes de gravarmos o id do gateway; a `external_reference` resolve na segunda tentativa). O
  valor informado pelo gateway é conferido antes de aprovar; divergência fica registrada para revisão manual.
- Pagamento confirmado depois de expirar/recusar (pedidos já cancelados) é estornado automaticamente. Estornos passam
  pelo `RefundService` (idempotentes por pedido, `refunded_amount`/`last_refund_id` no pagamento).
- Split: a cobrança entra na conta da plataforma; o líquido de cada loja fica no ledger `payouts`
  (`PlatformFeeBasisPoints`, `PaymentFeeBasisPoints`, `PayoutHoldDays` em `platform_settings`).

## 5. Frete, CEP, câmbio e rastreio

Cada integração é uma porta em `Marketplace.Application/Abstractions` com provedores registrados por nome
(`services.AddProvider<TPorta, TImpl>("nome")` em `Infrastructure/DependencyInjection.cs`). A configuração escolhe o ativo.

- **CEP** (`IPostalCodeLookup`): ViaCEP → BrasilAPI com cache 24 h e política de resiliência (timeout 4 s, 1 retry).
  Em dev sem internet, `PostalCodes:AllowOfflineFallback=true` devolve cidade/UF pela zona.
- **Frete** (`IShippingRateProvider`): `Shipping:Provider=Table` (padrão) usa a tabela `shipping_zones`. Para uma
  transportadora ou agregador (Correios, Melhor Envio, DHL…), implemente a porta recebendo `ShippingQuoteContext`
  (origem da loja com `originPostalCode`, destino, itens com `weightGrams`/`dimensions`/`hsCode`, valor declarado) e
  devolva opções com `provider` + `serviceCode` e id estável (`ShippingRateOption.StableId`). O
  `CompositeShippingRateProvider` chama o provedor configurado e cai na tabela em falha/timeout/lista vazia
  (`Shipping:FallbackToTable`, `TimeoutSeconds`). Frete grátis é regra da plataforma (`ShippingService`), não do provedor.
  Nenhuma opção → 422 `SHIPPING_UNAVAILABLE`.
- **Câmbio** (`IExchangeRateProvider`): `ExchangeRates:Provider=Manual` (admin cadastra). Um provedor externo registrado
  é consultado pelo `ExchangeRateRefreshJob` a cada `RefreshIntervalMinutes` para os `Pairs` configurados. A cotação do
  checkout trava a taxa por `QuoteLockMinutes`.
- **Rastreio** (`ITrackingProvider` + `ITrackingWebhookParser`): o provedor é escolhido pelo nome da transportadora
  informado no envio (`Supports(carrier)`); o `LogisticsJob` consulta pedidos em trânsito a cada `PollIntervalMinutes`
  (`PollBatchSize` por rodada). Webhooks por provedor em `POST /webhooks/shipping/{provider}`; o parser `generic`
  aceita `{ id?, trackingCode, carrier?, events: [{ id?, code, description, location?, occurredAt }] }` assinado com
  HMAC-SHA256 do corpo em `X-Signature` (`Tracking:WebhookSecret`). Códigos normalizados em
  `Domain/Shipping/TrackingCodes.cs` (`POSTED`, `EXPORT`, `IN_TRANSIT`, `ARRIVED_BR`, `CUSTOMS`, `TAX_PENDING`,
  `CUSTOMS_RELEASED`, `OUT_FOR_DELIVERY`, `DELIVERY_FAILED`, `DELIVERED`, `RETURNED`) transitam o pedido.
  `Tracking:Provider=Fake` simula a jornada. `GET /orders/{id}/tracking` devolve `carrier` e `trackingUrl`
  (`Links:TrackingUrlTemplates`, por trecho do nome da transportadora; códigos postais universais caem nos Correios).
- **Limpeza**: `HousekeepingJob` apaga cotações vencidas, tokens expirados e webhooks antigos (`Housekeeping:*`).

### Como adicionar uma integração (ex.: Melhor Envio)

1. Crie `Infrastructure/Shipping/MelhorEnvioRateProvider.cs : IShippingRateProvider` (`Name = "melhorenvio"`), com um
   `HttpClient` tipado + `AddStandardResilienceHandler`.
2. Registre em `DependencyInjection.cs`: `services.AddHttpClient<MelhorEnvioRateProvider>(…)` e
   `services.AddProvider<IShippingRateProvider, MelhorEnvioRateProvider>("melhorenvio", registerImplementation: false)`.
3. Configure `Shipping:Provider=MelhorEnvio` (+ credenciais numa seção própria com `AddOptions<…>().ValidateOnStart()`).
4. Para rastreio, implemente `ITrackingProvider` (polling) e/ou `ITrackingWebhookParser` (webhook) e registre do mesmo
   jeito; a rota `POST /webhooks/shipping/melhorenvio` passa a existir automaticamente.

## 6. Imagens

- `Storage:Provider=Local` serve uploads em `/api/media/*`; `R2` gera URL pré-assinada (PUT) e URL pública em
  `Storage:R2:PublicBaseUrl` — adicione esse host em `next.config.ts › images.remotePatterns`.

## 7. LGPD

`GET /privacy/policy`, `GET/POST /me/consents`, `GET /me/data-export`, `DELETE /me` (senha ou frase de confirmação).
Dados pessoais sensíveis (CPF, documento do pagador) são cifrados com Data Protection — persista as chaves
(`DataProtection:KeysPath`) em volume durável ou banco.

## 8. Produção (checklist)

- [ ] `ConnectionStrings__Postgres`, `Auth__Jwt__Secret` (≥ 32 chars), `Links__SiteUrl`, `Links__ApiUrl`
- [ ] `Payments__Provider=MercadoPago` + `AccessToken` + `WebhookSecret` + `NotificationUrl` (webhook cadastrado no painel);
      o fake é recusado fora de Development
- [ ] `Tracking__WebhookSecret` (webhook genérico) e/ou `Tracking__Provider` com a transportadora integrada
- [ ] `Shipping__Provider` (ou mantenha `Table`) e pesos/dimensões cadastrados nos produtos para cotação real
- [ ] `Storage__Provider=R2` + `Email__Provider=Smtp`
- [ ] `Database__SeedDemoData=false` (padrão fora de Development)
- [ ] Front: `NEXT_PUBLIC_API_MOCKING=false`, `NEXT_PUBLIC_API_URL` absoluta (ou rewrite para a API),
      `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (opcional)
- [ ] HTTPS, `Cors__Origins`, backup de `DataProtection:KeysPath`, `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` atrás do proxy
- [ ] `OpenApi__Enabled=false` (padrão) — `/openapi` e `/scalar` só em Development
- [ ] Cache de catálogo: output cache de 60 s em `/home`, `/categories`, `/products`, invalidado em edições de vendedor/admin
