# apps/api — ASP.NET Core Web API (.NET 10)

Backend do marketplace Paraguai → Brasil. Implementa o contrato de [`../../docs/CONTRACTS.md`](../../docs/CONTRACTS.md)
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
| `Database` | `SeedDemoData`, `InitializeOnStartup`, `RecreateSqliteOnSchemaChange` | seed do catálogo roda sempre que o banco estiver vazio; o SQLite de dev é recriado sozinho quando as entidades mudam (hash do schema em `__schema_hash`) |
| `Auth:Jwt` | `Secret` (≥ 32 chars, **obrigatório**), `Issuer`, `Audience`, `AccessTokenMinutes` | o front já renova em 401 (`lib/api/http.ts`), então `AccessTokenMinutes` pode ser curto (ex.: 15); refresh token rotativo (30 d) em body e cookie httpOnly |
| `Auth:Google` | `ClientId` | vazio = `POST /auth/google` devolve 422 |
| `Payments` | `Provider` = `Fake` \| `MercadoPago`, `AllowFakeOutsideDevelopment` | todos os gateways ficam registrados; o provider só decide cobranças novas. Fake fora de Development só com `AllowFakeOutsideDevelopment=true` |
| `Payments:MercadoPago` | `AccessToken`, `WebhookSecret`, `NotificationUrl`, `RequireSignature`, `SignatureToleranceMinutes` | webhook em `POST /webhooks/payments/mercadopago` |
| `Payments:Fake` | `AutoApproveAfterSeconds`, `DeclinedLast4`, `WebhookSecret` | demo; `POST /webhooks/payments/fake` assinado com HMAC-SHA256 (`X-Signature`); segredo vazio = rejeitado |
| `Shipping` | `Provider` = `Table` \| `<integração>`, `FallbackToTable`, `TimeoutSeconds` | cotação via `IShippingRateProvider`; a tabela própria é o fallback |
| `PostalCodes` | `AllowOfflineFallback` | ViaCEP → BrasilAPI → (dev) cidade/UF pela zona do CEP |
| `Tracking` | `Provider` = `None` \| `Fake` \| `<integração>`, `WebhookSecret`, `PollIntervalMinutes`, `PollBatchSize` | `POST /webhooks/shipping/{provider}` (parser `generic` assinado) e polling por transportadora |
| `ExchangeRates` | `Provider` = `Manual` \| `<integração>`, `RefreshIntervalMinutes`, `ValidityHours`, `Pairs` | importação automática de cotações (job) |
| `Housekeeping` | `IntervalMinutes`, `QuoteRetentionHours`, `TokenRetentionDays`, `WebhookRetentionDays` | limpeza de cotações, tokens e webhooks |
| `Storage` | `Provider` = `Local` \| `R2`, `R2:*` | upload por URL pré-assinada (`POST /seller/uploads`) |
| `Email` | `Provider` = `Log` \| `Smtp` | redefinição de senha |
| `Links` | `SiteUrl`, `ApiUrl`, `TrackingUrlTemplates`, `BoletoLinkDays` | URLs públicas; link do PDF do boleto é assinado (`?t=`) e expira |
| `OpenApi` | `Enabled` | `/openapi/v1.json` e `/scalar` fora de Development (padrão: desligado) |
| `Cors:Origins` | lista | origem do PWA quando não usar o proxy |
| `DataProtection:KeysPath` | pasta | chaves que cifram CPF/documento do pagador — **faça backup em produção** |
| `RemessaConforme:Platform` | `Brand`, `TradeName`, `LegalName`, `DocumentType` (`CNPJ`\|`TIN`), `Document`, `AdeNumber`, `AddressLine`, `OperatorCode`, `OperatorName` | identidade da empresa na etiqueta e no bloco `remessaConforme` da declaração |
| `RemessaConforme:Carrier` | `Provider` = `Sandbox` \| `Http`, `BaseUrl`, `ApiKey`, `ApiKeyHeader`, `ApiKeyScheme`, `ShipmentsPath`, `CancelPathTemplate`, `RemittancesPath`, `CarrierName`, `AllowSandboxOutsideDevelopment` | operador logístico ([contrato v1](../../docs/REMESSA_CONFORME.md#53-operador-logístico--contrato-de-integração-v1)); sem `Http` configurado: sandbox em Development, desligado fora |
| `RemessaConforme:JobIntervalMinutes` | 10 | repasse dos tributos e cancelamentos no operador |
| `Siscomex` | `BaseUrl` (validação por padrão), `ClientId`, `ClientSecret`, `Cnpj`, `RoleType` (`EMPRCOMEL`), `SyncIntervalMinutes`, `LookbackDays`, `OccurrenceMap` | consulta de remessas da ECE no Portal Único (DIR, situação, ocorrências e divergências → indicadores) |
| `Serpro` | `ConsumerKey`, `ConsumerSecret`, `CacheHours` | situação do CPF do destinatário; sem chave vale só o dígito verificador |
| `Ncm` | `Source` = `Siscomex` \| `Offline`, `Url`, `CachePath`, `RefreshHours` | tabela NCM oficial (pública, sem chave) |
| `Ptax` | `Provider` = `bcb-ptax` \| `None`, `RefreshIntervalMinutes`, `ValidityHours` | câmbio USD→BRL do Banco Central (público, sem chave) |

## Regras de negócio implementadas

- **Dinheiro** sempre `long` em centavos/guaranis; câmbio como fração exata (`numerator/denominator`) travada por 15 min
  na cotação do checkout e gravada no pedido.
- **1 compra = N pedidos (um por loja) = 1 pagamento.** `POST /orders` é idempotente por `idempotencyKey`; valida
  cotação (expirada/consumida/frete alterado → 422), CPF, estoque (reserva ao criar, devolve ao cancelar/expirar).
- **Impostos de importação** (`Domain/ImportTaxCalculator.cs`): no modo `RemessaConforme` (padrão) o valor é
  definitivo e calculado por remessa (um pedido por loja): valor aduaneiro = produtos + frete + seguro + despesas −
  desconto rateado; II de 20 % até US$ 50 e de 60 % − US$ 20 acima (câmbio PTAX); ICMS por dentro com a alíquota da UF
  de destino; IBS (estadual + municipal) e CBS sobre valor aduaneiro + II. O detalhamento (`taxes`) vai na cotação, no
  pedido e na declaração. O modo `Flat` (alíquota única) segue disponível e aparece como estimativa. Parâmetros em
  `platform_settings`, editáveis no admin.
- **Remessa Conforme**: declaração antecipada e etiqueta da plataforma por remessa (`RemessaService`), repasse dos
  tributos ao operador, NCM obrigatório e conferido na tabela oficial, CPF do destinatário obrigatório, admissão e
  moderação de vendedores, denúncias, ocorrências e os indicadores da Portaria Coana 193/2026 (`ComplianceService`).
  Tudo em [`docs/REMESSA_CONFORME.md`](../../docs/REMESSA_CONFORME.md), inclusive a chave que falta em cada integração.
- **Frete** por loja via `IShippingRateProvider` (tabela própria por zona do CEP como padrão e fallback; integrações
  recebem peso/dimensões/NCM dos produtos e CEP de origem da loja). Prazos em dias úteis + preparação. Frete grátis
  (todos os itens da loja elegíveis e subtotal ≥ limite da plataforma) é aplicado pelo `ShippingService`. O pedido só
  aceita o endereço com o CEP cotado; cupom aplicado conta em `used_count`.
- **Pagamentos**: gateways atrás de `IPaymentGateway`/`IPaymentGatewayRegistry` (o pagamento guarda o gateway de origem).
  Cartão só por token (o PAN nunca chega à API). Webhooks por gateway, idempotentes e reprocessáveis (`webhook_events`),
  com conferência de valor. Pix expira em 30 min e boleto após o vencimento (o job confirma no gateway antes); pagamento
  tardio é estornado automaticamente; cancelar pedido pago estorna via `RefundService` (idempotente por pedido) e, quando
  todos os pedidos da compra caem, o pagamento vira `Estornado`. `GET /payments/{id}` exige o dono; o PDF do boleto usa
  link assinado. Estoque reservado/devolvido com UPDATE atômico (sem oversell).
- **Repasses**: ledger `payouts` por pedido (bruto − comissão − custo do meio de pagamento), agendado após o prazo de
  retenção; cancelado em estorno.
- **Rastreio**: eventos normalizados (`Domain/Shipping/TrackingCodes.cs`) transitam
  `Enviado → EmTransitoInternacional → Entregue`; provedores por transportadora (`ITrackingProvider`) e webhooks por
  provedor (`ITrackingWebhookParser`); pedidos entregues são concluídos após `AutoCompleteDays` contados da entrega.
- **LGPD**: consentimentos versionados no cadastro (`consents`), `GET /me/data-export` (portabilidade),
  `DELETE /me` (anonimização mantendo pedidos pelo prazo fiscal), trilha de auditoria (`audit_logs`), CPF e documento
  do pagador cifrados em repouso, nomes públicos abreviados ("Gabriel D.").
- **Segurança**: JWT HS256, refresh rotativo com detecção de reuso, rate limit em `/auth/*` e exportação de dados,
  erros sempre em `application/problem+json` (`{ status, code, message, errors, traceId }`), textos da timeline
  em pt-BR/es-PY por `Accept-Language`.

## Painéis

- **Vendedor** (`/seller/*`, papel Vendedor): cadastro da loja com responsável e documentos, perfil, produtos (CRUD +
  fotos + NCM), pedidos (preparar, gerar etiqueta, baixar etiqueta, confirmar postagem), dashboard.
- **Admin** (`/admin/*`, papel Admin): visão geral (totais, vendas por dia, produtos a caminho), usuários (editar/bloquear/anonimizar),
  vendedores (verificar documentos/aprovar/suspender com motivo/reputação), produtos (moderar: aprovar, bloquear, pôr em
  análise), pedidos (transição forçada, disputas), pagamentos (estorno), repasses, cupons, câmbio, banners/categorias,
  configurações da plataforma (tributos e regras de conformidade), conformidade (indicadores e ocorrências),
  denúncias, remessas (etiqueta, situação aduaneira, repasse, reenvio), integrações e auditoria. Admin único criado do `Admin:Email/Password`
  (dev: `admin@mktpy.com` / `admin123`); login alternativo no front em `/admin/entrar`. Detalhes em [`docs/GUIA_BACKEND.txt`](../../docs/GUIA_BACKEND.txt).

## Endpoints além do contrato ✅

`POST /products/{id}/reviews`, `POST /orders/{id}/confirm-receipt`, `GET /payments/{id}/boleto.pdf`,
`POST /auth/reset-password`, `GET/PUT /me/favorites`, `GET/PUT /me/cart`, `GET/POST /me/consents`,
`GET /me/data-export`, `DELETE /me`, `GET /privacy/policy`, `POST /seller/uploads`, `PUT /media/{key}`,
`POST /webhooks/payments/{gateway}`, `POST /webhooks/shipping/{provider}` (aliases: `/webhooks/payments`, `/webhooks/mercadopago`, `/webhooks/shipping`).

Remessa Conforme: `GET /taxes/estimate`, `GET /ncm?q=`, `GET /ncm/{code}`, `POST /products/{id}/reports`,
`POST|GET /seller/orders/{id}/shipment`, `GET /seller/orders/{id}/shipment/label`, `GET /seller/shipping-policy`,
`GET /admin/compliance`,
`GET|POST /admin/compliance/occurrences`, `POST /admin/compliance/occurrences/{id}/status`, `GET /admin/reports`,
`POST /admin/reports/{id}/resolve`, `POST /admin/products/{id}/moderate`, `POST /admin/sellers/{id}/verify`,
`GET /admin/shipments`, `GET /admin/shipments/{id}/label`, `POST /admin/shipments/{id}/retry`, `GET /admin/integrations`.

## Próximos passos

1. Integrações reais: transportadora/agregador em `IShippingRateProvider` + `ITrackingProvider`/`ITrackingWebhookParser`
   (ver `docs/BACKEND_INTEGRATION.md › Como adicionar uma integração`) e provedor de câmbio em `IExchangeRateProvider`.
2. Perguntas e repasses no painel do vendedor (`/seller/questions`, `/seller/payouts`) e notificações (e-mail/WhatsApp)
   de pagamento e envio.
3. Esquema de segurança Bearer e `Produces` nos endpoints `IResult` do OpenAPI para gerar `packages/contracts`
   (`openapi-typescript`).
4. Rodar os jobs numa única instância (lock distribuído) ao escalar horizontalmente.
