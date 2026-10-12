import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { SellerPolicyView } from "@/features/compliance/components/seller-policy-view";
import type { AppLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: AppLocale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "sellerPolicy" });
  return { title: t("title"), description: t("intro") };
}

/** Política de Admissão e de Monitoramento de Vendedores, disponível a qualquer pessoa (itens 2.3 e 2.4). */
export default async function SellerPolicyPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "sellerPolicy" });
  return (
    <StoreShell title={t("title")} showBack>
      <SellerPolicyView />
    </StoreShell>
  );
}
