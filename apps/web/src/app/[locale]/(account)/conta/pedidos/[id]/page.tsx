import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { OrderDetailView } from "@/features/orders/components/order-detail-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("title"), robots: { index: false } };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("orders");
  return (
    <StoreShell title={t("detailTitle")} showBack hideSearch>
      <OrderDetailView orderId={id} />
    </StoreShell>
  );
}
