# Integração com o backend ASP.NET Core

Roteiro para trocar o mock pela API real sem alterar componentes.

## 1. Configuração

```env
NEXT_PUBLIC_API_URL=https://api.seudominio.com/api   # base absoluta (CORS liberado para o domínio do front)
NEXT_PUBLIC_API_MOCKING=false                        # desliga MSW (browser e Node)
NEXT_PUBLIC_SITE_URL=https://www.seudominio.com
```

Com o mock desligado, `MockProvider` não bloqueia a renderização e `instrumentation.ts` não registra o MSW.

## 2. Contrato

- Implemente os endpoints de `apps/web/API_CONTRACTS.md` (seção ✅ primeiro). Mantenha camelCase, GUIDs, ISO 8601,
  `Money` como inteiro e enums como string.
- Exponha OpenAPI (Swashbuckle/NSwag) e gere tipos: `pnpm dlx openapi-typescript https://api/.../swagger/v1/swagger.json -o packages/contracts/src/generated.ts`.
  Compare com `index.ts` e migre gradualmente.
- Erros: use `ProblemDetails` com as propriedades extras `code` e `errors` (dicionário campo → mensagens) para
  casar com `ApiErrorDto`. Ex.:
  ```csharp
  return ValidationProblem(new ValidationProblemDetails(ModelState) { Extensions = { ["code"] = "VALIDATION_ERROR" } });
  ```

## 3. Autenticação

- JWT Bearer. O front envia `Authorization: Bearer <accessToken>` (`lib/api/http.ts`).
- Recomendado: `refreshToken` em cookie `HttpOnly; Secure; SameSite=Lax` e `POST /auth/refresh` lendo o cookie.
  Ajuste `useAuthStore` para não persistir o refresh token nesse caso.
- Google: front obtém `idToken` via Google Identity Services (`google.accounts.id`) e chama `POST /auth/google`.
  Substituir `useGoogleLogin` (hoje envia token mock).
- Interceptar 401 em `http()` para tentar refresh uma vez e repetir a requisição (TODO marcado no client).

## 4. Pagamentos (gateway com split)

- Cartão: tokenizar no navegador com o SDK do PSP (Pagar.me/Asaas/Mercado Pago…) e enviar `card.token`; nunca o PAN.
- Pix/boleto: o backend cria a cobrança e devolve `PaymentDto` (`qrCodePayload`, `digitableLine`, `pdfUrl`).
- Webhooks do PSP → backend atualiza `payments.status` e transita os pedidos (`Pago`). O front continua com polling
  em `GET /payments/{id}` (ou migrar para SSE).
- Split por vendedor calculado no backend com a taxa travada (`exchangeRateId`); repasses em `/seller/payouts`.
- Remover o handler `POST /payments/{id}/simulate-approval` da UI (`useSimulatePaymentApproval`) ou protegê-lo por
  `NODE_ENV !== "production"`.

## 5. Frete, CEP e rastreio

- `GET /postal-codes/{cep}` → proxy para ViaCEP/BrasilAPI com cache (Redis/memória).
- `POST /shipping/quotes` → tabela própria por região/peso ou API de courier; resposta sempre com faixa de dias úteis.
- Rastreio: job periódico consulta a transportadora, grava `order_events`/`trackingEvents` e transita status.

## 6. Imagens (Cloudflare R2)

- Upload pelo painel do vendedor via URL pré-assinada (`POST /seller/uploads`).
- Adicione o hostname público do bucket em `next.config.ts` → `images.remotePatterns` (já há um placeholder
  `*.r2.dev`). Como as imagens reais serão raster, `dangerouslyAllowSVG` pode ser desligado.

## 7. Prefetch no servidor (opcional, melhora SEO/LCP)

Com a API real acessível do servidor Next, as páginas podem pré-carregar dados:

```tsx
const queryClient = getQueryClient();
await queryClient.prefetchQuery(productQuery(slug));
return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <ProductView slug={slug} />
  </HydrationBoundary>
);
```

e `generateMetadata` pode chamar `catalogApi.product(slug)` para título/descrição/OG reais.
`sitemap.ts` deve listar produtos/categorias/lojas a partir da API.

## 8. Cache e CDN (Cloudflare)

- Respostas de catálogo com `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` e `ETag`.
- Transacionais com `no-store`.
- Imagens com `immutable` (nomes com hash).

## 9. Checklist de migração

- [ ] `NEXT_PUBLIC_API_MOCKING=false` e URL da API
- [ ] CORS + HTTPS
- [ ] Endpoints ✅ implementados e testados com os DTOs
- [ ] JWT + refresh
- [ ] Gateway de pagamento + webhooks
- [ ] Remover/proteger endpoints "somente mock"
- [ ] `pnpm build && pnpm start` com Lighthouse PWA verde
- [ ] Trocar logo (`public/logo.svg`) e rodar `pnpm icons`
