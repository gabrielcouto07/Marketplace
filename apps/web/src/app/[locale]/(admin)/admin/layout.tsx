import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminPanelShell } from "@/features/admin/components/admin-panel";

export const metadata: Metadata = {
  title: "Administração",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminPanelShell>{children}</AdminPanelShell>;
}
