import type { Metadata } from "next";

import { ProductCreateView } from "@/features/seller-panel/components/product-editor-view";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProductPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProductCreateView />;
}
