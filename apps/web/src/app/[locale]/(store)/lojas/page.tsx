import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { StoreShell } from "@/components/layout/store-shell";
import { StoresView } from "@/features/seller/components/stores-view";
import type { AppLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: AppLocale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seller" });
  return { title: t("storesTitle") };
}

export default async function StoresPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "seller" });
  return (
    <StoreShell title={t("storesTitle")} showBack>
      <Suspense fallback={null}>
        <StoresView />
      </Suspense>
    </StoreShell>
  );
}
