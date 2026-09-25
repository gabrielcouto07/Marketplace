"use client";

import { ArrowRight, ShoppingCart, Trash2, WifiOff } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { usePwa } from "@/components/layout/pwa-provider";
import { PageContainer } from "@/components/layout/store-shell";
import { PriceTag } from "@/components/shared/price-tag";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { SellerBadge } from "@/components/shared/seller-badge";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsAuthenticated } from "@/features/auth/store";
import { groupBySeller, selectItemCount, selectSubtotal, useCartStore, type CartLine } from "@/features/cart/store";
import { useExchangeRates } from "@/features/shipping/api";
import { Link } from "@/i18n/navigation";
import { convert, formatMoney } from "@/lib/money";

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
  const hydrated = useCartHydration();
  const lines = useCartStore((s) => s.lines);
  const { setQuantity, remove, removeSeller, add } = useCartStore();
  const isAuthenticated = useIsAuthenticated();
  const { isOnline } = usePwa();
  const rates = useExchangeRates();

  if (!hydrated) return <CartSkeleton />;

  if (lines.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          icon={ShoppingCart}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          className="min-h-[60vh]"
          action={
            <Button variant="cta" size="lg" render={<Link href="/" />}>
              {t("startShopping")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const groups = groupBySeller(lines);
  const subtotal = selectSubtotal(lines);
  const count = selectItemCount(lines);
  const brlToPyg = rates.data?.find((r) => r.from === "BRL" && r.to === "PYG");
  const reference = brlToPyg ? convert(subtotal, brlToPyg) : null;

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
    <PageContainer className="flex flex-col gap-4 pt-4 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="flex flex-col gap-4">
        {!isOnline ? (
          <p role="status" className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            <WifiOff className="size-4 shrink-0" aria-hidden /> {t("offlineNote")}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("groupedNote")}</p>

        {groups.map((group) => (
          <section key={group.seller.id} aria-label={group.seller.name} className="overflow-hidden rounded-xl border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2">
              <span className="text-xs text-muted-foreground">{t("soldBy")}</span>
              <SellerBadge seller={group.seller} className="text-sm font-semibold text-foreground" />
              <button
                type="button"
                onClick={() => {
                  removeSeller(group.seller.id);
                  toast(t("itemRemoved"));
                }}
                aria-label={t("removeSeller")}
                className="ml-auto flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </header>
            <ul className="divide-y divide-border">
              {group.lines.map((line) => (
                <li key={line.key} className="flex gap-3 p-3">
                  <Link href={`/produto/${line.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-surface">
                    <Image src={line.thumbnailUrl} alt="" fill sizes="80px" className="object-cover" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link href={`/produto/${line.slug}`} className="line-clamp-2 text-sm font-medium hover:text-primary">
                      {line.name}
                    </Link>
                    {line.variantLabel ? <span className="text-xs text-muted-foreground">{line.variantLabel}</span> : null}
                    <PriceTag price={{ amount: line.unitPrice.amount * line.quantity, currency: line.unitPrice.currency }} size="sm" />
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <QuantityStepper
                        size="sm"
                        value={line.quantity}
                        max={line.maxQuantity}
                        allowRemove
                        onRemove={() => removeWithUndo(line)}
                        onChange={(q) => setQuantity(line.key, q)}
                        label={line.name}
                      />
                      {line.quantity >= line.maxQuantity ? (
                        <span className="text-[11px] text-warning">{t("maxQuantity", { max: line.maxQuantity })}</span>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t("subtotalSeller")}</span>
              <span className="font-semibold">{formatMoney(group.subtotal)}</span>
            </footer>
          </section>
        ))}

        <Button variant="link" className="self-start px-0" render={<Link href="/" />}>
          {t("continueShopping")}
        </Button>
      </div>

      {/* Resumo: fixo no rodapé (mobile) e card lateral (desktop) */}
      <aside
        aria-label={t("estimatedTotal")}
        className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom))] z-30 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur md:bottom-0 lg:static lg:rounded-xl lg:border lg:bg-card lg:p-4 lg:shadow-none"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 lg:flex-col lg:items-stretch">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{t("subtotal", { count })}</span>
            <span className="text-xl font-bold">{formatMoney(subtotal)}</span>
            {reference ? <span className="text-xs text-muted-foreground">≈ {formatMoney(reference)}</span> : null}
            <span className="text-[11px] text-muted-foreground">{t("shippingCalculated")}</span>
          </div>
          <Button variant="cta" size="lg" className="shrink-0 lg:w-full" render={<Link href={isAuthenticated ? "/checkout" : "/entrar?next=/checkout"} />}>
            {isAuthenticated ? t("checkout") : t("loginToCheckout")}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </aside>
      <div className="h-24 lg:hidden" aria-hidden />
    </PageContainer>
  );
}

function CartSkeleton() {
  return (
    <PageContainer className="flex flex-col gap-4 pt-4">
      <Skeleton className="h-4 w-2/3" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border">
          <Skeleton className="h-10 w-full rounded-b-none" />
          <div className="flex gap-3 p-3">
            <Skeleton className="size-20 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        </div>
      ))}
    </PageContainer>
  );
}
