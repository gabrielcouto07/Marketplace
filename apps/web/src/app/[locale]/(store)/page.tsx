import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { HomeView } from "@/features/home/components/home-view";
import type { AppLocale } from "@/i18n/routing";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return { title: { absolute: `${site.name} — ${t("siteDescription").split(":")[0]}` }, description: t("siteDescription") };
}

export default async function HomePage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <StoreShell>
      <HomeView />
    </StoreShell>
  );
}
