import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { PublicReportView } from "@/features/compliance/components/public-report-view";
import type { AppLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ produto?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "publicReport" });
  return { title: t("title"), description: t("intro") };
}

/**
 * Canal de denúncias aberto a qualquer pessoa, cadastrada ou não (Política de Vendedores 6.4): oferta de produto de
 * origem ilícita, contrafeito ou que infrinja propriedade intelectual. `?produto=` pré-preenche o anúncio.
 */
export default async function PublicReportPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { produto } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "publicReport" });
  return (
    <StoreShell title={t("title")} showBack>
      <PublicReportView initialProduct={produto ?? ""} />
    </StoreShell>
  );
}
