"use client";

import type { OrderDto } from "@marketplace/contracts";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/store-shell";
import { OrderStatusBadge } from "@/components/shared/order-status";
import { SellerAvatar } from "@/components/shared/seller-badge";
import { DeliveryWindow } from "@/components/shared/trust-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatMoney, sum } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Card de um pedido (uma loja) na confirmação: loja + status, itens, prazo, valores e a
 * cotação usada. Lista dentro do card com `divide-y`; nunca card dentro de card.
 */
export function PurchaseOrderCard({ order }: { order: OrderDto }) {
  const t = useTranslations("orders");
  const tCheckout = useTranslations("checkout");
  const tCatalog = useTranslations("catalog");
  const { totals } = order;
  const freeShipping = totals.shipping.amount === 0;

  return (
    <article
      aria-label={t("orderNumber", { number: order.number })}
      className="rounded-lg border border-border bg-surface shadow-xs"
    >
      <header className="flex items-center gap-3 p-4">
        <SellerAvatar seller={order.seller} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-sm font-medium text-foreground">
            {order.seller.name}
          </span>
          <span className="text-caption text-foreground-secondary tabular-nums">
            {t("orderNumber", { number: order.number })}
          </span>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      <ul className="divide-y divide-border border-t border-border">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <span className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-surface-muted">
              <Image src={item.thumbnailUrl} alt="" fill sizes="48px" className="object-contain" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-1 text-body-sm text-foreground">{item.name}</span>
              <span className="text-caption text-foreground-secondary tabular-nums">
                {t("quantityShort", { count: item.quantity })} {formatMoney(item.unitPrice)}
                {item.variantLabel ? ` · ${item.variantLabel}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-body-sm font-medium text-foreground tabular-nums">
              {formatMoney(item.lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-4 border-t border-border p-4">
        <DeliveryWindow range={order.shippingOption.estimatedDays} />
        <dl className="flex flex-col gap-2 border-t border-border pt-4 text-body-sm">
          <TotalsRow label={tCheckout("subtotal")} value={formatMoney(totals.subtotal)} />
          <TotalsRow
            label={tCheckout("shipping")}
            value={freeShipping ? tCatalog("freeShipping") : formatMoney(totals.shipping)}
            valueClassName={freeShipping ? "text-success" : undefined}
          />
          <TotalsRow label={tCheckout("importTax")} value={formatMoney(totals.importTax)} />
          {totals.discount.amount > 0 ? (
            <TotalsRow
              label={tCheckout("discount")}
              value={`− ${formatMoney(totals.discount)}`}
              valueClassName="text-success"
            />
          ) : null}
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <dt className="font-medium text-foreground">{tCheckout("total")}</dt>
            <dd className="text-title-3 text-foreground tabular-nums">
              {formatMoney(totals.total)}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-0.5 text-caption text-foreground-muted tabular-nums">
          <span>≈ {formatMoney(totals.totalReference)}</span>
          <span>{t("exchangeUsed", { rate: order.exchangeRate.displayRate })}</span>
        </div>
      </div>
    </article>
  );
}

function TotalsRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-foreground-secondary">{label}</dt>
      <dd className={cn("font-medium text-foreground tabular-nums", valueClassName)}>{value}</dd>
    </div>
  );
}

/** Lista compacta dos pedidos da compra (um por loja) com o total no rodapé — usada no pagamento. */
export function PurchaseTotalsCard({ orders, pending }: { orders: OrderDto[]; pending: boolean }) {
  const t = useTranslations("orders");
  const total = sum(
    orders.map((o) => o.totals.total),
    orders[0]?.totals.total.currency ?? "BRL",
  );
  return (
    <section
      aria-label={t("title")}
      className="rounded-lg border border-border bg-surface shadow-xs"
    >
      <ul className="divide-y divide-border">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={`/conta/pedidos/${order.id}`}
              className="flex pressable items-center gap-3 p-4 focus-ring transition-colors hover:bg-surface-muted"
            >
              <SellerAvatar seller={order.seller} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-sm font-medium text-foreground tabular-nums">
                  {t("orderNumber", { number: order.number })}
                </span>
                <span className="truncate text-caption text-foreground-secondary">
                  {order.seller.name}
                </span>
              </span>
              <span className="shrink-0 text-body-sm font-medium text-foreground tabular-nums">
                {formatMoney(order.totals.total)}
              </span>
              <ChevronRight
                className="size-5 shrink-0 text-foreground-muted"
                strokeWidth={1.75}
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3 border-t border-border p-4">
        <span className="text-body-sm font-medium text-foreground">
          {pending ? t("totalDue") : t("totalPaid")}
        </span>
        <span className="text-title-3 text-foreground tabular-nums">{formatMoney(total)}</span>
      </div>
    </section>
  );
}

/** Skeleton das telas de confirmação/pagamento: ilustração + título + um card. */
export function PurchaseSkeleton() {
  return (
    <PageContainer className="flex flex-col gap-4 pt-6 sm:max-w-lg">
      <div className="flex flex-col items-center gap-2 pb-2">
        <Skeleton className="h-24 w-[120px] rounded-lg" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </PageContainer>
  );
}
