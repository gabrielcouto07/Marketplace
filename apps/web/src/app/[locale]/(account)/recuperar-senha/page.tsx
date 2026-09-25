import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { ForgotPasswordView } from "@/features/auth/components/forgot-password-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("forgotTitle"), robots: { index: false } };
}

export default function Page() {
  return (
    <StoreShell showBack hideSearch hideBottomNav>
      <ForgotPasswordView />
    </StoreShell>
  );
}
