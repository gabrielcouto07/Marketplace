import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { AddressesView } from "@/features/account/components/addresses-view";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("addressesTitle"), robots: { index: false } };
}

export default async function Page({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  return (
    <StoreShell title={t("addressesTitle")} showBack hideSearch>
      <AddressesView />
    </StoreShell>
  );
}
