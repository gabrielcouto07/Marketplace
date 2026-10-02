import { SellerDashboard } from "@/features/seller-panel/components/seller-panel";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export default async function SellerDashboardPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SellerDashboard />;
}
