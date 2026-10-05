import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { RemessaConformeView } from "@/features/compliance/components/remessa-conforme-view";
import type { AppLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: AppLocale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "remessaConformePage" });
  return { title: t("title"), description: t("intro") };
}

/** Como funcionam os impostos no Remessa Conforme (destino do selo do header). */
export default async function RemessaConformePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "remessaConformePage" });
  return (
    <StoreShell title={t("title")} showBack>
      <RemessaConformeView />
    </StoreShell>
  );
}
