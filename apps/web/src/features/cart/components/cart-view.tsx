"use client";

import { ChevronRight, Package, ShoppingBag, WifiOff } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { usePwa } from "@/components/layout/pwa-provider";
import { PageContainer, StickyBar } from "@/components/layout/store-shell";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { SellerAvatar } from "@/components/shared/seller-badge";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsAuthenticated } from "@/features/auth/store";
import {
  groupBySeller,
  selectItemCount,
  selectSubtotal,
  useCartStore,
  type CartLine,
  type CartSellerGroup,
} from "@/features/cart/store";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Regra de frete grátis por loja (mock): a partir de R$ 300,00 de subtotal na mesma loja.
 * Valor em centavos. Quando a API real existir, deve vir na cotação/loja.
 */
const FREE_SHIPPING_THRESHOLD_CENTS = 30000;

/** true após a store persistida do carrinho reidratar do localStorage (evita mismatch de hidratação). */
export function useCartHydration(): boolean {
  return useSyncExternalStore(
    (onChange) => useCartStore.persist.onFinishHydration(onChange),
    () => useCartStore.persist.hasHydrated(),
    () => false,
  );
}

export function CartView() {
  const t = useTranslations("cart");
  const tc = useTranslations("common");
  const hydrated = useCartHydration();
  const lines = useCartStore((s) => s.lines);
  const { setQuantity, remove, add } = useCartStore();
  const isAuthenticated = useIsAuthenticated();
  const { isOnline } = usePwa();

  if (!hydrated) return <CartSkeleton />;

  const groups = groupBySeller(lines);
  const subtotal = selectSubtotal(lines);
  const count = selectItemCount(lines);

  const removeWithUndo = (line: CartLine) => {
    remove(line.key);
    toast(t("itemRemoved"), {
      action: {
        label: t("undo"),
        onClick: () =>
          add({
            product: {
              id: line.productId,
              slug: line.slug,
              name: line.name,
              thumbnailUrl: line.thumbnailUrl,
              price: line.unitPrice,
              referencePrice: line.referencePrice,
              stock: line.maxQuantity,
              freeShipping: line.freeShipping,
              seller: line.seller,
            },
            variantId: line.variantId,
            variantLabel: line.variantLabel,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            maxQuantity: line.maxQuantity,
          }),
      },
    });
  };

  return (
    <PageContainer className="flex flex-col gap-3 pt-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        {count > 0 ? (
          <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
            {t("itemCount", { count })}
          </span>
        ) : null}
      </div>

      {!isOnline ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] font-semibold text-warning"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden /> {t("offlineNote")}
        </p>
      ) : null}

      {lines.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          className="animate-rise"
          action={<Button render={<Link href="/" />}>{t("exploreOffers")}</Button>}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-4">
            <div className="flex flex-col gap-3">
              {groups.map((group, i) => (
                <SellerGroupCard
                  key={group.seller.id}
                  group={group}
                  index={i}
                  onSetQuantity={setQuantity}
                  onRemove={removeWithUndo}
                />
              ))}
            </div>

            {/* Resumo */}
            <section
              aria-label={t("estimatedTotal")}
              className="flex animate-rise flex-col gap-2.5 rounded-3xl bg-card p-4 text-[13.5px] shadow-card lg:sticky lg:top-[calc(var(--header-height)+1rem)]"
              style={{ animationDelay: `${groups.length * 40}ms` }}
            >
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t("products")}</span>
                <span className="font-bold tabular-nums">{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t("shippingAndTaxes")}</span>
                <span className="font-semibold text-muted-foreground">
                  {t("calculatedAtCheckout")}
                </span>
              </div>
              <p className="flex items-start gap-2 rounded-md bg-accent px-3 py-2.5 text-[12.5px] leading-snug font-semibold text-accent-foreground">
                <Package className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden />
                {t("groupedNote")}
              </p>
              <Button
                variant="cta"
                size="lg"
                className="mt-1 hidden w-full lg:inline-flex"
                render={<Link href={isAuthenticated ? "/checkout" : "/entrar?next=/checkout"} />}
              >
                {isAuthenticated ? tc("continue") : t("loginToCheckout")}
              </Button>
            </section>
          </div>

          {/* Barra flutuante (mobile) */}
          <StickyBar tone="ink" className="lg:hidden">
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-xs text-ink-muted">{t("products")}</span>
              <span className="text-lg font-extrabold tabular-nums">{formatMoney(subtotal)}</span>
            </div>
            <Button
              variant="cta"
              className="shrink-0 rounded-[15px] px-5 font-extrabold"
              render={<Link href={isAuthenticated ? "/checkout" : "/entrar?next=/checkout"} />}
            >
              {isAuthenticated ? tc("continue") : t("loginToCheckout")}
            </Button>
          </StickyBar>
          <div className="h-20 lg:hidden" aria-hidden />
        </>
      )}
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------

function SellerGroupCard({
  group,
  index,
  onSetQuantity,
  onRemove,
}: {
  group: CartSellerGroup;
  index: number;
  onSetQuantity: (key: string, quantity: number) => void;
  onRemove: (line: CartLine) => void;
}) {
  const t = useTranslations("cart");
  const tSeller = useTranslations("seller");
  const reached = group.subtotal.amount >= FREE_SHIPPING_THRESHOLD_CENTS;
  const missing = {
    amount: Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - group.subtotal.amount),
    currency: group.subtotal.currency,
  };
  const progress = Math.min(
    100,
    Math.round((group.subtotal.amount / FREE_SHIPPING_THRESHOLD_CENTS) * 100),
  );

  return (
    <section
      aria-label={group.seller.name}
      className="flex animate-rise flex-col gap-3.5 rounded-3xl bg-card p-4 shadow-card"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <Link
        href={`/loja/${group.seller.slug}`}
        className="flex pressable items-center gap-2.5 text-left"
        aria-label={`${group.seller.name} · ${tSeller("viewStore")}`}
      >
        <SellerAvatar seller={group.seller} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-extrabold">{group.seller.name}</span>
          <span className="text-xs text-muted-foreground">
            {t("shippedFrom", { city: group.seller.city })}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-chevron" strokeWidth={2.2} aria-hidden />
      </Link>

      <div
        className={cn(
          "flex flex-col gap-[7px] rounded-lg px-3 py-2.5",
          reached ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
        )}
      >
        <span className="text-[12.5px] font-bold">
          {reached
            ? t("freeShippingReached")
            : t("freeShippingMissing", { amount: formatMoney(missing) })}
        </span>
        <span
          className="flex h-1.5 overflow-hidden rounded-full bg-ink/8"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span
            className="rounded-full bg-current transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </span>
      </div>

      <ul className="flex flex-col gap-3.5">
        {group.lines.map((line) => (
          <li key={line.key} className="flex gap-3">
            <Link
              href={`/produto/${line.slug}`}
              className="relative size-20 shrink-0 pressable overflow-hidden rounded-xl bg-surface"
            >
              <Image src={line.thumbnailUrl} alt="" fill sizes="80px" className="object-cover" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <Link
                href={`/produto/${line.slug}`}
                className="line-clamp-2 text-[13.5px] leading-snug font-semibold hover:text-primary"
              >
                {line.name}
              </Link>
              {line.variantLabel ? (
                <span className="text-xs text-muted-foreground">{line.variantLabel}</span>
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-2">
                <span className="flex flex-col">
                  <span className="text-[15.5px] font-extrabold tabular-nums">
                    {formatMoney({
                      amount: line.unitPrice.amount * line.quantity,
                      currency: line.unitPrice.currency,
                    })}
                  </span>
                  {line.quantity >= line.maxQuantity ? (
                    <span className="text-[11px] text-warning">
                      {t("maxQuantity", { max: line.maxQuantity })}
                    </span>
                  ) : null}
                </span>
                <QuantityStepper
                  size="sm"
                  value={line.quantity}
                  max={line.maxQuantity}
                  allowRemove
                  onRemove={() => onRemove(line)}
                  onChange={(q) => onSetQuantity(line.key, q)}
                  label={line.name}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <footer className="flex justify-between border-t border-border pt-3 text-[13.5px]">
        <span className="text-muted-foreground">{t("subtotalSeller")}</span>
        <span className="font-bold tabular-nums">{formatMoney(group.subtotal)}</span>
      </footer>
    </section>
  );
}

function CartSkeleton() {
  return (
    <PageContainer className="flex flex-col gap-3 pt-5">
      <div className="flex items-baseline justify-between">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3.5 rounded-3xl bg-card p-4 shadow-card">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-[34px] rounded-[11px]" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
          <div className="flex gap-3">
            <Skeleton className="size-20 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="mt-auto h-9 w-28" />
            </div>
          </div>
        </div>
      ))}
    </PageContainer>
  );
}
