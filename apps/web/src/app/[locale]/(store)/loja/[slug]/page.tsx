import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { SellerView } from "@/features/seller/components/seller-view";
import type { AppLocale } from "@/i18n/routing";
import { fetchSellerForMetadata, summarize } from "@/lib/api/metadata";
import { site } from "@/lib/site";

interface PageProps {
  params: Promise<{ locale: AppLocale; slug: string }>;
}

/** Metadata real da loja (nome e descrição); cai no slug se a API/mock não responder a tempo. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const seller = await fetchSellerForMetadata(slug);
  const title = seller?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const description = seller ? summarize(seller.description) : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/loja/${slug}` },
    openGraph: {
      title: `${title} | ${site.name}`,
      description,
      type: "website",
      images: [
        seller?.bannerUrl
          ? { url: seller.bannerUrl, width: 1200, height: 400, alt: title }
          : { url: "/og-default.png", width: 1200, height: 630 },
      ],
    },
  };
}

export default async function SellerPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return (
    <StoreShell showBack>
      <SellerView slug={slug} />
    </StoreShell>
  );
}
