import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

// Next.js 16: "proxy" substitui "middleware". Trata prefixo de locale e redirecionamentos.
export default createMiddleware(routing);

export const config = {
  // Ignora API, assets do Next, arquivos estáticos (qualquer caminho com ".") e os service workers.
  matcher: ["/((?!api|_next|_vercel|mockServiceWorker\\.js|sw\\.js|.*\\..*).*)"],
};
