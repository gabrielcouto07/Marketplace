import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { InstallView } from "@/features/account/components/install-view";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pwa.installPage");
  return { title: t("title"), description: t("intro") };
}

export default async function InstallPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("pwa.installPage");
  return (
    <StoreShell title={t("title")} showBack hideSearch>
      <InstallView />
    </StoreShell>
  );
}
