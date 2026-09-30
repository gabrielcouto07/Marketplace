# Integração com o backend ASP.NET Core

O backend existe em [`apps/api`](../apps/api/README.md) (.NET 10, Minimal APIs, EF Core com PostgreSQL ou SQLite) e
implementa todos os endpoints ✅ de `apps/web/API_CONTRACTS.md`, com os mesmos IDs determinísticos do mock.

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
  repete a requisição com o token novo e, se a renovação falhar, encerra a sessão (as telas mostram "Entre para
  continuar"). Com isso `Auth:Jwt:AccessTokenMinutes` pode ser reduzido (hoje 7 dias por compatibilidade com o mock).

## 4. Pagamentos

- `Payments:Provider=Fake` (padrão): Pix/boleto aprovados após `AutoApproveAfterSeconds` (20 s em Development) ou por
  `POST /payments/{id}/simulate-approval`; cartão final `0000` recusado. O botão "Simular pagamento" do front continua
  funcionando em dev e recebe 404 em produção (endpoint não mapeado).
- `Payments:Provider=MercadoPago`: informe `AccessToken`, `WebhookSecret` e `NotificationUrl`
  (`https://api.seudominio.com/api/webhooks/payments`). Cartão: tokenize no navegador com o SDK JS do Mercado Pago e
  envie `card.token` + `brand` (id do meio, ex. `visa`). Pix devolve `qrCodePayload` + `qrCodeImageUrl` (base64);
  boleto devolve `pdfUrl` do gateway.
- Split: a cobrança entra na conta da plataforma; o líquido de cada loja fica no ledger `payouts`
  (`PlatformFeeBasisPoints`, `PaymentFeeBasisPoints`, `PayoutHoldDays` em `platform_settings`).

## 5. Frete, CEP, câmbio e rastreio

- CEP: ViaCEP → BrasilAPI com cache 24 h (`PostalCodes`). Em dev sem internet, `AllowOfflineFallback=true` devolve
  cidade/UF pela zona.
- Frete: `TableShippingRateProvider` (zonas em `shipping_zones`). Para uma transportadora real, implemente
  `IShippingRateProvider` mantendo IDs de opção estáveis por cotação.
- Câmbio: tabela `exchange_rates` (BRL→PYG, PYG→BRL, USD→BRL). A cotação do checkout trava a taxa por
  `QuoteLockMinutes`.
- Rastreio: `POST /webhooks/shipping` (HMAC `X-Signature` com `Tracking:WebhookSecret`) com
  `{ trackingCode, events: [{ id, code, description, location, occurredAt }] }`; ou `Tracking:Provider=Fake` para
  simular a jornada. O job `LogisticsJob` aplica eventos e transita o pedido.

## 6. Imagens

- `Storage:Provider=Local` serve uploads em `/api/media/*`; `R2` gera URL pré-assinada (PUT) e URL pública em
  `Storage:R2:PublicBaseUrl` — adicione esse host em `next.config.ts › images.remotePatterns`.

## 7. LGPD

`GET /privacy/policy`, `GET/POST /me/consents`, `GET /me/data-export`, `DELETE /me` (senha ou frase de confirmação).
Dados pessoais sensíveis (CPF, documento do pagador) são cifrados com Data Protection — persista as chaves
(`DataProtection:KeysPath`) em volume durável ou banco.

## 8. Produção (checklist)

- [ ] `ConnectionStrings__Postgres`, `Auth__Jwt__Secret` (≥ 32 chars), `Links__SiteUrl`, `Links__ApiUrl`
- [ ] `Payments__Provider=MercadoPago` + credenciais + webhook cadastrado
- [ ] `Storage__Provider=R2` + `Email__Provider=Smtp`
- [ ] `Database__SeedDemoData=false` (padrão fora de Development)
- [ ] Front: `NEXT_PUBLIC_API_MOCKING=false` e `NEXT_PUBLIC_API_URL` absoluta (ou rewrite para a API)
- [ ] HTTPS, `Cors__Origins`, backup de `DataProtection:KeysPath`
- [ ] Cache de catálogo: a API já envia `s-maxage`-friendly output cache de 60 s em `/home`, `/categories`, `/products`
