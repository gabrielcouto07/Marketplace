/**
 * Variáveis públicas com defaults seguros:
 *  - `siteUrl` cai na URL da Vercel (produção ou preview) quando NEXT_PUBLIC_SITE_URL não é definida;
 *  - o mock (MSW) vem de NEXT_PUBLIC_API_MOCKING (ver .env.production para o deploy sem backend).
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;
  return "http://localhost:3210";
}

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  apiMocking: process.env.NEXT_PUBLIC_API_MOCKING === "true",
  siteUrl: resolveSiteUrl(),
  isDev: process.env.NODE_ENV === "development",
} as const;
