import type { Metadata } from "next";

import { AdminLoginView } from "@/features/admin/components/admin-login-view";

export const metadata: Metadata = { title: "Acesso administrativo", robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return <AdminLoginView />;
}
