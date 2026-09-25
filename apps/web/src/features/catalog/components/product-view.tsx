"use client";

import type { ProductDetailDto, ShippingQuoteDto } from "@marketplace/contracts";
import { ChevronRight, Share2, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageContainer, StickyBar } from "@/components/layout/store-shell";
import { BackButton } from "@/components/shared/back-button";
import { CepShippingCalculator } from "@/components/shared/cep-shipping-calculator";
import { FavoriteButton } from "@/components/shared/favorite-button";
import { PriceTag } from "@/components/shared/price-tag";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { RatingStars } from "@/components/shared/rating-stars";
import {
  OfficialBadge,
  ReputationMeter,
  SellerAvatar,
  SellerBadge,
} from "@/components/shared/seller-badge";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/features/catalog/api";
import { useCartStore } from "@/features/cart/store";
import { useSeller } from "@/features/seller/api";
import { useExchangeRates } from "@/features/shipping/api";
import { Link, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { categoryHue } from "@/lib/palette";
import { cn } from "@/lib/utils";
import { formatCep } from "@/lib/validation/documents";

import { ProductGallery } from "./product-gallery";
import { ProductQuestions } from "./product-questions";
import { ProductReviews } from "./product-reviews";
import { VariantSelector, findVariant } from "./variant-selector";

const CARD = "rounded-3xl bg-card p-4.5 shadow-card";

export function ProductView({ slug }: { slug: string }) {
  const { data, isPending, isError, error, refetch } = useProduct(slug);

  if (isError) {
    return (
      <PageContainer className="pt-4">
        <BackButton className="mb-4" />
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
  const ts = useTranslations("seller");
  const format = useFormatter();
  const router = useRouter();
  const addToCart = useCartStore((s) => s.add);
  const rates = useExchangeRates();
  const seller = useSeller(product.seller.slug);
  const hue = categoryHue(product.categoryPath.at(-1)?.slug ?? product.categoryId);

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

  // Última cotação de frete: alimenta o título "Frete a partir de…" e o prazo estimado.
  const [quote, setQuote] = useState<ShippingQuoteDto | null>(null);
  const cheapest =
    quote?.options.reduce<ShippingQuoteDto["options"][number] | null>(
      (min, o) => (!min || o.price.amount < min.price.amount ? o : min),
      null,
    ) ?? null;

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
  const stockHint =
    stock <= 0 ? t("outOfStock") : stock <= 5 ? t("lowStock") : t("stockCount", { count: stock });

  return (
    <PageContainer className="lg:pt-5">
      <nav aria-label="breadcrumb" className="mb-3 hidden text-xs text-muted-foreground lg:block">
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

      <div className="lg:grid lg:grid-cols-2 lg:grid-rows-[auto_auto] lg:items-start lg:gap-x-8 lg:gap-y-2.5">
        {/* Galeria: sangra até as bordas no mobile; coluna esquerda no desktop. */}
        <ProductGallery
          images={product.images}
          name={product.name}
          hue={hue}
          className="-mx-4 lg:col-start-1 lg:row-start-1 lg:mx-0"
          topLeft={
            <BackButton fallbackHref={`/categoria/${product.categoryPath.at(-1)?.slug ?? ""}`} />
          }
          topRight={
            <>
              <Button variant="white" size="icon" aria-label={t("share")} onClick={share}>
                <Share2 className="size-[19px]" />
              </Button>
              <FavoriteButton product={product} size="md" />
            </>
          }
        />

        {/* Cards de compra: sobem 24 px sobre a galeria no mobile; coluna direita no desktop. */}
        <div className="relative -mt-6 flex flex-col gap-2.5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
          {/* a. Título e preço */}
          <section
            aria-labelledby="product-title"
            className={cn(CARD, "flex animate-rise flex-col gap-3 pt-5")}
          >
            <SellerBadge seller={product.seller} variant="pill" className="self-start" />
            <h1
              id="product-title"
              className="text-[21px] leading-[1.25] font-bold tracking-[-0.015em] text-pretty"
            >
              {product.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted-foreground">
              <RatingStars
                value={product.rating}
                count={product.reviewCount}
                size="sm"
                variant="full"
              />
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
            <div className="flex flex-col gap-0.5 pt-1">
              <PriceTag
                price={price}
                compareAtPrice={compareAt}
                referencePrice={referencePrice}
                size="lg"
                installments="long"
                showDiscountBadge
              />
              <p className="text-[12.5px] text-muted-foreground">
                {t("priceReference")}
                {rate ? ` · ${t("priceLocked", { rate: rate.displayRate })}` : null}
              </p>
            </div>
          </section>

          {/* b. Opções e quantidade */}
          <section
            aria-label={t("quantity")}
            className={cn(CARD, "flex animate-rise flex-col gap-3.5")}
            style={{ animationDelay: "40ms" }}
          >
            <VariantSelector
              options={product.variantOptions}
              variants={product.variants}
              selection={selection}
              onChange={setSelection}
            />
            <div
              className={cn(
                "flex items-center justify-between gap-3",
                needsVariant && "border-t border-border pt-3.5",
              )}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-bold">{t("quantity")}</span>
                <span
                  className={cn(
                    "text-[12.5px]",
                    stock <= 0
                      ? "font-bold text-destructive"
                      : stock <= 5
                        ? "font-semibold text-warning"
                        : "text-muted-foreground",
                  )}
                >
                  {stockHint}
                </span>
              </div>
              <QuantityStepper
                value={quantity}
                min={1}
                max={Math.max(1, stock)}
                onChange={setQuantity}
              />
            </div>
          </section>

          {/* c. Frete e impostos */}
          <section
            aria-label={t("shippingTitle")}
            className={cn(CARD, "flex animate-rise flex-col py-1.5")}
            style={{ animationDelay: "80ms" }}
          >
            <div className="flex flex-col gap-3 border-b border-border py-3.5">
              <div className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-success-soft text-success">
                  <Truck className="size-5" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-bold">
                    {product.freeShipping
                      ? t("freeShippingLabel")
                      : cheapest
                        ? t("shippingFromPrice", {
                            price:
                              cheapest.price.amount === 0
                                ? t("freeShippingLabel")
                                : formatMoney(cheapest.price),
                          })
                        : t("shippingTitle")}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">
                    {quote && cheapest
                      ? `${t("arrivesIn", { min: cheapest.estimatedDays.min, max: cheapest.estimatedDays.max, cep: formatCep(quote.postalCode) })} · ${t("shippingFrom", { city: product.originCity })}`
                      : `${t("shippingFrom", { city: product.originCity })} · ${t("handlingDays", { min: product.handlingDays.min, max: product.handlingDays.max })}`}
                  </span>
                </div>
              </div>
              <CepShippingCalculator
                sellerId={product.seller.id}
                items={shippingItems}
                onQuote={setQuote}
              />
            </div>
            <div className="flex gap-3 py-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-accent text-primary">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-bold">{t("importTaxNote")}</span>
                <span className="text-[12.5px] text-muted-foreground">{t("taxHint")}</span>
              </div>
            </div>
          </section>

          {/* d. Vendedor */}
          <Link
            href={`/loja/${product.seller.slug}`}
            aria-label={t("sellerCard", { name: product.seller.name })}
            className={cn(
              CARD,
              "flex pressable animate-rise flex-col gap-3.5 transition-shadow hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
            style={{ animationDelay: "120ms" }}
          >
            <span className="flex items-center gap-3">
              <SellerAvatar seller={product.seller} size="lg" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[15px] font-extrabold">{product.seller.name}</span>
                  {product.seller.isOfficialStore ? <OfficialBadge /> : null}
                </span>
                <span className="truncate text-[12.5px] text-muted-foreground">
                  {product.seller.city}
                  {seller.data
                    ? ` · ${ts("sales", { count: seller.data.metrics.salesCount })}`
                    : null}
                </span>
              </span>
              <ChevronRight
                className="size-[18px] shrink-0 text-chevron"
                strokeWidth={2.2}
                aria-hidden
              />
            </span>
            <ReputationMeter level={product.seller.reputationLevel} />
            {seller.data ? (
              <span className="grid grid-cols-3 gap-2">
                <MetricTile
                  value={`${seller.data.metrics.positiveRatingPercent}%`}
                  label={t("metricPositive")}
                  tone="success"
                />
                <MetricTile
                  value={`${seller.data.metrics.onTimeShippingPercent}%`}
                  label={t("metricOnTime")}
                />
                <MetricTile
                  value={t("responseHours", { hours: seller.data.metrics.avgResponseTimeHours })}
                  label={t("metricResponse")}
                />
              </span>
            ) : seller.isPending ? (
              <span className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-[58px] rounded-lg" />
                ))}
              </span>
            ) : null}
          </Link>
        </div>

        {/* Descrição, avaliações e perguntas: abaixo no mobile; coluna esquerda no desktop. */}
        <div className="mt-2.5 flex flex-col gap-2.5 lg:col-start-1 lg:row-start-2 lg:mt-0">
          <section
            aria-labelledby="description-title"
            className={cn(CARD, "flex animate-rise flex-col gap-3")}
            style={{ animationDelay: "160ms" }}
          >
            <h2 id="description-title" className="text-base font-extrabold tracking-tight">
              {t("description")}
            </h2>
            <p className="text-sm leading-relaxed text-pretty whitespace-pre-line text-body">
              {product.description}
            </p>
            {product.attributes.length > 0 || product.warrantyMonths ? (
              <dl className="mt-1 flex flex-col overflow-hidden rounded-lg" aria-label={t("specs")}>
                {product.attributes.map((a, i) => (
                  <SpecRow key={a.name} name={a.name} value={a.value} zebra={i % 2 === 0} />
                ))}
                {product.warrantyMonths ? (
                  <SpecRow
                    name={t("warrantyLabel")}
                    value={t("warranty", { months: product.warrantyMonths })}
                    zebra={product.attributes.length % 2 === 0}
                  />
                ) : null}
              </dl>
            ) : null}
          </section>

          <ProductReviews productId={product.id} className="animate-rise" />
          <ProductQuestions
            productId={product.id}
            productSlug={product.slug}
            className="animate-rise"
          />
        </div>
      </div>

      {/* Espaço para a barra fixa não cobrir o conteúdo no mobile. */}
      <div className="h-24 md:hidden" aria-hidden />

      <StickyBar
        tone="light"
        className="bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom))] pb-3 md:bottom-4 md:pb-3"
      >
        <div className="hidden min-w-0 flex-1 flex-col md:flex">
          <span className="truncate text-lg leading-tight font-extrabold tabular-nums">
            {formatMoney(price)}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {stock > 0 ? (variantLabel ?? t("installments")) : t("outOfStock")}
          </span>
        </div>
        <div className="grid w-full grid-cols-2 gap-2.5 md:w-auto md:grid-cols-[200px_200px]">
          <Button
            variant="outline"
            size="lg"
            className="h-13 text-[14.5px] font-extrabold"
            disabled={!canBuy}
            onClick={onAddToCart}
          >
            <ShoppingCart data-icon="inline-start" /> {t("addShort")}
          </Button>
          <Button
            variant="cta"
            size="lg"
            className="h-13 text-[14.5px] font-extrabold"
            disabled={!canBuy}
            onClick={onBuyNow}
          >
            {t("buyNow")}
          </Button>
        </div>
      </StickyBar>
    </PageContainer>
  );
}

function MetricTile({ value, label, tone }: { value: string; label: string; tone?: "success" }) {
  return (
    <span className="flex flex-col gap-0.5 rounded-lg bg-surface p-2.5">
      <span
        className={cn(
          "text-[15px] leading-tight font-extrabold tabular-nums",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </span>
      <span className="text-[11.5px] leading-[1.25] text-muted-foreground">{label}</span>
    </span>
  );
}

function SpecRow({ name, value, zebra }: { name: string; value: string; zebra: boolean }) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3 px-3 py-[11px] text-[13px]",
        zebra ? "bg-surface" : "bg-card",
      )}
    >
      <dt className="text-muted-foreground">{name}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <PageContainer className="lg:pt-5">
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
        <div className="relative -mx-4 lg:mx-0">
          <Skeleton className="h-[370px] rounded-none bg-surface-strong lg:h-[520px] lg:rounded-3xl" />
          <div className="absolute top-3 left-3 size-11 rounded-lg bg-card/70" />
          <div className="absolute top-3 right-3 flex gap-2">
            <div className="size-11 rounded-lg bg-card/70" />
            <div className="size-11 rounded-lg bg-card/70" />
          </div>
        </div>
        <div className="relative -mt-6 flex flex-col gap-2.5 lg:mt-0">
          <div className={cn(CARD, "flex flex-col gap-3 pt-5")}>
            <Skeleton className="h-7 w-32 rounded-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-1 h-10 w-44" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className={cn(CARD, "flex flex-col gap-3")}>
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-10.5 w-16 rounded-md" />
              <Skeleton className="h-10.5 w-16 rounded-md" />
              <Skeleton className="h-10.5 w-16 rounded-md" />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3.5">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-[46px] w-[126px] rounded-lg" />
            </div>
          </div>
          <div className={cn(CARD, "flex flex-col gap-3.5")}>
            <div className="flex gap-3">
              <Skeleton className="size-10 rounded-[13px]" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="flex gap-3 border-t border-border pt-3.5">
              <Skeleton className="size-10 rounded-[13px]" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          </div>
          <div className={cn(CARD, "flex flex-col gap-3.5")}>
            <div className="flex items-center gap-3">
              <Skeleton className="size-[50px] rounded-2xl" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-[58px] rounded-lg" />
              <Skeleton className="h-[58px] rounded-lg" />
              <Skeleton className="h-[58px] rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
