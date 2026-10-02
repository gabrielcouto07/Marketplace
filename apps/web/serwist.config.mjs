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
  // Fotos de produto/categoria/banner (~9 MB em WebP) ficam fora do precache: o runtime caching
  // `images` (CacheFirst, 30 dias) guarda só o que o usuário realmente viu.
  // O worker do mock (MSW) não é parte do app e nunca deve ser precacheado pelo SW de produção.
  globIgnores: ["public/images/**", "public/mockServiceWorker.js"],
  // Só a rota /offline entra aqui: arquivos de public/ já são incluídos pelo glob (com hash) e
  // repeti-los sem revision faz o Serwist lançar "conflicting entries" e o SW falha ao registrar.
  additionalPrecacheEntries: [
    { url: "/offline", revision: process.env.SW_REVISION ?? String(Date.now()) },
  ],
  // Páginas prerenderizadas dos painéis (admin, vendedor) e do styleguide não entram no precache: todo visitante
  // da loja baixaria no primeiro acesso HTML que só meia dúzia de pessoas abre. Elas continuam funcionando
  // online (NetworkFirst de navegação) e caem no /offline sem rede.
  // Roda antes do transform do @serwist/next, quando as páginas ainda têm o caminho bruto do build
  // (".next/server/app/pt-BR/admin/cupons.html"), por isso o padrão casa o trecho "<locale>/admin…".
  manifestTransforms: [
    async (entries) => ({
      manifest: entries.filter(
        (entry) => !/(?:^|\/)(?:pt-BR|es-PY)\/(?:admin|vendedor|design)(?:\.html|\/|$)/.test(entry.url),
      ),
    }),
  ],
}));
