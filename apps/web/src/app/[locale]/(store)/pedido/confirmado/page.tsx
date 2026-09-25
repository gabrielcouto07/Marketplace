import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { StoreShell } from "@/components/layout/store-shell";
import { ConfirmationView } from "@/features/orders/components/confirmation-view";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "orders" });
  return { title: t("confirmationTitle"), robots: { index: false } };
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <StoreShell hideSearch>
      <Suspense fallback={null}>
        <ConfirmationView />
      </Suspense>
    </StoreShell>
  );
}
