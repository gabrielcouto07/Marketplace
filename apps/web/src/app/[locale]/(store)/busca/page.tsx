import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { StoreShell } from "@/components/layout/store-shell";
import { SearchView } from "@/features/catalog/components/search-view";
import type { AppLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ locale }, { q }] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: "catalog" });
  return { title: q ? t("resultsFor", { query: q }) : t("searchTitle"), robots: { index: false } };
}

export default async function SearchPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <StoreShell hideMobileBar>
      <Suspense fallback={null}>
        <SearchView />
      </Suspense>
    </StoreShell>
  );
}
