import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { PaymentView } from "@/features/payments/components/payment-view";
import type { AppLocale } from "@/i18n/routing";

type Params = Promise<{ locale: AppLocale; paymentId: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "payment" });
  return { title: t("title"), robots: { index: false } };
}

export default async function PaymentPage({ params }: { params: Params }) {
  const { locale, paymentId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "payment" });
  return (
    <StoreShell title={t("title")} showBack hideSearch hideBottomNav>
      <PaymentView paymentId={paymentId} />
    </StoreShell>
  );
}
