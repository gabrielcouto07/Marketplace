import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { SellerPanelShell } from "@/features/seller-panel/components/seller-panel";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Painel do vendedor",
  robots: { index: false, follow: false },
};

export default async function SellerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <SellerPanelShell>{children}</SellerPanelShell>;
}
