import type { Metadata } from "next";

import { AdminLoginView } from "@/features/admin/components/admin-login-view";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { title: "Acesso administrativo", robots: { index: false, follow: false } };

export default async function AdminLoginPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminLoginView />;
}
