import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SellerPanelShell } from "@/features/seller-panel/components/seller-panel";

export const metadata: Metadata = {
  title: "Painel do vendedor",
  robots: { index: false, follow: false },
};

export default function SellerLayout({ children }: { children: ReactNode }) {
  return <SellerPanelShell>{children}</SellerPanelShell>;
}
