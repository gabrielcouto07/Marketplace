import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { StoreShell } from "@/components/layout/store-shell";
import { OrdersView } from "@/features/orders/components/orders-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orders");
  return { title: t("title"), robots: { index: false } };
}

export default async function Page() {
  const t = await getTranslations("orders");
  return (
    <StoreShell title={t("title")} showBack hideSearch>
      <OrdersView />
    </StoreShell>
  );
}
