"use client";

import type { OrderDto, OrderStatus } from "@marketplace/contracts";
import {
  AlertOctagon,
  Ban,
  Copy,
  CreditCard,
  MapPin,
  RefreshCw,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { OrderStatusBadge, OrderTimeline } from "@/components/shared/order-status";
import { ErrorState } from "@/components/shared/states";
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
      <PageContainer className="flex flex-col gap-3 py-4">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
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

/** Card branco empilhado com título (e ícone em caixa azul-suave opcional). */
function Section({
  title,
  icon: Icon,
  children,
  className,
  delay = 0,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={cn(
        "flex animate-rise flex-col gap-3 rounded-3xl bg-card p-4 shadow-card",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <h2 className="flex items-center gap-2.5 text-[15px] font-extrabold">
        {Icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-accent text-accent-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        {title}
      </h2>
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
  const tPayMethod = t(`paymentMethod.${order.payment.method}`);
  const tPayStatus = t(`paymentStatus.${order.payment.status}`);

  return (
    <PageContainer className="flex flex-col gap-3 py-4 md:grid md:grid-cols-2 md:items-start">
      <header className="flex animate-rise flex-col gap-3 rounded-3xl bg-card p-4 shadow-card md:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight">
              {t("orderNumber", { number: order.number })}
            </h1>
            <p className="text-xs text-muted-foreground">
              {order.seller.name} ·{" "}
              {t("placedOn", { date: format.dateTime(new Date(order.createdAt), "dateTime") })}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        {order.status === "AguardandoPagamento" ? (
          <Button
            variant="cta"
            className="w-full"
            render={<Link href={`/pagamento/${order.payment.id}`} />}
          >
            <CreditCard data-icon="inline-start" /> {t("payNow")}
          </Button>
        ) : null}
      </header>

      <Section title={t("timelineLabel")} delay={40}>
        <OrderTimeline status={order.status} events={order.timeline} className="mt-1" />
      </Section>

      <div className="flex flex-col gap-3">
        <Section title={t("trackingTitle")} icon={Truck} delay={80}>
          <p className="text-[13px] text-muted-foreground">
            {t("estimatedDelivery")}:{" "}
            <span className="font-bold text-foreground">
              {t("estimatedRange", {
                min: format.dateTime(new Date(order.estimatedDelivery.min), "short"),
                max: format.dateTime(new Date(order.estimatedDelivery.max), "short"),
              })}
            </span>
          </p>
          {order.trackingCode ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-surface py-1.5 pr-1.5 pl-3.5">
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">
                  {order.trackingCode}
                </span>
                <Button
                  size="icon-sm"
                  variant="white"
                  aria-label={tc("copy")}
                  onClick={copyTracking}
                >
                  <Copy />
                </Button>
              </div>
              <ol className="ml-1 flex flex-col gap-3 border-l-2 border-line-200 pl-4">
                {events.map((e, i) => (
                  <li key={`${e.code}-${e.occurredAt}`} className="relative text-sm">
                    <span
                      className={cn(
                        "absolute top-1.5 -left-[23px] size-2.5 rounded-full ring-4 ring-card",
                        i === 0 ? "bg-primary" : "bg-line-300",
                      )}
                      aria-hidden
                    />
                    <p className="font-bold">{e.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(e.occurredAt), "dateTime")} · {e.location}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">{t("noTracking")}</p>
          )}
        </Section>

        <Section title={t("items", { count: order.items.length })} delay={120}>
          <ul className="flex flex-col">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0"
              >
                <Image
                  src={item.thumbnailUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-lg bg-surface object-cover"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/produto/${item.productSlug}`}
                    className="line-clamp-2 text-sm font-bold hover:text-primary"
                  >
                    {item.name}
                  </Link>
                  {item.variantLabel ? (
                    <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {item.quantity} × {formatMoney(item.unitPrice)}
                  </p>
                </div>
                <p className="text-sm font-extrabold tabular-nums">{formatMoney(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("deliveryAddress")} icon={MapPin} delay={160}>
          <div className="text-[13.5px] leading-relaxed text-body">
            <p className="font-bold text-foreground">{order.shippingAddress.recipientName}</p>
            <p>
              {order.shippingAddress.street}, {order.shippingAddress.number}
              {order.shippingAddress.complement ? ` – ${order.shippingAddress.complement}` : ""}
            </p>
            <p>
              {order.shippingAddress.neighborhood} · {order.shippingAddress.city}/
              {order.shippingAddress.state} · CEP {formatCep(order.shippingAddress.postalCode)}
            </p>
          </div>
          <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
            {order.shippingOption.carrier} · {order.shippingOption.service} ·{" "}
            {tc("businessDays", {
              min: order.shippingOption.estimatedDays.min,
              max: order.shippingOption.estimatedDays.max,
            })}
          </p>
        </Section>

        <Section title={t("paymentInfo")} icon={CreditCard} delay={200}>
          <p className="text-[13.5px] text-body">
            {tPayMethod} · <span className="font-bold text-foreground">{tPayStatus}</span>
          </p>
        </Section>

        <Section title={t("totals")} delay={240}>
          <dl className="flex flex-col gap-1.5 text-[13.5px]">
            <Row label={tCheckout("subtotal")} value={formatMoney(order.totals.subtotal)} />
            <Row label={tCheckout("shipping")} value={formatMoney(order.totals.shipping)} />
            <Row label={tCheckout("importTax")} value={formatMoney(order.totals.importTax)} />
            {order.totals.discount.amount > 0 ? (
              <Row
                label={tCheckout("discount")}
                value={`- ${formatMoney(order.totals.discount)}`}
              />
            ) : null}
            <div className="my-1 h-px bg-border" />
            <Row label={tCheckout("total")} value={formatMoney(order.totals.total)} bold />
            <p className="text-right text-xs text-muted-foreground">
              ≈ {formatMoney(order.totals.totalReference)}
            </p>
            <p className="text-right text-xs text-muted-foreground">
              {t("exchangeUsed", { rate: order.exchangeRate.displayRate })}
            </p>
          </dl>
        </Section>

        <div className="flex animate-rise flex-col gap-2" style={{ animationDelay: "280ms" }}>
          <Button variant="cta" size="lg" onClick={buyAgain}>
            <RefreshCw data-icon="inline-start" /> {t("buyAgain")}
          </Button>
          {DISPUTABLE.includes(order.status) ? (
            <Button variant="outline" onClick={() => setConfirm("dispute")}>
              <AlertOctagon data-icon="inline-start" /> {t("openDispute")}
            </Button>
          ) : null}
          {CANCELLABLE.includes(order.status) ? (
            <Button variant="destructive" onClick={() => setConfirm("cancel")}>
              <Ban data-icon="inline-start" /> {t("cancelOrder")}
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
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant={confirm === "cancel" ? "destructive" : "default"}
              onClick={runConfirm}
              disabled={cancel.isPending || dispute.isPending}
            >
              {tc("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", bold && "text-base font-extrabold")}>
      <dt className={bold ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
