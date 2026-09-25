import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { StoreShell } from "@/components/layout/store-shell";
import { LoginView } from "@/features/auth/components/login-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("loginTitle"), robots: { index: false } };
}

export default function Page() {
  return (
    <StoreShell showBack hideSearch hideBottomNav>
      <Suspense fallback={null}>
        <LoginView />
      </Suspense>
    </StoreShell>
  );
}
