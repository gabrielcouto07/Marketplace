import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Next.js 16: "proxy" substitui "middleware". Trata prefixo de locale e redirecionamentos.
export default createMiddleware(routing);

export const config = {
  // Ignora API, assets do Next, service workers e arquivos estáticos por extensão conhecida. Não exclui
  // "qualquer caminho com ponto": um slug como "galaxy-6.1" é página e precisa passar pelo locale.
  matcher: [
    "/((?!api|_next|_vercel|mockServiceWorker\\.js|sw\\.js|swe-worker|.*\\.(?:ico|png|jpg|jpeg|gif|webp|avif|svg|js|mjs|map|json|webmanifest|txt|xml|woff2?|ttf|css)$).*)",
  ],
};
