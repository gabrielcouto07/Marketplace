import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { ProductView } from "@/features/catalog/components/product-view";
import type { AppLocale } from "@/i18n/routing";
import { site } from "@/lib/site";

interface PageProps {
  params: Promise<{ locale: AppLocale; slug: string }>;
}

/**
 * Metadata derivada do slug. No servidor o MSW só intercepta fetches de SAÍDA e não existe
 * endpoint real; com o backend .NET, buscar `catalogApi.product(slug)` aqui para usar
 * nome, descrição e imagem reais no Open Graph.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = slug
    .replace(/-[a-z]{3}\d+$/, "")
    .replace(/-/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
  return {
    title,
    alternates: { canonical: `/produto/${slug}` },
    openGraph: { title: `${title} | ${site.name}`, type: "website", images: [{ url: "/og-default.png", width: 1200, height: 630 }] },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return (
    <StoreShell showBack>
      <ProductView slug={slug} />
    </StoreShell>
  );
}
