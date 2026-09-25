import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { DesignView } from "@/features/design/components/design-view";
import type { AppLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: AppLocale }>;
}

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

/** Styleguide vivo (interno, pt-BR). Ver DESIGN.md. */
export default async function DesignPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <StoreShell title="Design system" showBack hideBottomNav>
      <DesignView />
    </StoreShell>
  );
}
