import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { InstallView } from "@/features/account/components/install-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pwa.installPage");
  return { title: t("title"), description: t("intro") };
}

export default async function InstallPage() {
  const t = await getTranslations("pwa.installPage");
  return (
    <StoreShell title={t("title")} showBack hideSearch>
      <InstallView />
    </StoreShell>
  );
}
