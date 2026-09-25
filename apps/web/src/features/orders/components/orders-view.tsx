"use client";

import type { OrderDto, OrderStatus } from "@marketplace/contracts";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

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

export function isOrderDone(status: OrderStatus): boolean {
  return DONE.includes(status);
}

export function matchesOrderFilter(order: OrderDto, filter: OrderFilter): boolean {
  if (filter === "all") return true;
  const done = isOrderDone(order.status);
  return filter === "done" ? done : !done;
}

/** Controle segmentado Todos / Em andamento / Concluídos. */
export function OrderFilterTabs({
  value,
  onChange,
  className,
}: {
  value: OrderFilter;
  onChange: (value: OrderFilter) => void;
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
      <TabsList aria-label={t("title")}>
        {filters.map((f) => (
          <TabsTrigger key={f.key} value={f.key}>
            {f.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/** Card de pedido: número + data, status, miniaturas dos itens, total e link para o detalhe. */
export function OrderCard({ order, className }: { order: OrderDto; className?: string }) {
  const t = useTranslations("orders");
  const format = useFormatter();
  const thumbs = order.items.slice(0, 3);
  const extra = order.items.length - thumbs.length;

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <p className="text-body-sm font-semibold text-foreground tabular-nums">
            {t("orderNumber", { number: order.number })}
          </p>
          <p className="truncate text-caption text-foreground-muted">
            {format.dateTime(new Date(order.createdAt), "short")} · {order.seller.name}
          </p>
        </div>
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
            className="size-12 shrink-0 rounded-md bg-surface-muted object-contain"
          />
        ))}
        {extra > 0 ? (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-surface-muted text-caption text-foreground-secondary tabular-nums">
            {t("moreItems", { count: extra })}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-caption text-foreground-secondary">
          {t("items", { count: order.items.length })}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-body-sm font-semibold text-foreground tabular-nums">
          {formatMoney(order.totals.total)}
        </span>
        <Button variant="link" render={<Link href={`/conta/pedidos/${order.id}`} />}>
          {t("viewDetails")}
        </Button>
      </div>
    </article>
  );
}

function OrderCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-6 w-24 rounded-sm" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="size-12" />
        <Skeleton className="size-12" />
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
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
    <PageContainer className="flex flex-col gap-4 py-4">
      <OrderFilterTabs value={filter} onChange={setFilter} />

      {orders.isPending ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          illustration="box"
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button variant="primary" render={<Link href="/" />}>
              {tc("seeAll")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4 md:grid md:grid-cols-2">
          {visible.map((order) => (
            <li key={order.id}>
              <OrderCard order={order} />
            </li>
          ))}
        </ul>
      )}

      {orders.hasNextPage ? (
        <Button
          variant="secondary"
          className="self-center"
          onClick={() => orders.fetchNextPage()}
          loading={orders.isFetchingNextPage}
        >
          {tc("loadMore")}
        </Button>
      ) : null}
    </PageContainer>
  );
}
