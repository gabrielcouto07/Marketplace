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
  // Só a rota /offline entra aqui: arquivos de public/ já são incluídos pelo glob (com hash) e
  // repeti-los sem revision faz o Serwist lançar "conflicting entries" e o SW falha ao registrar.
  additionalPrecacheEntries: [
    { url: "/offline", revision: process.env.SW_REVISION ?? String(Date.now()) },
  ],
}));
