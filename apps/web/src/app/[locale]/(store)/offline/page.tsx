import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { OfflineContent } from "@/features/home/components/offline-content";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("errors");
  return { title: t("offlinePageTitle"), robots: { index: false } };
}

/** Fallback de navegação do service worker (precacheado). */
export default async function OfflinePage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <StoreShell>
      <OfflineContent />
    </StoreShell>
  );
}
