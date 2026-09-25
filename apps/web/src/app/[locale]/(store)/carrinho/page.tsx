import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { CartView } from "@/features/cart/components/cart-view";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cart" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CartPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "cart" });
  return (
    <StoreShell title={t("title")} showBack>
      <CartView />
    </StoreShell>
  );
}
