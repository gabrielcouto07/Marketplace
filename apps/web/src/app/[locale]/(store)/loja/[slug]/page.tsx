import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { SellerView } from "@/features/seller/components/seller-view";
import type { AppLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: AppLocale; slug: string }>;
}

/** Metadata a partir do slug (o MSW não atende requests de entrada no servidor; ver produto/[slug]). */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { title, alternates: { canonical: `/loja/${slug}` } };
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
