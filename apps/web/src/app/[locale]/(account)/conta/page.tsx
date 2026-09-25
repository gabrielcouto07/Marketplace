import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { AccountView } from "@/features/account/components/account-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("title"), robots: { index: false } };
}

export default async function AccountPage() {
  return (
    <StoreShell hideSearch>
      <AccountView />
    </StoreShell>
  );
}
