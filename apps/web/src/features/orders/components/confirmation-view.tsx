"use client";

import type { OrderDto } from "@marketplace/contracts";
import { CheckCircle2, Clock, LogIn, PackageSearch } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/store-shell";
import { OrderStatusBadge } from "@/components/shared/order-status";
import { SellerBadge } from "@/components/shared/seller-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser, useIsAuthenticated } from "@/features/auth/store";
import { usePurchaseOrders } from "@/features/orders/api";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function ConfirmationView() {
  const t = useTranslations("orders");
  const tCart = useTranslations("cart");
  const tAccount = useTranslations("account");
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get("purchase") ?? "";
  const isAuthenticated = useIsAuthenticated();
  const user = useCurrentUser();
  const { data: orders, isPending, isError, error, refetch } = usePurchaseOrders(isAuthenticated ? purchaseId : "");

  if (!isAuthenticated) {
    return (
      <PageContainer>
        <EmptyState
          icon={LogIn}
          title={tAccount("guestTitle")}
          description={tAccount("guestDescription")}
          className="min-h-[60vh]"
          action={
            <Button variant="cta" size="lg" render={<Link href={`/entrar?next=/pedido/confirmado?purchase=${purchaseId}`} />}>
              {tAccount("signIn")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (!purchaseId) {
    return (
      <PageContainer>
        <EmptyState
          icon={PackageSearch}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          className="min-h-[60vh]"
          action={
            <Button variant="outline" render={<Link href="/conta/pedidos" />}>
              {t("title")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (isPending) {
    return (
      <PageContainer className="flex flex-col items-center gap-4 pt-8">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={() => refetch()} className="min-h-[60vh]" />
      </PageContainer>
    );
  }

  const pending = orders.some((o) => o.status === "AguardandoPagamento");
  const pendingPaymentId = orders.find((o) => o.status === "AguardandoPagamento")?.payment.id;

  return (
    <PageContainer className="flex flex-col gap-5 pt-6 pb-8 sm:max-w-2xl">
      <header className="flex flex-col items-center text-center">
        <span
          className={cn(
            "mb-4 flex size-20 items-center justify-center rounded-full animate-in zoom-in-50 duration-500",
            pending ? "bg-warning-soft text-warning" : "bg-success-soft text-success",
          )}
        >
          {pending ? <Clock className="size-10" aria-hidden /> : <CheckCircle2 className="size-10" aria-hidden />}
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{pending ? t("confirmationPendingTitle") : t("confirmationTitle")}</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {pending ? t("confirmationPendingSubtitle") : t("confirmationSubtitle", { email: user?.email ?? "" })}
        </p>
        {orders.length > 1 ? <p className="mt-2 text-xs text-muted-foreground">{t("multipleOrdersNote", { count: orders.length })}</p> : null}
        {pending && pendingPaymentId ? (
          <Button variant="cta" size="lg" className="mt-4" render={<Link href={`/pagamento/${pendingPaymentId}`} />}>
            {t("payNow")}
          </Button>
        ) : null}
      </header>

      <ul className="flex flex-col gap-4">
        {orders.map((order) => (
          <li key={order.id}>
            <OrderCard order={order} />
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="cta" size="lg" className="flex-1" render={<Link href="/conta/pedidos" />}>
          {t("title")}
        </Button>
        <Button variant="outline" size="lg" className="flex-1" render={<Link href="/" />}>
          {tCart("continueShopping")}
        </Button>
      </div>
    </PageContainer>
  );
}

function OrderCard({ order }: { order: OrderDto }) {
  const t = useTranslations("orders");
  const tCheckout = useTranslations("checkout");
  const tc = useTranslations("common");
  const format = useFormatter();
  const dateShort = (iso: string) => format.dateTime(new Date(iso), "short");

  return (
    <article aria-labelledby={`order-${order.id}`} className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <h2 id={`order-${order.id}`} className="text-sm font-bold">
          {t("orderNumber", { number: order.number })}
        </h2>
        <OrderStatusBadge status={order.status} />
        <span className="ml-auto text-xs text-muted-foreground">{t("placedOn", { date: dateShort(order.createdAt) })}</span>
      </header>

      <div className="flex flex-col gap-3 p-4">
        <SellerBadge seller={order.seller} className="text-sm font-semibold text-foreground" />

        <ul className="flex flex-col gap-2">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 text-sm">
              <Link href={`/produto/${item.productSlug}`} className="relative size-12 shrink-0 overflow-hidden rounded-md bg-surface">
                <Image src={item.thumbnailUrl} alt="" fill sizes="48px" className="object-cover" />
              </Link>
              <span className="min-w-0 flex-1">
                <Link href={`/produto/${item.productSlug}`} className="line-clamp-1 font-medium hover:text-primary">
                  {item.name}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {item.variantLabel ? `${item.variantLabel} · ` : ""}
                  {item.quantity} × {formatMoney(item.unitPrice)}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{formatMoney(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="grid grid-cols-1 gap-2 rounded-lg bg-surface p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{tCheckout("shipping")}</dt>
            <dd className="font-medium">
              {order.shippingOption.service} · {order.shippingOption.carrier}
              <span className="block text-xs text-muted-foreground">
                {tc("businessDays", { min: order.shippingOption.estimatedDays.min, max: order.shippingOption.estimatedDays.max })}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("estimatedDelivery")}</dt>
            <dd className="font-medium">{t("estimatedRange", { min: dateShort(order.estimatedDelivery.min), max: dateShort(order.estimatedDelivery.max) })}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">{t("deliveryAddress")}</dt>
            <dd className="font-medium">
              {order.shippingAddress.street}, {order.shippingAddress.number}
              {order.shippingAddress.complement ? ` · ${order.shippingAddress.complement}` : ""} · {order.shippingAddress.city}/{order.shippingAddress.state}
            </dd>
          </div>
        </dl>

        <dl className="flex flex-col gap-1 text-sm">
          <Row label={tCheckout("subtotal")} value={formatMoney(order.totals.subtotal)} />
          <Row label={tCheckout("shipping")} value={order.totals.shipping.amount === 0 ? "—" : formatMoney(order.totals.shipping)} />
          <Row label={tCheckout("importTax")} value={formatMoney(order.totals.importTax)} />
          {order.totals.discount.amount > 0 ? <Row label={tCheckout("discount")} value={`− ${formatMoney(order.totals.discount)}`} /> : null}
          <div className="mt-1 flex items-center justify-between border-t border-border pt-2">
            <dt className="font-semibold">{tCheckout("total")}</dt>
            <dd className="text-right">
              <span className="block text-lg font-bold">{formatMoney(order.totals.total)}</span>
              <span className="block text-xs text-muted-foreground">≈ {formatMoney(order.totals.totalReference)}</span>
            </dd>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("exchangeUsed", { rate: order.exchangeRate.displayRate })} · {t(`paymentMethod.${order.payment.method}`)} ·{" "}
            {t(`paymentStatus.${order.payment.status}`)}
          </p>
        </dl>
      </div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
