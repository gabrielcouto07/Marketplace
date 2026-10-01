import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { ProductView } from "@/features/catalog/components/product-view";
import type { AppLocale } from "@/i18n/routing";
import { fetchProductForMetadata, summarize } from "@/lib/api/metadata";
import { site } from "@/lib/site";

interface PageProps {
  params: Promise<{ locale: AppLocale; slug: string }>;
}

/** Título legível a partir do slug ("fone-de-ouvido-...-ele2" → "Fone de ouvido …"). */
function titleFromSlug(slug: string): string {
  return slug
    .replace(/-[a-z]{3}\d+$/, "")
    .replace(/-/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Metadata real do produto (nome, primeira linha da descrição e foto principal no Open Graph).
 * Se a API/mock não responder a tempo, cai no título derivado do slug.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await fetchProductForMetadata(slug, locale);
  const title = product?.name ?? titleFromSlug(slug);
  const description = product ? summarize(product.description) : undefined;
  const image = product?.images[0]?.url;
  return {
    title,
    description,
    alternates: { canonical: `/produto/${slug}` },
    openGraph: {
      title: `${title} | ${site.name}`,
      description,
      type: "website",
      images: [
        image
          ? { url: image, width: 800, height: 800, alt: title }
          : { url: "/og-default.png", width: 1200, height: 630 },
      ],
    },
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
