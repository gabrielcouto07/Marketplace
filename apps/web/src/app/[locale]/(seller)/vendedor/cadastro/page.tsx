import type { Metadata } from "next";

import { SellerRegisterView } from "@/features/seller-panel/components/seller-register-view";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { title: "Vender no marketplace" };

export default async function SellerRegisterPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SellerRegisterView />;
}
