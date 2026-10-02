import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

/** Catch-all: qualquer rota desconhecida dentro do locale cai no not-found.tsx localizado. */
export default async function CatchAllPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  notFound();
}
