import type messages from "./i18n/messages/pt-BR.json";
import type { routing } from "./i18n/routing";

// Tipagem forte para useTranslations / Link (next-intl v4).
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
