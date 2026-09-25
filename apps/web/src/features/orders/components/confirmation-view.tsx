"use client";

import type { OrderDto } from "@marketplace/contracts";
import { Check, Clock, LogIn, PackageSearch } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/store-shell";
import { SellerAvatar } from "@/components/shared/seller-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser, useIsAuthenticated } from "@/features/auth/store";
import { usePurchaseOrders } from "@/features/orders/api";
import { Link } from "@/i18n/navigation";
import { formatMoney, sum } from "@/lib/money";
import { cn } from "@/lib/utils";

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
      <PageContainer className="pt-6">
        <EmptyState
          icon={LogIn}
          title={tAccount("guestTitle")}
          description={tAccount("guestDescription")}
          action={
            <Button
              variant="cta"
              size="lg"
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
      <PageContainer className="pt-6">
        <EmptyState
          icon={PackageSearch}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button variant="outline" render={<Link href="/conta/pedidos" />}>
              {t("title")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (isPending) return <DoneSkeleton />;

  if (isError) {
    return (
      <PageContainer className="pt-6">
        <ErrorState error={error} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  const pending = orders.some((o) => o.status === "AguardandoPagamento");
  const pendingPaymentId = orders.find((o) => o.status === "AguardandoPagamento")?.payment.id;

  return (
    <PageContainer className="flex flex-col gap-3 pt-7 pb-6 sm:max-w-lg">
      <DoneHeader
        tone={pending ? "pending" : "approved"}
        title={pending ? t("confirmationPendingTitle") : t("confirmationTitle")}
        subtitle={
          pending
            ? t("confirmationPendingSubtitle")
            : t("confirmationSubtitle", { email: user?.email ?? "" })
        }
        note={orders.length > 1 ? t("multipleOrdersNote", { count: orders.length }) : undefined}
      />

      {pending && pendingPaymentId ? (
        <Button
          variant="cta"
          size="lg"
          className="w-full animate-rise"
          render={<Link href={`/pagamento/${pendingPaymentId}`} />}
        >
          {t("payNow")}
        </Button>
      ) : null}

      <OrdersListCard orders={orders} pending={pending} />

      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="outline"
          size="lg"
          className="font-extrabold"
          render={<Link href="/conta/pedidos" />}
        >
          {t("title")}
        </Button>
        <Button size="lg" className="font-extrabold" render={<Link href="/" />}>
          {tCart("continueShopping")}
        </Button>
      </div>
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------

/** Cabeçalho "done": quadrado 76 px (azul + relógio pendente · verde + check aprovado), título 26 px e subtítulo. */
export function DoneHeader({
  tone,
  title,
  subtitle,
  note,
}: {
  tone: "pending" | "approved" | "error";
  title: string;
  subtitle?: string;
  note?: string;
}) {
  return (
    <header className="flex animate-rise flex-col items-center gap-2.5 px-2 pt-2 pb-1.5 text-center">
      <span
        className={cn(
          "flex size-[76px] animate-pop items-center justify-center rounded-3xl text-white",
          tone === "approved"
            ? "bg-success"
            : tone === "pending"
              ? "bg-primary shadow-primary"
              : "bg-cta shadow-cta",
        )}
        aria-hidden
      >
        {tone === "approved" ? (
          <Check className="size-9" strokeWidth={2.6} />
        ) : (
          <Clock className="size-9" strokeWidth={2.6} />
        )}
      </span>
      <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.03em]">{title}</h1>
      {subtitle ? (
        <p className="max-w-[300px] text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      ) : null}
      {note ? <p className="text-xs font-semibold text-muted-foreground">{note}</p> : null}
    </header>
  );
}

/** Lista de pedidos da compra (um por loja) com o total no rodapé. */
export function OrdersListCard({
  orders,
  pending,
  index = 1,
}: {
  orders: OrderDto[];
  pending: boolean;
  index?: number;
}) {
  const t = useTranslations("orders");
  const total = sum(
    orders.map((o) => o.totals.total),
    orders[0]?.totals.total.currency ?? "BRL",
  );
  return (
    <section
      aria-label={t("title")}
      className="flex animate-rise flex-col gap-2.5 rounded-3xl bg-card p-4 text-[13.5px] shadow-card"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <ul className="flex flex-col gap-2.5">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={`/conta/pedidos/${order.id}`}
              className="flex pressable items-center gap-2.5 py-1"
            >
              <SellerAvatar seller={order.seller} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col leading-snug">
                <span className="truncate font-bold">
                  {t("orderNumber", { number: order.number })}
                </span>
                <span className="truncate text-[12.5px] text-muted-foreground">
                  {order.seller.name}
                </span>
              </span>
              <span className="shrink-0 font-extrabold tabular-nums">
                {formatMoney(order.totals.total)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-border pt-2.5">
        <span className="font-extrabold">{pending ? t("totalDue") : t("totalPaid")}</span>
        <span className="font-extrabold tabular-nums">{formatMoney(total)}</span>
      </div>
    </section>
  );
}

export function DoneSkeleton() {
  return (
    <PageContainer className="flex flex-col gap-3 pt-7 sm:max-w-lg">
      <div className="flex flex-col items-center gap-2.5 pt-2 pb-1.5">
        <Skeleton className="size-[76px] rounded-3xl" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-2.5">
        <Skeleton className="h-13 w-full" />
        <Skeleton className="h-13 w-full" />
      </div>
    </PageContainer>
  );
}
