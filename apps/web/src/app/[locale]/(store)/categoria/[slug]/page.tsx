import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { StoreShell } from "@/components/layout/store-shell";
import { SearchView } from "@/features/catalog/components/search-view";
import type { AppLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: AppLocale; slug: string }>;
}

/**
 * Metadata a partir do slug: no servidor o MSW intercepta apenas fetches de SAÍDA,
 * não há endpoint real /api/categories/:slug para consultar. Com o backend .NET,
 * trocar por `await catalogApi.category(slug)` (server-side) para usar o nome oficial.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { title, alternates: { canonical: `/categoria/${slug}` } };
}

/** Header padrão (voltar + pill de busca); o nome da categoria vira o h1 dentro da SearchView. */
export default async function CategoryPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return (
    <StoreShell showBack>
      <Suspense fallback={null}>
        <SearchView fixed={{ categorySlug: slug }} />
      </Suspense>
    </StoreShell>
  );
}
