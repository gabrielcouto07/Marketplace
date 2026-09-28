import type { Metadata } from "next";

import { ProductEditView } from "@/features/seller-panel/components/product-editor-view";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductEditView productId={id} />;
}
