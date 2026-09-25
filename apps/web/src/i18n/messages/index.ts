import type { AppLocale } from "../routing";

/**
 * Um arquivo JSON por locale, organizado por namespace (common, nav, catalog, ...).
 * Carregado sob demanda no servidor (request.ts) e enviado ao cliente pelo NextIntlClientProvider.
 */
export async function loadMessages(locale: AppLocale) {
  switch (locale) {
    case "es-PY":
      return (await import("./es-PY.json")).default;
    case "pt-BR":
    default:
      return (await import("./pt-BR.json")).default;
  }
}
