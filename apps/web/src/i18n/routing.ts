import { defineRouting } from "next-intl/routing";

export const locales = ["pt-BR", "es-PY"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "pt-BR";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // pt-BR sem prefixo (/produto/x); es-PY com prefixo (/es-PY/produto/x)
  localePrefix: "as-needed",
  localeDetection: false,
});
