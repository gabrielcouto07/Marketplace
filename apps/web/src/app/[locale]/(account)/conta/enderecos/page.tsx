import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { AddressesView } from "@/features/account/components/addresses-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("addressesTitle"), robots: { index: false } };
}

export default async function Page() {
  const t = await getTranslations("account");
  return (
    <StoreShell title={t("addressesTitle")} showBack hideSearch>
      <AddressesView />
    </StoreShell>
  );
}
