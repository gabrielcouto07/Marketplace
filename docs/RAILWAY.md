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

**api — Remessa Conforme** (detalhes e onde obter cada chave em [`REMESSA_CONFORME.md`](REMESSA_CONFORME.md))

```env
# Identidade da empresa (etiqueta e declaração)
RemessaConforme__Platform__LegalName=<razão social>
RemessaConforme__Platform__Document=<CNPJ, só dígitos>
RemessaConforme__Platform__AdeNumber=<número do ADE da Coana>
# Operador logístico (contrato v1)
RemessaConforme__Carrier__Provider=Http
RemessaConforme__Carrier__BaseUrl=https://<api do operador>
RemessaConforme__Carrier__ApiKey=<chave>
# Portal Único Siscomex (perfil EMPRCOMEL); sem BaseUrl usa o ambiente de validação
Siscomex__ClientId=<client id>
Siscomex__ClientSecret=<client secret>
Siscomex__Cnpj=<CNPJ da ECE>
Siscomex__BaseUrl=https://portalunico.siscomex.gov.br
# Serpro Consulta CPF
Serpro__ConsumerKey=<consumer key>
Serpro__ConsumerSecret=<consumer secret>
```

Sem essas variáveis a API sobe normalmente: tabela NCM e PTAX já funcionam (APIs públicas), o operador fica desligado
fora de Development (nenhuma etiqueta é emitida) e o Siscomex/Serpro ficam desligados. Para homologar com etiquetas de
teste use `RemessaConforme__Carrier__AllowSandboxOutsideDevelopment=true`. O painel **Admin › Integrações** mostra o
que falta.

> **Atenção ao publicar sem operador.** Com o operador desligado nenhuma etiqueta é emitida, e com **Envio só com
> etiqueta da plataforma** ligado (padrão) o vendedor também não consegue confirmar o envio. Até contratar o operador,
> desligue essa opção em **Admin › Configurações › Conformidade dos vendedores**: o vendedor volta a informar
> transportadora e rastreio. A migration também passa o cálculo de tributos para o modo Remessa Conforme e o checkout
> passa a exigir o CPF de quem recebe (endereços antigos pedem o CPF na hora).

**web** (usadas no build — mudar exige redeploy)

```env
NEXT_PUBLIC_API_MOCKING=false
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SITE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
API_PROXY_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
# Selo Remessa Conforme: simulacao (prévia com a etiqueta "Simulação") até o ADE; depois true + o número do ADE
NEXT_PUBLIC_REMESSA_CONFORME=simulacao
# NEXT_PUBLIC_REMESSA_CONFORME_ADE=<número>
# NEXT_PUBLIC_REMESSA_CONFORME_SELO=ouro|prata|bronze   (só depois do resultado do ciclo, em dezembro)
# NEXT_PUBLIC_REMESSA_CONFORME_CICLO=2026/2027
```

Gere um domínio público só para o `web` (Settings → Networking → Generate Domain). A API não precisa de domínio
público, exceto para receber webhooks do Mercado Pago (`/api/webhooks/*`) — aí gere um e use-o em
`Payments__MercadoPago__NotificationUrl`.

As migrations rodam na inicialização da API (`Database:InitializeOnStartup`), e o catálogo é semeado com o banco vazio.
