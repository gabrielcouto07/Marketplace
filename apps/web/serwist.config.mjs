// @ts-check
import { serwist } from "@serwist/next/config";

/**
 * Build do service worker via CLI (compatível com Turbopack):
 *   serwist build serwist.config.mjs → gera public/sw.js
 * - `pnpm build`: roda após `next build`, injetando o manifest de precache (.next/static + páginas prerenderizadas).
 * - `pnpm dev`: `predev` roda o mesmo comando sem manifest (só runtime caching).
 */
export default serwist.withNextConfig(() => ({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  globDirectory: ".",
  additionalPrecacheEntries: [
    { url: "/offline", revision: process.env.SW_REVISION ?? String(Date.now()) },
    { url: "/logo.svg", revision: null },
    { url: "/icons/icon-192.png", revision: null },
  ],
}));
