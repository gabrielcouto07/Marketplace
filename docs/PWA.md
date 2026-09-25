# PWA (Progressive Web App)

Sem publicação em lojas: instalação via "Adicionar à tela inicial". Requisitos atendidos: manifest, service worker
com estratégias de cache, fallback offline, carrinho offline, prompt de instalação customizado, safe-area.

## Manifest — `src/app/manifest.ts` → `/manifest.webmanifest`

`name` "Marketplace Paraguai", `short_name` "MktPY", `display: standalone`, `theme_color #0038A8`,
`background_color #FFFFFF`, `start_url /?source=pwa`, ícones 192/512 + **maskable** 192/512 (`public/icons`),
atalhos (Buscar, Carrinho, Meus pedidos), screenshot 1200×630. Referenciado no `<head>` pelo `metadata.manifest` do
layout raiz; `appleWebApp` + `apple-touch-icon` para iOS; `viewport-fit=cover`.

## Service worker — Serwist

- Fonte: `src/sw.ts` (TypeScript). Build: **`serwist build serwist.config.mjs`** (CLI, compatível com Turbopack —
  o plugin `withSerwist` de webpack não se aplica ao Next 16 com Turbopack).
  - `pnpm dev` → `predev` gera `public/sw.js` sem manifest de precache (apenas runtime caching);
  - `pnpm build` → `next build && serwist build …` injeta o precache de `.next/static` + páginas prerenderizadas
    (`@serwist/next/config` monta `globPatterns`/`manifestTransforms` a partir do `next.config.ts`).
- Registro: `SerwistProvider` (`@serwist/next/react`) em `components/layout/pwa-provider.tsx`, `swUrl="/sw.js"`,
  `cacheOnNavigation`. **Em desenvolvimento o SW fica desabilitado** (`disable` quando `NODE_ENV=development`) para
  não interferir no HMR/MSW; para testar em dev: `NEXT_PUBLIC_SW_DEV=true`.
- Header `Cache-Control: max-age=0, must-revalidate` e `Service-Worker-Allowed: /` para `/sw.js` (`next.config.ts`).
- `public/sw.js` e `swe-worker-*.js` estão no `.gitignore` (artefatos de build).

### Estratégias de cache (`src/sw.ts`)

| Alvo                                                                            | Estratégia                                           | Limites                           |
| ------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------- |
| App shell (`/_next/static/*`, páginas prerenderizadas, `/offline`, logo, ícone) | **Precache** (injetado no build)                     | revisão por hash                  |
| `GET /api/{home,categories,products,sellers,exchange-rates}`                    | **StaleWhileRevalidate** (`api-catalog`)             | 200 entradas, 1 h                 |
| `GET /api/{orders,payments,purchases,me,checkout,auth,shipping,postal-codes}`   | **NetworkFirst** (`api-transactional`, timeout 10 s) | 50 entradas, 5 min                |
| Imagens (`/images/*`, `/icons/*`, `/_next/image`, `destination: image`)         | **CacheFirst** (`images`)                            | 300 entradas, 30 dias (last-used) |
| Demais (`defaultCache` do Serwist: fontes, JS, CSS, RSC payloads)               | padrões do `@serwist/next/worker`                    |                                   |
| Navegações `document` que falham                                                | **fallback `/offline`**                              | página precacheada                |

`skipWaiting` + `clientsClaim` = atualizações imediatas; `navigationPreload` acelera a primeira navegação.

> Nota: o MSW também registra um service worker (`/mockServiceWorker.js`). Em dev, apenas ele fica ativo; em
> produção sem mock, apenas o Serwist. Se precisar dos dois ao mesmo tempo (`NEXT_PUBLIC_SW_DEV=true` +
> mock), o MSW deve ser iniciado depois e ambos convivem em escopos distintos — cenário apenas para testes.

## Offline

- **Carrinho, favoritos e sessão** vivem em `localStorage` via Zustand `persist` — funcionam sem rede.
- `OfflineBanner` (evento `online/offline`) avisa que o conteúdo é o salvo; `ErrorState` detecta `NetworkError`.
- React Query mantém cache em memória (`gcTime` 24 h); páginas já visitadas continuam navegáveis.
- Rota `/offline` (`(store)/offline/page.tsx`) é o fallback de navegação, com ações "Recarregar" e "Ir ao carrinho".

## Prompt de instalação — `components/layout/install-prompt.tsx`

- **Android/Chrome**: `beforeinstallprompt` é capturado no `PwaProvider` (`canPrompt`); o banner customizado chama
  `promptInstall()`; `appinstalled` esconde o banner.
- **iOS**: sem evento; o banner mostra a instrução "Compartilhar → Adicionar à Tela de Início" e a página
  `/instalar` detalha os passos (Android, iOS, desktop).
- Aparece após 8 s, não aparece em `display-mode: standalone`, "Agora não" silencia por 7 dias
  (`localStorage["mktpy.install.dismissedAt"]`).

## Checklist para produção

1. `pnpm build` (gera `public/sw.js` com precache) e `pnpm start`.
2. Servir em HTTPS (Cloudflare) — obrigatório para SW e instalação.
3. Validar no Lighthouse: manifest, ícones maskable, SW com fetch handler, offline `/offline` respondendo.
4. Trocar `public/logo.svg` pela logo oficial e rodar `pnpm icons`.
