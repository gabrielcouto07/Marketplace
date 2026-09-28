import type { Metadata } from "next";

import { SellerRegisterView } from "@/features/seller-panel/components/seller-register-view";

export const metadata: Metadata = { title: "Vender no marketplace" };

export default function SellerRegisterPage() {
  return <SellerRegisterView />;
}
