import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";

import "../globals.css";

import { Providers } from "@/components/layout/providers";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";
import { site } from "@/lib/site";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    metadataBase: new URL(env.siteUrl),
    title: { default: site.name, template: `%s | ${site.name}` },
    description: t("siteDescription"),
    applicationName: site.name,
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: site.shortName },
    formatDetection: { telephone: false },
    icons: {
      icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/logo.svg", type: "image/svg+xml" }],
      apple: "/icons/apple-touch-icon.png",
    },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: locale.replace("-", "_"),
      images: [{ url: "/og-default.png", width: 1200, height: 630 }],
    },
    alternates: {
      languages: { "pt-BR": "/", "es-PY": "/es-PY" },
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: site.themeColor },
    { media: "(prefers-color-scheme: dark)", color: "#002E8A" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
