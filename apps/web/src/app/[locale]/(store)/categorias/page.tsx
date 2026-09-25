import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { CategoriesView } from "@/features/catalog/components/categories-view";
import type { AppLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: AppLocale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: t("categoriesTitle") };
}

export default async function CategoriesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "catalog" });
  return (
    <StoreShell title={t("categoriesTitle")}>
      <CategoriesView />
    </StoreShell>
  );
}
