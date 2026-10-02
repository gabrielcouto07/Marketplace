import type { Metadata } from "next";

import { ProductEditView } from "@/features/seller-panel/components/product-editor-view";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string; locale: AppLocale }> }) {
  const { id, locale } = await params;
  setRequestLocale(locale);
  return <ProductEditView productId={id} />;
}
