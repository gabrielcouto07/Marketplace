"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { Illustration, type IllustrationName } from "@/components/shared/illustrations";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useIsAuthenticated } from "@/features/auth/store";
import { usePurchaseOrders } from "@/features/orders/api";
import {
  PurchaseOrderCard,
  PurchaseSkeleton,
} from "@/features/orders/components/purchase-order-card";
import { Link } from "@/i18n/navigation";

export function ConfirmationView() {
  const t = useTranslations("orders");
  const tCart = useTranslations("cart");
  const tAccount = useTranslations("account");
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get("purchase") ?? "";
  const isAuthenticated = useIsAuthenticated();
  const user = useCurrentUser();
  const {
    data: orders,
    isPending,
    isError,
    error,
    refetch,
  } = usePurchaseOrders(isAuthenticated ? purchaseId : "");

  if (!isAuthenticated) {
    return (
      <PageContainer className="pt-4">
        <EmptyState
          illustration="bag"
          title={tAccount("guestTitle")}
          description={tAccount("guestDescription")}
          action={
            <Button
              variant="primary"
              render={<Link href={`/entrar?next=/pedido/confirmado?purchase=${purchaseId}`} />}
            >
              {tAccount("signIn")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (!purchaseId) {
    return (
      <PageContainer className="pt-4">
        <EmptyState
          illustration="box"
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button variant="secondary" render={<Link href="/conta/pedidos" />}>
              {t("title")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (isPending) return <PurchaseSkeleton />;

  if (isError) {
    return (
      <PageContainer className="pt-4">
        <ErrorState error={error} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  const pendingOrder = orders.find((o) => o.status === "AguardandoPagamento");
  const pending = Boolean(pendingOrder);
  const trackHref = orders.length === 1 ? `/conta/pedidos/${orders[0].id}` : "/conta/pedidos";

  return (
    <PageContainer className="flex flex-col gap-6 pt-6 pb-6 sm:max-w-lg">
      <ResultHeader
        illustration={pending ? "box" : "check"}
        title={pending ? t("confirmationPendingTitle") : t("confirmationTitle")}
        subtitle={
          pending
            ? t("confirmationPendingSubtitle")
            : t("confirmationSubtitle", { email: user?.email ?? "" })
        }
        note={orders.length > 1 ? t("multipleOrdersNote", { count: orders.length }) : undefined}
      />

      {pending && pendingOrder ? (
        <Button
          variant="cta"
          fullWidth
          render={<Link href={`/pagamento/${pendingOrder.payment.id}`} />}
        >
          {t("payNow")}
        </Button>
      ) : null}

      <div className="flex flex-col gap-4">
        {orders.map((order) => (
          <PurchaseOrderCard key={order.id} order={order} />
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="primary" fullWidth render={<Link href={trackHref} />}>
          {t("trackOrder")}
        </Button>
        <Button variant="secondary" fullWidth render={<Link href="/" />}>
          {tCart("continueShopping")}
        </Button>
      </div>
    </PageContainer>
  );
}

/** Topo de resultado: ilustração linear, título em title-1 e subtítulo curto. */
export function ResultHeader({
  illustration,
  title,
  subtitle,
  note,
  children,
}: {
  illustration: IllustrationName;
  title: string;
  subtitle?: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col items-center gap-2 text-center">
      <Illustration name={illustration} className="mb-2" />
      {children}
      <h1 className="text-title-1 text-foreground">{title}</h1>
      {subtitle ? (
        <p className="max-w-[320px] text-body text-foreground-secondary">{subtitle}</p>
      ) : null}
      {note ? <p className="text-caption text-foreground-muted">{note}</p> : null}
    </header>
  );
}
