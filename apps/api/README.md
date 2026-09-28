# apps/api — ASP.NET Core Web API (.NET 10)

Backend do marketplace Paraguai → Brasil. Implementa o contrato de [`../web/API_CONTRACTS.md`](../web/API_CONTRACTS.md)
(DTOs em [`../../packages/contracts`](../../packages/contracts)) com os mesmos IDs, regras e mensagens do mock do front,
então o PWA funciona ponta a ponta sem alterar componentes.

## Como rodar

Pré-requisito: .NET SDK 10. Nada mais — sem connection string a API sobe com **SQLite** em `.data/marketplace.dev.db`.

```bash
pnpm api                      # ou: dotnet run --project apps/api/src/Marketplace.Api --launch-profile http
# http://localhost:5210  ·  OpenAPI: /openapi/v1.json  ·  UI: /scalar  ·  saúde: /health
pnpm api:test                 # dotnet test apps/api (unitários + integração com SQLite temporário)
```

Ligando o front ao backend (`apps/web/.env.local`):

```env
NEXT_PUBLIC_API_MOCKING=false
API_PROXY_URL=http://localhost:5210     # /api/* é encaminhado pelo Next (mesma origem, sem CORS)
```

Usuário demo (só com `Database:SeedDemoData=true`, padrão em Development): `demo@mktpy.com` / `123456`, cupom
`PARAGUAI10`, cartão final `0000` recusado, Pix/boleto aprovados após 20 s (gateway fake) ou pelo botão
"Simular pagamento" (`POST /payments/{id}/simulate-approval`, existe só em Development com o gateway fake).

### PostgreSQL

Defina `ConnectionStrings:Postgres` (variável `ConnectionStrings__Postgres` ou user-secrets) e a API aplica as
migrations em `Persistence/Migrations` na inicialização. Nova migration:

```bash
cd apps/api
dotnet ef migrations add NomeDaMudanca --project src/Marketplace.Infrastructure --startup-project src/Marketplace.Api --output-dir Persistence/Migrations
```

## Estrutura

```
src/Marketplace.Domain/          entidades, enums (OrderStatus…), Money (inteiro em unidades mínimas),
                                 máquina de estados do pedido, cálculo de impostos, validadores CPF/RUC,
                                 IDs determinísticos (mesmo PRNG do mock do front)
src/Marketplace.Application/     contratos (DTOs), serviços por domínio, abstrações (gateway, frete, CEP,
                                 rastreio, storage, e-mail), erros no formato ApiErrorDto
src/Marketplace.Infrastructure/  EF Core (Npgsql + SQLite), seed, JWT, Mercado Pago, gateway fake, ViaCEP/BrasilAPI,
                                 tabela de frete, R2/local storage, SMTP, jobs em background
src/Marketplace.Api/             Minimal APIs (/api/*), autenticação, CORS, rate limit, output cache, OpenAPI
tests/Marketplace.Tests/         xUnit: domínio + fluxo completo do comprador via WebApplicationFactory
```

## Configuração (`appsettings.json` → variáveis `Secao__Chave`)

| Seção | Chaves | Notas |
| --- | --- | --- |
| `ConnectionStrings:Postgres` | — | vazio = SQLite (`Database:SqlitePath`) |
| `Database` | `SeedDemoData`, `InitializeOnStartup` | seed do catálogo roda sempre que o banco estiver vazio |
| `Auth:Jwt` | `Secret` (≥ 32 chars, **obrigatório**), `Issuer`, `Audience`, `AccessTokenMinutes` | access token longo (7 d) até o front ter o interceptor 401→refresh; refresh token rotativo (30 d) em body e cookie httpOnly |
| `Auth:Google` | `ClientId` | vazio = `POST /auth/google` devolve 422 |
| `Payments` | `Provider` = `Fake` \| `MercadoPago` | `MercadoPago:AccessToken`, `WebhookSecret`, `NotificationUrl` |
| `Payments:Fake` | `AutoApproveAfterSeconds`, `DeclinedLast4`, `WebhookSecret` | demo; `POST /webhooks/payments` assinado com HMAC-SHA256 (`X-Signature`) |
| `PostalCodes` | `AllowOfflineFallback` | ViaCEP → BrasilAPI → (dev) cidade/UF pela zona do CEP |
| `Tracking` | `Provider` = `None` \| `Fake`, `WebhookSecret` | `POST /webhooks/shipping` recebe eventos da transportadora |
| `Storage` | `Provider` = `Local` \| `R2`, `R2:*` | upload por URL pré-assinada (`POST /seller/uploads`) |
| `Email` | `Provider` = `Log` \| `Smtp` | redefinição de senha |
| `Links` | `SiteUrl`, `ApiUrl` | URLs públicas (e-mails, PDF do boleto, política) |
| `Cors:Origins` | lista | origem do PWA quando não usar o proxy |
| `DataProtection:KeysPath` | pasta | chaves que cifram CPF/documento do pagador — **faça backup em produção** |

## Regras de negócio implementadas

- **Dinheiro** sempre `long` em centavos/guaranis; câmbio como fração exata (`numerator/denominator`) travada por 15 min
  na cotação do checkout e gravada no pedido.
- **1 compra = N pedidos (um por loja) = 1 pagamento.** `POST /orders` é idempotente por `idempotencyKey`; valida
  cotação (expirada/consumida/frete alterado → 422), CPF, estoque (reserva ao criar, devolve ao cancelar/expirar).
- **Impostos de importação**: modo `Flat` (60 % sobre produtos + frete − desconto) ou `RemessaConforme`
  (20 % até US$ 50; 60 % − US$ 20 acima; ICMS 17 % por dentro). Sempre apresentado como estimativa. Parâmetros em
  `platform_settings` (linha única, editável pelo admin no futuro).
- **Frete** por loja e zona do CEP (tabela `shipping_zones`), prazos em dias úteis; entrega estimada usa dias úteis +
  prazo de preparação do produto. Frete grátis quando todos os itens da loja têm `freeShipping` e subtotal ≥ R$ 300.
- **Pagamentos**: gateway atrás de `IPaymentGateway`. Cartão só por token (o PAN nunca chega à API). Webhooks
  idempotentes (`webhook_events`). Pix expira em 30 min e boleto após o vencimento (job); cancelar pedido pago
  solicita estorno e, quando todos os pedidos da compra caem, o pagamento vira `Estornado`.
- **Repasses**: ledger `payouts` por pedido (bruto − comissão − custo do meio de pagamento), agendado após o prazo de
  retenção; cancelado em estorno.
- **Rastreio**: eventos normalizados (`POSTED`, `EXPORT`, `ARRIVED_BR`, `CUSTOMS`, `CUSTOMS_RELEASED`,
  `OUT_FOR_DELIVERY`, `DELIVERED`) transitam `Enviado → EmTransitoInternacional → Entregue`; pedidos entregues são
  concluídos automaticamente após `AutoCompleteDays`.
- **LGPD**: consentimentos versionados no cadastro (`consents`), `GET /me/data-export` (portabilidade),
  `DELETE /me` (anonimização mantendo pedidos pelo prazo fiscal), trilha de auditoria (`audit_logs`), CPF e documento
  do pagador cifrados em repouso, nomes públicos abreviados ("Gabriel D.").
- **Segurança**: JWT HS256, refresh rotativo com detecção de reuso, rate limit em `/auth/*` e exportação de dados,
  erros sempre em `application/problem+json` (`{ status, code, message, errors, traceId }`), textos da timeline
  em pt-BR/es-PY por `Accept-Language`.

## Painéis

- **Vendedor** (`/seller/*`, papel Vendedor): cadastro da loja, perfil, produtos (CRUD + fotos), pedidos (preparar/enviar), dashboard.
- **Admin** (`/admin/*`, papel Admin): visão geral (totais, vendas por dia, produtos a caminho), usuários (editar/bloquear/anonimizar),
  vendedores (aprovar/suspender/reputação), produtos, pedidos (transição forçada, disputas), pagamentos (estorno), repasses,
  cupons, câmbio, banners/categorias, configurações da plataforma e auditoria. Admin único criado do `Admin:Email/Password`
  (dev: `admin@mktpy.com` / `admin123`); login alternativo no front em `/admin/entrar`. Detalhes em `GUIA_BACKEND.txt` (raiz).

## Endpoints além do contrato ✅

`POST /products/{id}/reviews`, `POST /orders/{id}/confirm-receipt`, `GET /payments/{id}/boleto.pdf`,
`POST /auth/reset-password`, `GET/PUT /me/favorites`, `GET/PUT /me/cart`, `GET/POST /me/consents`,
`GET /me/data-export`, `DELETE /me`, `GET /privacy/policy`, `POST /seller/uploads`, `PUT /media/{key}`,
`POST /webhooks/{payments|mercadopago|shipping}`.

## Próximos passos

1. Painel do vendedor (`/seller/*`: produtos, pedidos + postagem, perguntas, repasses) e admin (`/admin/*`).
2. Integração real de rastreio (Correios/courier) no `ITrackingProvider`.
3. Interceptor 401 → `POST /auth/refresh` no front e encurtar `AccessTokenMinutes`.
4. Gerar `packages/contracts` a partir de `/openapi/v1.json` (`openapi-typescript`).
