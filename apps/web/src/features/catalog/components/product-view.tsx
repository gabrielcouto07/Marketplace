"use client";

import type { ProductDetailDto } from "@marketplace/contracts";
import { Check, Package, Share2, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { CepShippingCalculator } from "@/components/shared/cep-shipping-calculator";
import { FavoriteButton } from "@/components/shared/favorite-button";
import { PriceTag } from "@/components/shared/price-tag";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { RatingStars } from "@/components/shared/rating-stars";
import { SellerBadge } from "@/components/shared/seller-badge";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/features/catalog/api";
import { useCartStore } from "@/features/cart/store";
import { useSeller } from "@/features/seller/api";
import { useExchangeRates } from "@/features/shipping/api";
import { Link, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

import { ProductGallery } from "./product-gallery";
import { ProductQuestions } from "./product-questions";
import { ProductReviews } from "./product-reviews";
import { VariantSelector, findVariant } from "./variant-selector";

export function ProductView({ slug }: { slug: string }) {
  const { data, isPending, isError, error, refetch } = useProduct(slug);

  if (isError) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={() => refetch()} className="min-h-[60vh]" />
      </PageContainer>
    );
  }
  if (isPending) return <ProductSkeleton />;
  return <ProductContent product={data} />;
}

function ProductContent({ product }: { product: ProductDetailDto }) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  const tcat = useTranslations("catalog");
  const format = useFormatter();
  const router = useRouter();
  const addToCart = useCartStore((s) => s.add);
  const rates = useExchangeRates();
  const seller = useSeller(product.seller.slug);

  // Seleção de variação: pré-seleciona a primeira combinação com estoque.
  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const first = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
    return first ? { ...first.attributes } : {};
  });
  const variant = useMemo(() => findVariant(product.variants, selection, product.variantOptions), [product, selection]);
  const needsVariant = product.variantOptions.length > 0;
  const price = variant?.price ?? product.price;
  const compareAt = variant ? variant.compareAtPrice : product.compareAtPrice;
  const stock = needsVariant ? (variant?.stock ?? 0) : product.stock;
  // Quantidade "amarrada" à variante: troca de variante reinicia para 1 sem useEffect (padrão de estado derivado).
  const [quantityState, setQuantityState] = useState<{ variantId: string | undefined; value: number }>({ variantId: variant?.id, value: 1 });
  const quantity = quantityState.variantId === variant?.id ? quantityState.value : 1;
  const setQuantity = (value: number) => setQuantityState({ variantId: variant?.id, value });

  const rate = rates.data?.find((r) => r.from === "BRL" && r.to === "PYG");
  const referencePrice = rate
    ? { amount: Math.round((price.amount * rate.numerator) / rate.denominator), currency: "PYG" as const }
    : product.referencePrice;
  const variantLabel = variant ? Object.values(variant.attributes).join(" / ") : null;
  const canBuy = stock > 0 && (!needsVariant || Boolean(variant));

  const add = () => {
    addToCart({
      product: { ...product, price, stock },
      variantId: variant?.id ?? null,
      variantLabel,
      unitPrice: price,
      quantity,
      maxQuantity: stock,
    });
  };

  const onAddToCart = () => {
    add();
    toast.success(t("addedToCart"), { action: { label: t("viewCart"), onClick: () => router.push("/carrinho") } });
  };

  const onBuyNow = () => {
    add();
    router.push("/carrinho");
  };

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, url });
        return;
      } catch {
        /* cancelado */
      }
    }
    await navigator.clipboard.writeText(url);
    toast(t("linkCopied"));
  };

  const shippingItems = [{ productId: product.id, variantId: variant?.id ?? null, quantity }];

  return (
    <PageContainer className="pt-2 sm:pt-4">
      <nav aria-label="breadcrumb" className="mb-2 hidden text-xs text-muted-foreground sm:block">
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/" className="hover:text-primary">
              {tc("siteName")}
            </Link>
          </li>
          {product.categoryPath.map((c) => (
            <li key={c.id} className="flex items-center gap-1">
              <span aria-hidden>/</span>
              <Link href={`/categoria/${c.slug}`} className="hover:text-primary">
                {c.name}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <ProductGallery
          images={product.images}
          name={product.name}
          discountPercent={product.discountPercent}
          overlay={
            <>
              <FavoriteButton product={product} size="md" />
              <button
                type="button"
                onClick={share}
                aria-label={t("share")}
                className="flex size-11 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-sm ring-1 ring-black/5 hover:bg-white dark:bg-neutral-800/90 dark:text-neutral-100"
              >
                <Share2 className="size-5" />
              </button>
            </>
          }
        />

        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {product.isNew ? <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">{tcat("newBadge")}</span> : null}
              <span>{t("soldCount", { count: product.soldCount })}</span>
            </div>
            <h1 className="text-xl leading-snug font-bold tracking-tight sm:text-2xl">{product.name}</h1>
            <div className="mt-2 flex items-center gap-2">
              <RatingStars value={product.rating} count={product.reviewCount} size="sm" />
              <a href="#reviews-title" className="text-xs text-primary hover:underline">
                {t("reviewsTitle")}
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <PriceTag price={price} compareAtPrice={compareAt} referencePrice={referencePrice} size="lg" showInstallments />
            <p className="mt-2 text-xs text-muted-foreground">
              {t("priceReference")}
              {rate ? ` · ${t("priceLocked", { rate: rate.displayRate })}` : null}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden /> {t("importTaxNote")}
            </p>
            {product.freeShipping ? (
              <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-success">
                <Truck className="size-4" aria-hidden /> {t("freeShippingLabel")}
              </p>
            ) : null}
          </div>

          <VariantSelector options={product.variantOptions} variants={product.variants} selection={selection} onChange={setSelection} />

          <div className="flex flex-wrap items-center gap-4">
            <QuantityStepper value={quantity} min={1} max={Math.max(1, stock)} onChange={setQuantity} />
            <p className={cn("text-sm", stock <= 0 ? "font-semibold text-destructive" : stock <= 5 ? "font-medium text-warning" : "text-muted-foreground")}>
              {stock <= 0 ? t("outOfStock") : stock <= 5 ? t("lowStock") : t("inStock", { count: stock })}
            </p>
          </div>

          <div className="hidden gap-2 md:flex">
            <Button variant="cta" size="lg" className="flex-1" disabled={!canBuy} onClick={onBuyNow}>
              {t("buyNow")}
            </Button>
            <Button variant="outline" size="lg" className="flex-1" disabled={!canBuy} onClick={onAddToCart}>
              <ShoppingCart data-icon="inline-start" /> {t("addToCart")}
            </Button>
          </div>

          <CepShippingCalculator sellerId={product.seller.id} items={shippingItems} />

          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li className="flex items-center gap-2 text-muted-foreground">
              <Package className="size-4 shrink-0 text-primary" aria-hidden /> {t("shippingFrom", { city: product.originCity })}
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <Truck className="size-4 shrink-0 text-primary" aria-hidden /> {t("handlingDays", { min: product.handlingDays.min, max: product.handlingDays.max })}
            </li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />{" "}
              {product.warrantyMonths ? t("warranty", { months: product.warrantyMonths }) : t("noWarranty")}
            </li>
          </ul>

          <section aria-labelledby="seller-title" className="flex flex-col gap-2">
            <h2 id="seller-title" className="text-sm font-semibold">
              {t("sellerTitle")}
            </h2>
            <SellerBadge seller={product.seller} variant="card" />
            {seller.data ? (
              <ul className="grid grid-cols-3 gap-2 text-center text-xs">
                <li className="rounded-lg bg-surface p-2">
                  <span className="block text-base font-bold">{format.number(seller.data.metrics.salesCount)}</span>
                  <span className="text-muted-foreground">{t("metricSales")}</span>
                </li>
                <li className="rounded-lg bg-surface p-2">
                  <span className="block text-base font-bold text-success">{seller.data.metrics.positiveRatingPercent}%</span>
                  <span className="text-muted-foreground">{t("metricPositive")}</span>
                </li>
                <li className="rounded-lg bg-surface p-2">
                  <span className="block text-base font-bold">{seller.data.metrics.onTimeShippingPercent}%</span>
                  <span className="text-muted-foreground">{t("metricOnTime")}</span>
                </li>
              </ul>
            ) : null}
          </section>
        </div>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="description-title">
            <h2 id="description-title" className="mb-3 text-lg font-bold">
              {t("description")}
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{product.description}</p>
          </section>

          <ProductReviews productId={product.id} />
          <ProductQuestions productId={product.id} productSlug={product.slug} />
        </div>

        <aside>
          <section aria-labelledby="specs-title">
            <h2 id="specs-title" className="mb-3 text-lg font-bold">
              {t("specs")}
            </h2>
            <dl className="overflow-hidden rounded-xl border border-border text-sm">
              {product.attributes.map((a, i) => (
                <div key={a.name} className={cn("grid grid-cols-[40%_1fr] gap-2 px-3 py-2", i % 2 === 0 && "bg-surface")}>
                  <dt className="text-muted-foreground">{a.name}</dt>
                  <dd className="font-medium">{a.value}</dd>
                </div>
              ))}
              {product.warrantyMonths ? (
                <div className={cn("grid grid-cols-[40%_1fr] gap-2 px-3 py-2", product.attributes.length % 2 === 0 && "bg-surface")}>
                  <dt className="text-muted-foreground">{t("warrantyLabel")}</dt>
                  <dd className="font-medium">{t("warranty", { months: product.warrantyMonths })}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>

      {/* Barra fixa mobile */}
      <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom))] z-30 border-t border-border bg-background/95 p-3 backdrop-blur supports-backdrop-filter:bg-background/85 md:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg leading-tight font-bold">{formatMoney(price)}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {stock > 0 ? (
                <>
                  <Check className="inline size-3 text-success" aria-hidden /> {variantLabel ?? t("installments")}
                </>
              ) : (
                t("outOfStock")
              )}
            </p>
          </div>
          <Button variant="outline" size="icon-lg" aria-label={t("addToCart")} disabled={!canBuy} onClick={onAddToCart}>
            <ShoppingCart />
          </Button>
          <Button variant="cta" size="lg" disabled={!canBuy} onClick={onBuyNow}>
            {t("buyNow")}
          </Button>
        </div>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </PageContainer>
  );
}

function ProductSkeleton() {
  return (
    <PageContainer className="pt-2 sm:pt-4">
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <Skeleton className="-mx-4 aspect-square rounded-none sm:mx-0 sm:rounded-2xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-11 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    </PageContainer>
  );
}
