import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { StoreShell } from "@/components/layout/store-shell";
import { RegisterView } from "@/features/auth/components/register-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("registerTitle"), robots: { index: false } };
}

export default async function Page() {
  const t = await getTranslations("auth");
  return (
    <StoreShell title={t("registerTitle")} showBack hideSearch>
      <Suspense fallback={null}><RegisterView /></Suspense>
    </StoreShell>
  );
}
