"use client";

import type { OrderDto, OrderStatus } from "@marketplace/contracts";
import { Package } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { OrderStatusBadge } from "@/components/shared/order-status";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginRequired } from "@/features/account/components/profile-view";
import { useAuthStore, useCurrentUser } from "@/features/auth/store";
import { useOrders } from "@/features/orders/api";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type OrderFilter = "all" | "active" | "done";

const DONE: OrderStatus[] = ["Concluido", "Cancelado", "Devolvido", "Reembolsado"];

export function matchesOrderFilter(order: OrderDto, filter: OrderFilter): boolean {
  if (filter === "all") return true;
  const done = DONE.includes(order.status);
  return filter === "done" ? done : !done;
}

/** Controle segmentado Todos / Em andamento / Concluídos (usado na lista e no resumo da conta). */
export function OrderFilterTabs({
  value,
  onChange,
  compact,
  className,
}: {
  value: OrderFilter;
  onChange: (value: OrderFilter) => void;
  /** Versão menor (trilho claro, 36 px) para dentro de cards. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("orders");
  const filters: Array<{ key: OrderFilter; label: string }> = [
    { key: "all", label: t("filterAll") },
    { key: "active", label: t("filterActive") },
    { key: "done", label: t("filterDone") },
  ];
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as OrderFilter)} className={className}>
      <TabsList aria-label={t("title")} className={cn(compact && "rounded-[13px] bg-surface")}>
        {filters.map((f) => (
          <TabsTrigger
            key={f.key}
            value={f.key}
            className={cn(compact ? "h-9 rounded-sm text-xs" : "h-[38px] rounded-[11px]")}
          >
            {f.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/**
 * Linha de pedido: número + loja/data, status, miniaturas, observação (ETA / itens) e total.
 * O número é um link "esticado" sobre a linha toda; "Pagar agora" fica acima dele (z-10).
 */
export function OrderRow({
  order,
  className,
  style,
}: {
  order: OrderDto;
  className?: string;
  style?: CSSProperties;
}) {
  const t = useTranslations("orders");
  const format = useFormatter();
  const done = DONE.includes(order.status);
  const awaiting = order.status === "AguardandoPagamento";
  const note = awaiting
    ? t("awaitingPaymentNote")
    : done
      ? `${t("items", { count: order.items.length })} · ${order.items[0]?.name ?? ""}`
      : t("etaShort", {
          min: format.dateTime(new Date(order.estimatedDelivery.min), "short"),
          max: format.dateTime(new Date(order.estimatedDelivery.max), "short"),
        });
  const thumbs = order.items.slice(0, 2);
  const extra = order.items.length - thumbs.length;

  return (
    <article className={cn("relative flex flex-col gap-2.5", className)} style={style}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <Link
            href={`/conta/pedidos/${order.id}`}
            className="text-sm font-extrabold after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/40"
          >
            {t("orderNumber", { number: order.number })}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {order.seller.name} · {format.dateTime(new Date(order.createdAt), "short")}
          </span>
        </span>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="flex items-center gap-2">
        {thumbs.map((item) => (
          <Image
            key={item.id}
            src={item.thumbnailUrl}
            alt=""
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-lg bg-surface object-cover"
          />
        ))}
        {extra > 0 ? (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface text-xs font-extrabold text-muted-foreground">
            {t("moreItems", { count: extra })}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-muted-foreground">
          {note}
        </span>
        <span className="shrink-0 text-sm font-extrabold tabular-nums">
          {formatMoney(order.totals.total)}
        </span>
      </div>

      {awaiting ? (
        <Button
          variant="cta"
          className="relative z-10 h-[42px] w-full rounded-[13px] text-[13.5px] font-extrabold"
          render={<Link href={`/pagamento/${order.payment.id}`} />}
        >
          {t("payNow")}
        </Button>
      ) : null}
    </article>
  );
}

export function OrdersView() {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const user = useCurrentUser();
  const hydrated = useAuthStore.persist.hasHydrated();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const orders = useOrders();

  if (!hydrated) return null;
  if (!user) return <LoginRequired next="/conta/pedidos" />;

  const all = orders.data?.pages.flatMap((p) => p.items) ?? [];
  const visible = all.filter((o) => matchesOrderFilter(o, filter));

  return (
    <PageContainer className="flex flex-col gap-3 py-4">
      <OrderFilterTabs value={filter} onChange={setFilter} />

      {orders.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-3xl" />
          ))}
        </div>
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button variant="cta" render={<Link href="/" />}>
              {tc("seeAll")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3 md:grid md:grid-cols-2">
          {visible.map((order, i) => (
            <li
              key={order.id}
              className="animate-rise"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <OrderRow
                order={order}
                className="pressable rounded-3xl bg-card p-4 shadow-card transition-shadow hover:shadow-float"
              />
            </li>
          ))}
        </ul>
      )}

      {orders.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          onClick={() => orders.fetchNextPage()}
          disabled={orders.isFetchingNextPage}
        >
          {orders.isFetchingNextPage ? tc("loading") : tc("loadMore")}
        </Button>
      ) : null}
    </PageContainer>
  );
}
