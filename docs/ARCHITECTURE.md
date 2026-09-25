# Arquitetura do frontend

## Visão geral

```
┌──────────────────────────────────────────────────────────────────────┐
│ Next.js 16 (App Router, Turbopack) — apps/web                         │
│                                                                       │
│  app/[locale]/(store|account|seller|admin)  ← rotas (Server Comps)    │
│        │  renderiza                                                   │
│  features/<dominio>/components              ← UI "use client"         │
│        │  usa hooks                                                   │
│  features/<dominio>/api                     ← TanStack Query hooks    │
│        │  chama                                                       │
│  lib/api/http.ts (fetch wrapper tipado)     ← única porta para a rede │
│        │                                                              │
│  ┌─────▼──────────────┐     ┌──────────────────────────────┐          │
│  │ MSW (dev/mock)     │ ou  │ ASP.NET Core Web API (futuro)│          │
│  │ src/mocks/*        │     │ NEXT_PUBLIC_API_URL          │          │
│  └────────────────────┘     └──────────────────────────────┘          │
│                                                                       │
│  Zustand + persist (localStorage): carrinho, favoritos, sessão        │
│  Serwist (service worker): app shell, catálogo SWR, imagens, offline  │
└──────────────────────────────────────────────────────────────────────┘
```

## Monorepo

```
marketplace-py/
├─ apps/web/                 Next.js (este projeto)
├─ apps/api/                 reservado ao ASP.NET Core (README com sugestão de estrutura)
├─ packages/contracts/       DTOs TypeScript (@marketplace/contracts) — espelho do contrato REST
├─ docs/                     esta documentação
├─ pnpm-workspace.yaml       workspaces + allowBuilds (sharp, msw, esbuild, swc…)
└─ package.json              scripts agregados (dev/build/lint/typecheck/format)
```

`@marketplace/contracts` é consumido como TypeScript puro (`transpilePackages` no `next.config.ts`).
Quando o backend .NET existir, o ideal é **gerar** este pacote a partir do OpenAPI (ex.: `openapi-typescript`) e manter
o arquivo manual apenas como referência.

## Estrutura de `apps/web/src`

| Pasta | Responsabilidade |
| --- | --- |
| `app/[locale]/(store)` | vitrine e fluxo de compra: home, busca, categoria, produto, loja, carrinho, checkout, pagamento, confirmação, favoritos, instalar, offline |
| `app/[locale]/(account)` | login, cadastro, recuperar senha, conta, perfil, endereços, pedidos |
| `app/[locale]/(seller)` | painel do vendedor (esqueleto) |
| `app/[locale]/(admin)` | painel admin (esqueleto) |
| `app/manifest.ts`, `robots.ts`, `sitemap.ts` | metadados PWA/SEO (Metadata Routes) |
| `features/<dominio>/{api,components,store}` | catalog, cart, checkout, orders, payments, auth, account, seller, shipping, home |
| `components/ui` | shadcn/ui (estilo *base-nova*, primitivos **Base UI**) |
| `components/layout` | Header, BottomNav, TricolorStripe, InstallPrompt, OfflineBanner, StoreShell, Providers, PwaProvider |
| `components/shared` | ProductCard, PriceTag, RatingStars, SellerBadge, QuantityStepper, OrderTimeline, estados vazios/erro… |
| `lib/api` | `http.ts` (fetch wrapper), `errors.ts`, `query-client.tsx`, `query-keys.ts` |
| `lib/money` | operações e formatação monetária (inteiros) |
| `lib/validation` | CPF/RUC/CEP + schemas Zod |
| `i18n` | routing (`pt-BR` padrão sem prefixo, `es-PY` com prefixo), `request.ts`, `navigation.ts`, mensagens |
| `mocks` | fixtures determinísticas, handlers MSW, "db" em memória + localStorage |
| `sw.ts` | service worker (Serwist) |
| `proxy.ts` | (antigo middleware) roteamento de locale via next-intl |
| `instrumentation.ts` | registra MSW no runtime Node quando `NEXT_PUBLIC_API_MOCKING=true` |

## Regras da camada de dados

1. **Componentes nunca chamam `fetch`.** A regra ESLint `no-restricted-globals` bloqueia `fetch` fora de `lib/api`, `mocks` e `sw.ts`.
2. Cada domínio expõe um objeto `xxxApi` (funções puras que conhecem as rotas) e hooks TanStack Query
   (`useProduct`, `useOrders`, …). Trocar o backend = trocar `NEXT_PUBLIC_API_URL` e desligar o mock.
3. `http<T>()` lança `ApiError` (HTTP ≠ 2xx, com `status/code/errors`) ou `NetworkError` (offline). O `QueryClient`
   não faz retry em 4xx e faz até 2 tentativas em 5xx/rede.
4. Chaves de query centralizadas em `lib/api/query-keys.ts` (`[dominio, recurso, params]`).
5. Estado **do servidor** vive no React Query; estado **do cliente** (carrinho, favoritos, sessão) em Zustand com
   `persist` (localStorage) — funciona offline e sobrevive a reloads.

## Renderização

- Páginas são Server Components finos (metadata + `setRequestLocale`) que renderizam um componente `*-view.tsx`
  client. O conteúdo dinâmico é buscado no cliente porque o mock (MSW) intercepta apenas no navegador — no SSR os
  componentes mostram skeletons. Com a API real, é possível fazer prefetch no servidor com `HydrationBoundary`
  usando as `queryOptions` já exportadas (ex.: `productQuery(slug)`).
- `generateMetadata` usa dados estáticos (slug) por causa do mock; ver comentário nas páginas. Com a API real, use
  `fetch` server-side (o `http()` já monta URL absoluta no servidor via `NEXT_PUBLIC_SITE_URL`).
- Rotas dinâmicas usam `params: Promise<…>` (Next 15+/16).

## Decisões relevantes

| Decisão | Motivo |
| --- | --- |
| Next 16 + Turbopack | versão estável mais recente; build rápido |
| shadcn/ui v4 (Base UI) | acessibilidade out-of-the-box; **não existe `asChild`** — usar `render={<Link/>}` |
| Serwist via CLI (`serwist build`) | o plugin webpack não roda com Turbopack; a CLI gera `public/sw.js` a partir de `src/sw.ts` (ver `PWA.md`) |
| MSW no browser + Node | mesma fixture no cliente e no servidor (`instrumentation.ts`) |
| Money como inteiro + fração exata para câmbio | evita float em dinheiro; espelha `long`/`decimal` no .NET |
| Carrinho por vendedor, um pedido por loja, um pagamento por compra | modelo Mercado Livre; simplifica frete/rastreio por origem e o split de pagamento |
| Rotas em português sem prefixo (`/produto/[slug]`) e `/es-PY/...` | SEO no Brasil (mercado principal); espanhol para vendedores |
| Porta de dev **3210** | 3000/3100 já estavam em uso na máquina de desenvolvimento |

## Fluxo do comprador (ponta a ponta com mock)

1. Home → categoria/busca (filtros em bottom sheet) → produto (variações, CEP, avaliações, perguntas).
2. Adicionar ao carrinho (persistido offline, agrupado por loja).
3. Checkout: endereço → frete por loja → pagamento (Pix/boleto/cartão) → resumo com impostos estimados e câmbio travado.
4. `POST /orders` → página de pagamento (QR Pix/boleto; polling; "simular aprovação").
5. Confirmação → Meus pedidos → detalhe com timeline e rastreio.
