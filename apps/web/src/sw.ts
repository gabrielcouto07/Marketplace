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
 *  - /api/* catálogo (GET): StaleWhileRevalidate, 1 h, 200 entradas.
 *  - /api/* transacional (orders, payments, me, checkout): NetworkFirst, cache curto.
 *  - Imagens (/images, /_next/image, /icons): CacheFirst, 30 dias, 300 entradas.
 *  - Navegações: NetworkFirst com fallback para /offline.
 */
const CATALOG_API = /\/api\/(home|categories|products|sellers|exchange-rates)(\/|\?|$)/;
const TRANSACTIONAL_API = /\/api\/(orders|payments|purchases|me|checkout|auth|shipping|postal-codes)(\/|\?|$)/;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, url }) => request.method === "GET" && CATALOG_API.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: "api-catalog",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 })],
      }),
    },
    {
      matcher: ({ request, url }) => request.method === "GET" && TRANSACTIONAL_API.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: "api-transactional",
        networkTimeoutSeconds: 10,
        plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 })],
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
          new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60, maxAgeFrom: "last-used" }),
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
