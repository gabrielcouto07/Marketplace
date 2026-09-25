import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { OfflineContent } from "@/features/home/components/offline-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("errors");
  return { title: t("offlinePageTitle"), robots: { index: false } };
}

/** Fallback de navegação do service worker (precacheado). */
export default function OfflinePage() {
  return (
    <StoreShell>
      <OfflineContent />
    </StoreShell>
  );
}
