"use client";

import type { ProductDetailDto, ShippingQuoteDto } from "@marketplace/contracts";
import { Share2, ShoppingCart } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageContainer, StickyBar } from "@/components/layout/store-shell";
import { CepShippingCalculator } from "@/components/shared/cep-shipping-calculator";
import { FavoriteButton } from "@/components/shared/favorite-button";
import { PriceTag } from "@/components/shared/price-tag";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { RatingStars } from "@/components/shared/rating-stars";
import { SellerBadge } from "@/components/shared/seller-badge";
import { ErrorState } from "@/components/shared/states";
import { DeliveryWindow, GuaranteeBadge, ImportTaxLine } from "@/components/shared/trust-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/features/catalog/api";
import { useCartStore } from "@/features/cart/store";
import { useSeller } from "@/features/seller/api";
import { useExchangeRates } from "@/features/shipping/api";
import { Link, useRouter } from "@/i18n/navigation";
import { multiplyBasisPoints } from "@/lib/money";
import { cn } from "@/lib/utils";

import { ProductGallery } from "./product-gallery";
import { ProductQuestions } from "./product-questions";
import { ProductReviews } from "./product-reviews";
import { VariantSelector, findVariant } from "./variant-selector";

const CARD = "rounded-lg border border-border bg-surface p-4 shadow-xs";

/**
 * Estimativa informativa dos impostos de importação (60 %), a mesma usada pelo mock do checkout.
 * Com o backend .NET, o valor exato vem na cotação do checkout (`estimatedImportTax`).
 */
const IMPORT_TAX_RATE_PERCENT = 60;

export function ProductView({ slug }: { slug: string }) {
  const { data, isPending, isError, error, refetch } = useProduct(slug);

  if (isError) {
    return (
      <PageContainer className="py-4">
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
  const variant = useMemo(
    () => findVariant(product.variants, selection, product.variantOptions),
    [product, selection],
  );
  const needsVariant = product.variantOptions.length > 0;
  const price = variant?.price ?? product.price;
  const compareAt = variant ? variant.compareAtPrice : product.compareAtPrice;
  const stock = needsVariant ? (variant?.stock ?? 0) : product.stock;
  // Quantidade "amarrada" à variante: troca de variante reinicia para 1 sem useEffect (padrão de estado derivado).
  const [quantityState, setQuantityState] = useState<{
    variantId: string | undefined;
    value: number;
  }>({ variantId: variant?.id, value: 1 });
  const quantity = quantityState.variantId === variant?.id ? quantityState.value : 1;
  const setQuantity = (value: number) => setQuantityState({ variantId: variant?.id, value });

  const rate = rates.data?.find((r) => r.from === "BRL" && r.to === "PYG");
  const referencePrice = rate
    ? {
        amount: Math.round((price.amount * rate.numerator) / rate.denominator),
        currency: "PYG" as const,
      }
    : product.referencePrice;
  const variantLabel = variant ? Object.values(variant.attributes).join(" / ") : null;
  const canBuy = stock > 0 && (!needsVariant || Boolean(variant));

  // Última cotação de frete: alimenta o prazo de entrega do bloco de confiança.
  const [quote, setQuote] = useState<ShippingQuoteDto | null>(null);
  const cheapest =
    quote?.options.reduce<ShippingQuoteDto["options"][number] | null>(
      (min, o) => (!min || o.price.amount < min.price.amount ? o : min),
      null,
    ) ?? null;
  const deliveryRange = cheapest?.estimatedDays ?? product.handlingDays;
  const importTax = multiplyBasisPoints(
    { amount: price.amount * quantity, currency: price.currency },
    IMPORT_TAX_RATE_PERCENT * 100,
  );

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
    toast.success(t("addedToCart"), {
      action: { label: t("viewCart"), onClick: () => router.push("/carrinho") },
    });
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
    <PageContainer className="lg:pt-6">
      <nav
        aria-label="breadcrumb"
        className="mb-4 hidden text-caption text-foreground-muted lg:block"
      >
        <ol className="flex items-center gap-1">
          <li>
            <Link href="/" className="transition-colors hover:text-primary">
              {tc("siteName")}
            </Link>
          </li>
          {product.categoryPath.map((c) => (
            <li key={c.id} className="flex items-center gap-1">
              <span aria-hidden>/</span>
              <Link href={`/categoria/${c.slug}`} className="transition-colors hover:text-primary">
                {c.name}
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <div className="lg:grid lg:grid-cols-2 lg:grid-rows-[auto_auto] lg:items-start lg:gap-x-8 lg:gap-y-4">
        {/* Galeria: sangra até as bordas no mobile; coluna esquerda no desktop. */}
        <ProductGallery
          images={product.images}
          name={product.name}
          className="-mx-4 lg:col-start-1 lg:row-start-1 lg:mx-0"
          topRight={
            <>
              <Button variant="floating" size="icon" aria-label={t("share")} onClick={share}>
                <Share2 strokeWidth={1.75} />
              </Button>
              <FavoriteButton product={product} size="md" />
            </>
          }
        />

        {/* Compra, confiança, frete e loja: coluna direita no desktop. */}
        <div className="mt-4 flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
          <section aria-labelledby="product-title" className={cn(CARD, "flex flex-col gap-4")}>
            <div className="flex flex-col gap-2">
              <SellerBadge seller={product.seller} variant="pill" className="self-start" />
              <h1 id="product-title" className="text-title-3 text-pretty text-foreground">
                {product.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-foreground-secondary">
                <RatingStars value={product.rating} count={product.reviewCount} size="sm" />
                {product.soldCount > 0 ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      {tcat("soldCompact", {
                        count: format.number(product.soldCount, { notation: "compact" }),
                      })}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <PriceTag
                price={price}
                compareAtPrice={compareAt}
                referencePrice={referencePrice}
                size="lg"
                installments="long"
                showDiscountBadge
              />
              <p className="text-caption text-foreground-muted">
                {t("priceNote")}
                {rate ? ` · ${t("priceLocked", { rate: rate.displayRate })}` : null}
              </p>
            </div>

            {needsVariant ? (
              <VariantSelector
                options={product.variantOptions}
                variants={product.variants}
                selection={selection}
                onChange={setSelection}
                className="border-t border-border pt-4"
              />
            ) : null}

            <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
              <div className="flex min-w-0 flex-col items-start gap-1">
                <span className="text-body-sm font-medium text-foreground">{t("quantity")}</span>
                {stock <= 0 ? (
                  <Badge variant="inverse">{t("outOfStock")}</Badge>
                ) : stock <= 5 ? (
                  <Badge variant="warning">{t("lowStock")}</Badge>
                ) : (
                  <span className="text-caption text-foreground-secondary">
                    {t("stockCount", { count: stock })}
                  </span>
                )}
              </div>
              <QuantityStepper
                value={quantity}
                min={1}
                max={Math.max(1, stock)}
                onChange={setQuantity}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Button variant="secondary" fullWidth disabled={!canBuy} onClick={onAddToCart}>
                <ShoppingCart data-icon="inline-start" strokeWidth={1.75} /> {t("addToCart")}
              </Button>
              {/* No mobile o CTA vermelho vive na barra fixa; aqui só a partir de lg. */}
              <Button
                variant="cta"
                fullWidth
                disabled={!canBuy}
                onClick={onBuyNow}
                className="hidden lg:inline-flex"
              >
                {t("buyNow")}
              </Button>
            </div>
          </section>

          <section aria-label={t("trustTitle")} className={cn(CARD, "flex flex-col gap-4")}>
            <div className="flex flex-col divide-y divide-border">
              <GuaranteeBadge className="pb-4" />
              <DeliveryWindow range={deliveryRange} className="py-4" />
              <ImportTaxLine
                amount={importTax}
                ratePercent={IMPORT_TAX_RATE_PERCENT}
                className="pt-4"
              />
            </div>
            <p className="text-caption text-foreground-muted">{t("taxHint")}</p>
          </section>

          <section aria-labelledby="shipping-title" className={cn(CARD, "flex flex-col gap-4")}>
            <div className="flex flex-col gap-1">
              <h2 id="shipping-title" className="text-title-3 text-foreground">
                {t("shippingTitle")}
              </h2>
              <p className="text-caption text-foreground-secondary">
                {t("shippingFrom", { city: product.originCity })} ·{" "}
                {t("handlingDays", {
                  min: product.handlingDays.min,
                  max: product.handlingDays.max,
                })}
              </p>
            </div>
            <CepShippingCalculator
              sellerId={product.seller.id}
              items={shippingItems}
              onQuote={setQuote}
            />
          </section>

          <section aria-labelledby="seller-title" className="flex flex-col gap-2">
            <h2 id="seller-title" className="sr-only">
              {t("sellerTitle")}
            </h2>
            <SellerBadge
              seller={product.seller}
              variant="card"
              metrics={seller.data?.metrics ?? null}
            />
          </section>
        </div>

        {/* Descrição, avaliações e perguntas: abaixo no mobile; coluna esquerda no desktop. */}
        <div className="mt-4 flex flex-col gap-4 lg:col-start-1 lg:row-start-2 lg:mt-0">
          <section aria-labelledby="description-title" className={cn(CARD, "flex flex-col gap-4")}>
            <h2 id="description-title" className="text-title-3 text-foreground">
              {t("description")}
            </h2>
            <p className="text-body leading-relaxed text-pretty whitespace-pre-line text-foreground-secondary">
              {product.description}
            </p>
            {product.attributes.length > 0 || product.warrantyMonths ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 className="text-body-sm font-medium text-foreground">{t("specs")}</h3>
                <dl className="flex flex-col divide-y divide-border">
                  {product.attributes.map((a) => (
                    <SpecRow key={a.name} name={a.name} value={a.value} />
                  ))}
                  {product.warrantyMonths ? (
                    <SpecRow
                      name={t("warrantyLabel")}
                      value={t("warranty", { months: product.warrantyMonths })}
                    />
                  ) : null}
                </dl>
              </div>
            ) : null}
          </section>

          <ProductReviews productId={product.id} />
          <ProductQuestions productId={product.id} productSlug={product.slug} />
        </div>
      </div>

      {/* Espaço para a barra fixa não cobrir o conteúdo no mobile. */}
      <div className="h-20 lg:hidden" aria-hidden />

      <StickyBar tone="light" aboveBottomNav className="lg:hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <PriceTag price={price} size="sm" />
          <span className="truncate text-caption text-foreground-secondary">
            {stock > 0 ? (variantLabel ?? t("installments")) : t("outOfStock")}
          </span>
        </div>
        <Button variant="cta" className="min-w-40" disabled={!canBuy} onClick={onBuyNow}>
          {t("buyNow")}
        </Button>
      </StickyBar>
    </PageContainer>
  );
}

function SpecRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3 text-body-sm first:pt-0 last:pb-0">
      <dt className="text-foreground-secondary">{name}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

/** Skeleton no formato exato: galeria quadrada + miniaturas e o card de compra. */
function ProductSkeleton() {
  return (
    <PageContainer className="lg:pt-6">
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
        <div className="-mx-4 flex flex-col gap-4 lg:mx-0">
          <Skeleton className="aspect-square w-full rounded-none lg:rounded-lg" />
          <div className="flex gap-2 px-4 lg:px-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="size-16 rounded-md" />
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-4 lg:mt-0">
          <div className={cn(CARD, "flex flex-col gap-4")}>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-32 rounded-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-44" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3.5 w-48" />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-12 w-32" />
            </div>
            <Skeleton className="h-12 w-full" />
          </div>
          <div className={cn(CARD, "flex flex-col divide-y divide-border")}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
