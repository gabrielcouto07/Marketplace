import type { Metadata } from "next";

import { ProductCreateView } from "@/features/seller-panel/components/product-editor-view";

export const metadata: Metadata = { title: "Novo produto" };

export default function NewProductPage() {
  return <ProductCreateView />;
}
