/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Estratégias (ver docs/PWA.md):
 *  - App shell / rotas prerenderizadas: precache (injetado em build).
 *  - /api/* catálogo com preço e estoque (home, produtos, lojas): NetworkFirst (3 s) com cache de 10 min só
 *    para offline — StaleWhileRevalidate mostraria preço/estoque velhos depois de uma edição do vendedor.
 *  - /api/* catálogo estável (categorias, câmbio): StaleWhileRevalidate, 1 h.
 *  - /api/* transacional (orders, payments, me, checkout): NetworkFirst, cache curto, nunca com Authorization
 *    de outra pessoa (limpo no logout via mensagem CLEAR_API_CACHES).
 *  - Imagens (/images, /_next/image, /icons): CacheFirst, 30 dias, 300 entradas.
 *  - Navegações: NetworkFirst com fallback para /offline.
 */
const LIVE_CATALOG_API = /\/api\/(home|products|sellers)(\/|\?|$)/;
const STABLE_CATALOG_API = /\/api\/(categories|exchange-rates)(\/|\?|$)/;
const TRANSACTIONAL_API =
  /\/api\/(orders|payments|purchases|me|checkout|auth|shipping|postal-codes|seller|admin)(\/|\?|$)/;
const API_CACHES = ["api-catalog", "api-catalog-stable", "api-transactional", "apis"];

/** Painéis e rotas privadas (seller/admin/me) nunca entram no cache: trocar de usuário no mesmo aparelho não pode mostrar dados do anterior. */
const PRIVATE_API = /\/api\/(seller|admin|me)(\/|\?|$)/;
const skipPrivate = {
  cacheWillUpdate: async ({ request, response }: { request: Request; response: Response }) =>
    PRIVATE_API.test(new URL(request.url).pathname) || request.headers.has("Authorization")
      ? null
      : response,
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, url }) =>
        request.method === "GET" && LIVE_CATALOG_API.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "api-catalog",
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 10 * 60 })],
      }),
    },
    {
      matcher: ({ request, url }) =>
        request.method === "GET" && STABLE_CATALOG_API.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: "api-catalog-stable",
        plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 })],
      }),
    },
    {
      matcher: ({ request, url }) =>
        request.method === "GET" && TRANSACTIONAL_API.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "api-transactional",
        networkTimeoutSeconds: 10,
        plugins: [skipPrivate, new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 })],
      }),
    },
    {
      matcher: ({ request, url }) =>
        request.destination === "image" ||
        url.pathname.startsWith("/images/") ||
        url.pathname.startsWith("/icons/") ||
        url.pathname.startsWith("/_next/image"),
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 300,
            maxAgeSeconds: 30 * 24 * 60 * 60,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Logout: a aba pede para esquecer tudo que veio da API (pedidos, endereços, painéis) antes que outra
// pessoa use o mesmo aparelho.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_API_CACHES") return;
  event.waitUntil(Promise.all(API_CACHES.map((name) => caches.delete(name))));
});
