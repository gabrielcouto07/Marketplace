import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pacote de contratos do monorepo é consumido como TS puro.
  transpilePackages: ["@marketplace/contracts"],
  images: {
    // Placeholders locais são SVG; permite otimização de SVG apenas com CSP restritiva.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // Futuro: Cloudflare R2 (imagens de produto) — ajuste o hostname.
      { protocol: "https", hostname: "*.r2.dev" },
      { protocol: "https", hostname: "cdn.marketplacepy.com" },
    ],
  },
  headers: async () => [
    {
      // O service worker precisa de escopo raiz e não pode ser cacheado agressivamente.
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
  ],
};

export default withNextIntl(nextConfig);
