# Deploy no Railway

Três serviços no mesmo projeto/ambiente: **Postgres** (plugin do Railway), **api** (`apps/api`) e **web** (`apps/web`).
O navegador só fala com o `web`; o Next encaminha `/api/*` para a API pela rede privada (mesma origem, sem CORS, e o
cookie httpOnly do refresh token funciona).

## Serviços

| Serviço | Root Directory | Config file | Volume |
| --- | --- | --- | --- |
| Postgres | — (Database → PostgreSQL) | — | automático |
| api | `/apps/api` | `/apps/api/railway.json` | **`/app/.data`** (chaves do DataProtection + imagens) |
| web | `/` | `/apps/web/railway.json` | — |

O volume da API é obrigatório: sem ele as chaves que cifram CPF/documento do pagador somem a cada deploy.

## Variáveis

**api**

```env
PORT=8080
ConnectionStrings__Postgres=Host=${{Postgres.PGHOST}};Port=${{Postgres.PGPORT}};Database=${{Postgres.PGDATABASE}};Username=${{Postgres.PGUSER}};Password=${{Postgres.PGPASSWORD}}
Auth__Jwt__Secret=<64+ caracteres aleatórios>
Links__SiteUrl=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
Links__ApiUrl=https://${{web.RAILWAY_PUBLIC_DOMAIN}}/api
Cors__Origins__0=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
Payments__Provider=MercadoPago
Payments__MercadoPago__AccessToken=<APP_USR-...>
Payments__MercadoPago__WebhookSecret=<segredo do painel de webhooks>
Payments__MercadoPago__NotificationUrl=https://<domínio público da api>/api/webhooks/payments/mercadopago
Tracking__WebhookSecret=<aleatório>
```

`Payments__Provider=Fake` é recusado fora de Development (a API não sobe); para um ambiente de homologação sem
dinheiro real use `Payments__AllowFakeOutsideDevelopment=true` e `Payments__Fake__WebhookSecret=<aleatório>`.

**web** (usadas no build — mudar exige redeploy)

```env
NEXT_PUBLIC_API_MOCKING=false
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SITE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
API_PROXY_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
```

Gere um domínio público só para o `web` (Settings → Networking → Generate Domain). A API não precisa de domínio
público, exceto para receber webhooks do Mercado Pago (`/api/webhooks/*`) — aí gere um e use-o em
`Payments__MercadoPago__NotificationUrl`.

As migrations rodam na inicialização da API (`Database:InitializeOnStartup`), e o catálogo é semeado com o banco vazio.
