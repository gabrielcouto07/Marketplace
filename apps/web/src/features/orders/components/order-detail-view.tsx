"use client";

import type { OrderDto, OrderStatus } from "@marketplace/contracts";
import { AlertOctagon, Ban, Copy, CreditCard, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { OrderStatusBadge, OrderTimeline } from "@/components/shared/order-status";
import { ErrorState } from "@/components/shared/states";
import { DeliveryWindow, ImportTaxLine } from "@/components/shared/trust-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginRequired } from "@/features/account/components/profile-view";
import { useAuthStore, useCurrentUser } from "@/features/auth/store";
import { useCartStore } from "@/features/cart/store";
import { useCancelOrder, useOpenDispute, useOrder } from "@/features/orders/api";
import { Link, useRouter } from "@/i18n/navigation";
import { convert, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatCep } from "@/lib/validation/documents";

import { isOrderDone } from "./orders-view";

const CANCELLABLE: OrderStatus[] = ["AguardandoPagamento", "Pago", "EmPreparacao"];
const DISPUTABLE: OrderStatus[] = ["Enviado", "EmTransitoInternacional", "Entregue"];

export function OrderDetailView({ orderId }: { orderId: string }) {
  const user = useCurrentUser();
  const hydrated = useAuthStore.persist.hasHydrated();
  const order = useOrder(orderId);

  if (!hydrated) return null;
  if (!user) return <LoginRequired next={`/conta/pedidos/${orderId}`} />;

  if (order.isPending) {
    return (
      <PageContainer className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-6 w-24 rounded-sm" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </PageContainer>
    );
  }
  if (order.isError) {
    return (
      <PageContainer className="py-4">
        <ErrorState error={order.error} onRetry={() => order.refetch()} />
      </PageContainer>
    );
  }

  return <OrderDetail order={order.data} />;
}

/** Card de seção: título em title-3 e conteúdo. */
function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs",
        className,
      )}
    >
      <h2 className="text-title-3 text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function OrderDetail({ order }: { order: OrderDto }) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const tProduct = useTranslations("product");
  const tCheckout = useTranslations("checkout");
  const format = useFormatter();
  const router = useRouter();
  const cancel = useCancelOrder();
  const dispute = useOpenDispute();
  const addToCart = useCartStore((s) => s.add);
  const [confirm, setConfirm] = useState<"cancel" | "dispute" | null>(null);

  const awaitingPayment = order.status === "AguardandoPagamento";
  const active = !isOrderDone(order.status);

  const copyTracking = async () => {
    if (!order.trackingCode) return;
    try {
      await navigator.clipboard.writeText(order.trackingCode);
      toast.success(tc("copied"));
    } catch {
      toast.error(tc("copy"));
    }
  };

  const buyAgain = () => {
    for (const item of order.items) {
      addToCart({
        product: {
          id: item.productId,
          slug: item.productSlug,
          name: item.name,
          thumbnailUrl: item.thumbnailUrl,
          price: item.unitPrice,
          referencePrice: convert(item.unitPrice, order.exchangeRate),
          stock: 99,
          freeShipping: false,
          seller: order.seller,
        },
        variantId: item.variantId,
        variantLabel: item.variantLabel,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
      });
    }
    toast.success(tProduct("addedToCart"));
    router.push("/carrinho");
  };

  const runConfirm = () => {
    const id = order.id;
    if (confirm === "cancel") {
      cancel.mutate(id, {
        onSuccess: () => toast.success(t("cancelled")),
        onError: (e) => toast.error(e.message),
        onSettled: () => setConfirm(null),
      });
    } else if (confirm === "dispute") {
      dispute.mutate(id, {
        onSuccess: () => toast.success(t("disputeOpened")),
        onError: (e) => toast.error(e.message),
        onSettled: () => setConfirm(null),
      });
    }
  };

  const events = [...order.trackingEvents].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const payMethod = t(`paymentMethod.${order.payment.method}`);
  const payStatus = t(`paymentStatus.${order.payment.status}`);

  return (
    <PageContainer className="flex flex-col gap-4 py-4 md:grid md:grid-cols-2 md:items-start">
      {/* Status + linha do tempo */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="text-title-2 text-foreground tabular-nums">
              {t("orderNumber", { number: order.number })}
            </h2>
            <p className="text-caption text-foreground-muted">
              {t("placedOn", { date: format.dateTime(new Date(order.createdAt), "dateTime") })} ·{" "}
              {order.seller.name}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <OrderTimeline status={order.status} events={order.timeline} />
        {active ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <DeliveryWindow range={order.shippingOption.estimatedDays} />
            <p className="pl-[52px] text-caption text-foreground-secondary">
              {t("estimatedDelivery")}{" "}
              <span className="font-medium text-foreground tabular-nums">
                {t("estimatedRange", {
                  min: format.dateTime(new Date(order.estimatedDelivery.min), "short"),
                  max: format.dateTime(new Date(order.estimatedDelivery.max), "short"),
                })}
              </span>
            </p>
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-4">
        {/* Rastreio */}
        <Section title={t("trackingTitle")}>
          {order.trackingCode ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded-md bg-surface-muted p-3">
                <span className="flex min-w-0 flex-col">
                  <span className="text-caption text-foreground-muted">{t("trackingCode")}</span>
                  <span className="truncate font-mono text-body-sm font-medium text-foreground tabular-nums">
                    {order.trackingCode}
                  </span>
                </span>
                <Button variant="secondary" size="sm" onClick={copyTracking}>
                  <Copy data-icon="inline-start" strokeWidth={1.75} /> {tc("copy")}
                </Button>
              </div>
              <ol className="flex flex-col divide-y divide-border">
                {events.map((e, i) => (
                  <li
                    key={`${e.code}-${e.occurredAt}`}
                    className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0"
                  >
                    <p
                      className={cn(
                        "text-body-sm",
                        i === 0
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground-secondary",
                      )}
                    >
                      {e.description}
                    </p>
                    <p className="text-caption text-foreground-muted tabular-nums">
                      {format.dateTime(new Date(e.occurredAt), "dateTime")} · {e.location}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-body-sm text-foreground-secondary">{t("noTracking")}</p>
          )}
        </Section>

        {/* Itens */}
        <Section title={t("items", { count: order.items.length })}>
          <ul className="flex flex-col divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Image
                  src={item.thumbnailUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-md bg-surface-muted object-contain"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/produto/${item.productSlug}`}
                    className="line-clamp-2 text-body-sm font-medium text-foreground focus-ring transition-colors hover:text-primary"
                  >
                    {item.name}
                  </Link>
                  {item.variantLabel ? (
                    <p className="text-caption text-foreground-secondary">{item.variantLabel}</p>
                  ) : null}
                  <p className="text-caption text-foreground-muted tabular-nums">
                    {item.quantity} × {formatMoney(item.unitPrice)}
                  </p>
                </div>
                <p className="shrink-0 text-body-sm font-semibold text-foreground tabular-nums">
                  {formatMoney(item.lineTotal)}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        {/* Endereço */}
        <Section title={t("deliveryAddress")}>
          <div className="flex flex-col text-body-sm text-foreground-secondary">
            <p className="font-medium text-foreground">{order.shippingAddress.recipientName}</p>
            <p>
              {order.shippingAddress.street}, {order.shippingAddress.number}
              {order.shippingAddress.complement ? ` – ${order.shippingAddress.complement}` : ""}
            </p>
            <p>
              {order.shippingAddress.neighborhood} · {order.shippingAddress.city}/
              {order.shippingAddress.state} ·{" "}
              <span className="tabular-nums">
                CEP {formatCep(order.shippingAddress.postalCode)}
              </span>
            </p>
          </div>
          <p className="border-t border-border pt-3 text-caption text-foreground-muted">
            {order.shippingOption.carrier} · {order.shippingOption.service} ·{" "}
            {tc("businessDays", {
              min: order.shippingOption.estimatedDays.min,
              max: order.shippingOption.estimatedDays.max,
            })}
          </p>
        </Section>

        {/* Pagamento */}
        <Section title={t("paymentInfo")}>
          <p className="flex items-center gap-3 text-body-sm text-foreground-secondary">
            <CreditCard
              className="size-5 shrink-0 text-foreground-secondary"
              strokeWidth={1.75}
              aria-hidden
            />
            <span>
              {payMethod} · <span className="font-medium text-foreground">{payStatus}</span>
            </span>
          </p>
          {awaitingPayment ? (
            <Button
              variant="cta"
              fullWidth
              render={<Link href={`/pagamento/${order.payment.id}`} />}
            >
              {t("payNow")}
            </Button>
          ) : null}
        </Section>

        {/* Totais */}
        <Section title={t("totals")}>
          <dl className="flex flex-col gap-2 text-body-sm">
            <Row label={tCheckout("subtotal")} value={formatMoney(order.totals.subtotal)} />
            <Row label={tCheckout("shipping")} value={formatMoney(order.totals.shipping)} />
            {order.totals.discount.amount > 0 ? (
              <Row
                label={tCheckout("discount")}
                value={`- ${formatMoney(order.totals.discount)}`}
                tone="success"
              />
            ) : null}
          </dl>
          <ImportTaxLine amount={order.totals.importTax} />
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body font-semibold text-foreground">{tCheckout("total")}</span>
              <span className="text-title-2 text-foreground tabular-nums">
                {formatMoney(order.totals.total)}
              </span>
            </div>
            <p className="text-right text-caption text-foreground-muted tabular-nums">
              ≈ {formatMoney(order.totals.totalReference)} ·{" "}
              {t("exchangeUsed", { rate: order.exchangeRate.displayRate })}
            </p>
          </div>
        </Section>

        {/* Ações */}
        <div className="flex flex-col gap-2">
          <Button variant="secondary" fullWidth onClick={buyAgain}>
            <RefreshCw data-icon="inline-start" strokeWidth={1.75} /> {t("buyAgain")}
          </Button>
          {DISPUTABLE.includes(order.status) ? (
            <Button variant="destructive" fullWidth onClick={() => setConfirm("dispute")}>
              <AlertOctagon data-icon="inline-start" strokeWidth={1.75} /> {t("openDispute")}
            </Button>
          ) : null}
          {CANCELLABLE.includes(order.status) ? (
            <Button variant="destructive" fullWidth onClick={() => setConfirm("cancel")}>
              <Ban data-icon="inline-start" strokeWidth={1.75} /> {t("cancelOrder")}
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "cancel" ? t("cancelOrder") : t("openDispute")}</DialogTitle>
            <DialogDescription>
              {confirm === "cancel" ? t("cancelConfirm") : t("disputeConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={runConfirm}
              loading={cancel.isPending || dispute.isPending}
            >
              {confirm === "cancel" ? (
                <Ban data-icon="inline-start" strokeWidth={1.75} />
              ) : (
                <AlertOctagon data-icon="inline-start" strokeWidth={1.75} />
              )}
              {confirm === "cancel" ? t("cancelOrder") : t("openDispute")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-foreground-secondary">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          tone === "success" ? "font-medium text-success" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
