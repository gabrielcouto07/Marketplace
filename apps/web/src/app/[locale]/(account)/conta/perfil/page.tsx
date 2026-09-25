import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { ProfileView } from "@/features/account/components/profile-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("profileTitle"), robots: { index: false } };
}

export default async function Page() {
  const t = await getTranslations("account");
  return (
    <StoreShell title={t("profileTitle")} showBack hideSearch>
      <ProfileView />
    </StoreShell>
  );
}
