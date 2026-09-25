"use client";

import type { OrderDto, OrderStatus } from "@marketplace/contracts";
import { ChevronRight, Package } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { OrderStatusBadge } from "@/components/shared/order-status";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginRequired } from "@/features/account/components/profile-view";
import { useAuthStore, useCurrentUser } from "@/features/auth/store";
import { useOrders } from "@/features/orders/api";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "done";

const DONE: OrderStatus[] = ["Concluido", "Cancelado", "Devolvido", "Reembolsado"];

function matches(order: OrderDto, filter: Filter): boolean {
  if (filter === "all") return true;
  const done = DONE.includes(order.status);
  return filter === "done" ? done : !done;
}

export function OrdersView() {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const format = useFormatter();
  const user = useCurrentUser();
  const hydrated = useAuthStore.persist.hasHydrated();
  const [filter, setFilter] = useState<Filter>("all");
  const orders = useOrders();

  if (!hydrated) return null;
  if (!user) return <LoginRequired next="/conta/pedidos" />;

  const all = orders.data?.pages.flatMap((p) => p.items) ?? [];
  const visible = all.filter((o) => matches(o, filter));
  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: t("filterAll") },
    { key: "active", label: t("filterActive") },
    { key: "done", label: t("filterDone") },
  ];

  return (
    <PageContainer className="flex flex-col gap-4 py-4">
      <div role="tablist" aria-label={t("title")} className="flex rounded-full bg-muted p-1">
        {filters.map((f) => (
          <button
            key={f.key}
            role="tab"
            type="button"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "h-10 flex-1 rounded-full text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              filter === f.key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {orders.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
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
        <ul className="flex flex-col gap-3">
          {visible.map((order) => (
            <li key={order.id}>
              <Link
                href={`/conta/pedidos/${order.id}`}
                className="block rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{t("orderNumber", { number: order.number })}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("placedOn", { date: format.dateTime(new Date(order.createdAt), "short") })} · {order.seller.name}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {order.items.slice(0, 3).map((item) => (
                      <Image
                        key={item.id}
                        src={item.thumbnailUrl}
                        alt=""
                        width={44}
                        height={44}
                        className="size-11 rounded-lg border-2 border-card bg-surface object-cover"
                      />
                    ))}
                    {order.items.length > 3 ? (
                      <span className="flex size-11 items-center justify-center rounded-lg border-2 border-card bg-muted text-xs font-semibold">
                        +{order.items.length - 3}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{order.items[0]?.name}</p>
                    <p className="text-xs text-muted-foreground">{t("items", { count: order.items.length })}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatMoney(order.totals.total)}</p>
                    <span className="flex items-center justify-end gap-0.5 text-xs font-medium text-primary">
                      {t("viewDetails")} <ChevronRight className="size-3.5" aria-hidden />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {orders.hasNextPage ? (
        <Button variant="outline" onClick={() => orders.fetchNextPage()} disabled={orders.isFetchingNextPage}>
          {orders.isFetchingNextPage ? tc("loading") : tc("loadMore")}
        </Button>
      ) : null}
    </PageContainer>
  );
}
