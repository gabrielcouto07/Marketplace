"use client";

import type { Money } from "@marketplace/contracts";
import { Package, WifiOff } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { usePwa } from "@/components/layout/pwa-provider";
import { PageContainer, StickyBar } from "@/components/layout/store-shell";
import { PriceTag } from "@/components/shared/price-tag";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { SellerAvatar, SellerBadge } from "@/components/shared/seller-badge";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
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
import { formatMoney, sum } from "@/lib/money";

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

/** Soma da referência em guaranis das linhas (≈ ₲). */
function selectReferenceSubtotal(lines: CartLine[]): Money | null {
  const first = lines[0];
  if (!first) return null;
  return sum(
    lines.map((l) => ({
      amount: l.referencePrice.amount * l.quantity,
      currency: l.referencePrice.currency,
    })),
    first.referencePrice.currency,
  );
}

export function CartView() {
  const t = useTranslations("cart");
  const hydrated = useCartHydration();
  const lines = useCartStore((s) => s.lines);
  const { setQuantity, remove, add } = useCartStore();
  const isAuthenticated = useIsAuthenticated();
  const { isOnline } = usePwa();

  if (!hydrated) return <CartSkeleton />;

  const groups = groupBySeller(lines);
  const subtotal = selectSubtotal(lines);
  const referenceSubtotal = selectReferenceSubtotal(lines);
  const count = selectItemCount(lines);
  const checkoutHref = isAuthenticated ? "/checkout" : "/entrar?next=/checkout";

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

  if (lines.length === 0) {
    return (
      <PageContainer className="pt-4">
        {!isOnline ? <OfflineNote /> : null}
        <EmptyState
          illustration="bag"
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button variant="primary" render={<Link href="/" />}>
              {t("exploreOffers")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-4 pt-4">
      <p className="text-caption text-foreground-secondary tabular-nums">
        {t("itemCount", { count })}
      </p>

      {!isOnline ? <OfflineNote /> : null}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_20rem] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <SellerGroupCard
              key={group.seller.id}
              group={group}
              onSetQuantity={setQuantity}
              onRemove={removeWithUndo}
            />
          ))}
        </div>

        {/* Resumo (desktop) */}
        <section
          aria-label={t("estimatedTotal")}
          className="hidden flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:flex"
        >
          <dl className="flex flex-col gap-2 text-body-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-foreground-secondary">{t("products")}</dt>
              <dd className="font-medium text-foreground tabular-nums">{formatMoney(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-foreground-secondary">{t("shippingAndTaxes")}</dt>
              <dd className="text-foreground-muted">{t("calculatedAtCheckout")}</dd>
            </div>
          </dl>
          {referenceSubtotal ? (
            <p className="text-caption text-foreground-muted tabular-nums">
              ≈ {formatMoney(referenceSubtotal)}
            </p>
          ) : null}
          <p className="flex items-start gap-2 text-caption text-foreground-secondary">
            <Package
              className="mt-px size-4 shrink-0 text-primary"
              strokeWidth={1.75}
              aria-hidden
            />
            {t("groupedNote")}
          </p>
          <Button variant="cta" fullWidth render={<Link href={checkoutHref} />}>
            {t("checkoutCta")}
          </Button>
        </section>
      </div>

      <p className="flex items-start gap-2 text-caption text-foreground-secondary lg:hidden">
        <Package className="mt-px size-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
        {t("groupedNote")}
      </p>

      {/* Espaço para a barra fixa não cobrir o conteúdo no mobile. */}
      <div className="h-24 lg:hidden" aria-hidden />

      {/* Barra fixa (mobile/tablet): subtotal + único CTA vermelho da tela */}
      <StickyBar tone="light" aboveBottomNav className="lg:hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-caption text-foreground-secondary">{t("subtotalLabel")}</span>
          <span className="text-title-3 text-foreground tabular-nums">{formatMoney(subtotal)}</span>
          {referenceSubtotal ? (
            <span className="text-caption text-foreground-muted tabular-nums">
              ≈ {formatMoney(referenceSubtotal)}
            </span>
          ) : null}
        </div>
        <Button variant="cta" className="shrink-0" render={<Link href={checkoutHref} />}>
          {t("checkoutCta")}
        </Button>
      </StickyBar>
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------

function OfflineNote() {
  const t = useTranslations("cart");
  return (
    <p
      role="status"
      className="mb-4 flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-body-sm text-warning"
    >
      <WifiOff className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      {t("offlineNote")}
    </p>
  );
}

function SellerGroupCard({
  group,
  onSetQuantity,
  onRemove,
}: {
  group: CartSellerGroup;
  onSetQuantity: (key: string, quantity: number) => void;
  onRemove: (line: CartLine) => void;
}) {
  const t = useTranslations("cart");
  const reached = group.subtotal.amount >= FREE_SHIPPING_THRESHOLD_CENTS;
  const missing: Money = {
    amount: Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - group.subtotal.amount),
    currency: group.subtotal.currency,
  };

  return (
    <section
      aria-label={group.seller.name}
      className="rounded-lg border border-border bg-surface shadow-xs"
    >
      <header className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <SellerAvatar seller={group.seller} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col">
            <SellerBadge
              seller={group.seller}
              variant="inline"
              className="text-body-sm font-medium text-foreground"
            />
            <span className="text-caption text-foreground-secondary">
              {t("shippedFrom", { city: group.seller.city })}
            </span>
          </div>
        </div>
        <Badge variant={reached ? "success" : "warning"}>
          {reached
            ? t("freeShippingReached")
            : t("freeShippingMissing", { amount: formatMoney(missing) })}
        </Badge>
      </header>

      <ul className="divide-y divide-border border-t border-border">
        {group.lines.map((line) => (
          <li key={line.key} className="flex gap-3 p-4">
            <Link
              href={`/produto/${line.slug}`}
              className="relative size-16 shrink-0 pressable overflow-hidden rounded-md bg-surface-muted focus-ring"
            >
              <Image src={line.thumbnailUrl} alt="" fill sizes="64px" className="object-contain" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-col">
                <Link
                  href={`/produto/${line.slug}`}
                  className="line-clamp-2 text-body-sm text-foreground focus-ring transition-colors hover:text-primary"
                >
                  {line.name}
                </Link>
                {line.variantLabel ? (
                  <span className="text-caption text-foreground-secondary">
                    {line.variantLabel}
                  </span>
                ) : null}
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <PriceTag
                    size="sm"
                    price={{
                      amount: line.unitPrice.amount * line.quantity,
                      currency: line.unitPrice.currency,
                    }}
                  />
                  {line.quantity >= line.maxQuantity ? (
                    <span className="text-caption text-warning">
                      {t("maxQuantity", { max: line.maxQuantity })}
                    </span>
                  ) : null}
                </div>
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

      <footer className="flex justify-between gap-3 border-t border-border p-4 text-body-sm">
        <span className="text-foreground-secondary">{t("subtotalSeller")}</span>
        <span className="font-medium text-foreground tabular-nums">
          {formatMoney(group.subtotal)}
        </span>
      </footer>
    </section>
  );
}

function CartSkeleton() {
  return (
    <PageContainer className="flex flex-col gap-4 pt-4">
      <Skeleton className="h-4 w-16" />
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface shadow-xs">
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-6 w-48 rounded-sm" />
          </div>
          <div className="flex gap-3 border-t border-border p-4">
            <Skeleton className="size-16" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/2" />
              <div className="mt-auto flex items-end justify-between">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          </div>
          <div className="flex justify-between border-t border-border p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </PageContainer>
  );
}
