"use client";

import type {
  AddressDto,
  CheckoutQuoteRequest,
  DayRange,
  PaymentMethod,
} from "@marketplace/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageContainer, StickyBar } from "@/components/layout/store-shell";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddresses } from "@/features/account/api";
import { useCurrentUser, useIsAuthenticated } from "@/features/auth/store";
import { useCartHydration } from "@/features/cart/components/cart-view";
import { groupBySeller, useCartStore } from "@/features/cart/store";
import { useCheckoutQuote, usePlaceOrder } from "@/features/checkout/api";
import {
  cardOnlySchema,
  detectBrand,
  type CardOnlyInput,
  type CardOnlyOutput,
} from "@/features/checkout/components/card-utils";
import { AddressSection } from "@/features/checkout/components/checkout-address";
import { PaymentSection } from "@/features/checkout/components/checkout-payment";
import { CheckoutSection } from "@/features/checkout/components/checkout-section";
import { ShippingSection } from "@/features/checkout/components/checkout-shipping";
import { CheckoutStepper } from "@/features/checkout/components/checkout-stepper";
import { CheckoutSummary } from "@/features/checkout/components/checkout-summary";
import { useCountdown } from "@/hooks/use-countdown";
import { Link, useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";
import { formatMoney, splitInstallments } from "@/lib/money";
import { onlyDigits } from "@/lib/validation/documents";
import { cpfSchema } from "@/lib/validation/schemas";

export function CheckoutView() {
  const t = useTranslations("checkout");
  const tc = useTranslations("common");
  const tCatalog = useTranslations("catalog");
  const tAccount = useTranslations("account");
  const router = useRouter();

  const isAuthenticated = useIsAuthenticated();
  const user = useCurrentUser();
  const hydrated = useCartHydration();
  const lines = useCartStore((s) => s.lines);
  const clearCart = useCartStore((s) => s.clear);
  const groups = useMemo(() => groupBySeller(lines), [lines]);

  const addresses = useAddresses();
  const [chosenAddressId, setAddressId] = useState<string | null>(null);

  const [shippingSel, setShippingSel] = useState<Record<string, string>>({});
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("Pix");
  // null = ainda não editado pelo usuário → usa o CPF do perfil
  const [payerInput, setPayerDocument] = useState<string | null>(null);
  const payerDocument = payerInput ?? user?.cpf ?? "";
  const [payerError, setPayerError] = useState<string | undefined>();

  const {
    mutate: requestQuote,
    data: quote,
    isPending: quoting,
    isError: quoteFailed,
    error: quoteError,
    reset: resetQuote,
  } = useCheckoutQuote();
  const placeOrder = usePlaceOrder();
  const idempotencyKey = useRef<string | null>(null);

  const cardForm = useForm<CardOnlyInput, unknown, CardOnlyOutput>({
    resolver: zodResolver(cardOnlySchema),
    defaultValues: { holderName: "", number: "", expiry: "", cvv: "", installments: 1 },
    mode: "onBlur",
  });

  // Endereço padrão pré-selecionado (derivado; o usuário pode trocar)
  const addressId =
    chosenAddressId ??
    (addresses.data?.length
      ? (addresses.data.find((a) => a.isDefault) ?? addresses.data[0]).id
      : null);
  const selectedAddress: AddressDto | undefined = addresses.data?.find((a) => a.id === addressId);
  const postalCode = selectedAddress?.postalCode;

  const buildRequest = useCallback((): CheckoutQuoteRequest | null => {
    if (!postalCode || groups.length === 0) return null;
    return {
      postalCode,
      couponCode: coupon,
      groups: groups.map((g) => ({
        sellerId: g.seller.id,
        items: g.lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
        shippingOptionId: shippingSel[g.seller.id] ?? null,
      })),
    };
  }, [postalCode, groups, shippingSel, coupon]);

  // Recotação (debounce) sempre que endereço, itens, frete ou cupom mudarem
  useEffect(() => {
    const req = buildRequest();
    if (!req) return;
    const timer = window.setTimeout(() => requestQuote(req), 250);
    return () => window.clearTimeout(timer);
  }, [buildRequest, requestQuote]);

  const refreshQuote = useCallback(() => {
    const req = buildRequest();
    if (req) requestQuote(req);
  }, [buildRequest, requestQuote]);

  const remaining = useCountdown(quote?.lockedUntil);
  const quoteExpired = Boolean(quote) && remaining <= 0;

  const total = quote?.total;
  const installmentValues = useMemo(
    () => (total ? Array.from({ length: 12 }, (_, i) => splitInstallments(total, i + 1)[0]) : []),
    [total],
  );

  // Faixa de prazo das opções de frete escolhidas (para o DeliveryWindow do resumo)
  const deliveryRange = useMemo<DayRange | null>(() => {
    if (!quote) return null;
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (const g of quote.groups) {
      const id = shippingSel[g.seller.id] ?? g.selectedShippingOptionId;
      const opt = g.shippingOptions.find((o) => o.id === id);
      if (!opt) return null;
      min = Math.min(min, opt.estimatedDays.min);
      max = Math.max(max, opt.estimatedDays.max);
    }
    return Number.isFinite(min) ? { min, max } : null;
  }, [quote, shippingSel]);

  // ----- Estados de bloqueio -----
  if (!isAuthenticated) {
    return (
      <PageContainer className="pt-4">
        <EmptyState
          illustration="box"
          title={t("loginRequiredTitle")}
          description={t("loginRequiredDescription")}
          action={
            <Button variant="primary" render={<Link href="/entrar?next=/checkout" />}>
              {tAccount("signIn")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (!hydrated) {
    return (
      <PageContainer className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-44 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </PageContainer>
    );
  }

  if (lines.length === 0) {
    return (
      <PageContainer className="pt-4">
        <EmptyState
          illustration="bag"
          title={t("emptyCartTitle")}
          description={t("emptyCartDescription")}
          action={
            <Button variant="primary" render={<Link href="/" />}>
              {tCatalog("exploreProducts")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const step: 1 | 2 | 3 = !selectedAddress ? 1 : !quote ? 2 : 3;

  const submitOrder = async () => {
    if (!quote || !selectedAddress || quoteExpired) return;
    const cpf = cpfSchema.safeParse(payerDocument);
    if (!cpf.success) {
      setPayerError(cpf.error.issues[0]?.message ?? "invalidCpf");
      return;
    }
    setPayerError(undefined);

    let card: NonNullable<Parameters<typeof placeOrder.mutate>[0]["payment"]["card"]> | undefined;
    if (method === "Cartao") {
      const valid = await cardForm.trigger();
      if (!valid) return;
      const v = cardForm.getValues();
      card = {
        token: "tok_mock",
        holderName: v.holderName,
        brand: detectBrand(v.number) ?? "Cartão",
        last4: onlyDigits(v.number).slice(-4),
        installments: Number(v.installments),
      };
    }

    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();

    placeOrder.mutate(
      {
        quoteId: quote.quoteId,
        addressId: selectedAddress.id,
        groups: quote.groups.map((g) => ({
          sellerId: g.seller.id,
          items: g.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
          })),
          shippingOptionId: shippingSel[g.seller.id] ?? g.selectedShippingOptionId,
        })),
        payment: { method, card, payerDocument: cpf.data },
        exchangeRateId: quote.exchangeRate.id,
        idempotencyKey: idempotencyKey.current,
      },
      {
        onSuccess: (res) => {
          idempotencyKey.current = null;
          if (res.payment.status === "Recusado") {
            toast.error(t("cardDeclined"));
            refreshQuote();
            return;
          }
          clearCart();
          router.replace(
            res.payment.status === "Aprovado"
              ? `/pedido/confirmado?purchase=${res.purchaseId}`
              : `/pagamento/${res.payment.id}`,
          );
        },
        onError: (err) => {
          idempotencyKey.current = null;
          if (isApiError(err) && err.errors) {
            for (const [field, messages] of Object.entries(err.errors)) {
              if (field === "payerDocument") setPayerError(messages[0]);
              else toast.error(`${field}: ${messages[0]}`);
            }
            if (err.errors.quoteId) refreshQuote();
          }
          toast.error(isApiError(err) ? err.message : t("orderFailed"));
        },
      },
    );
  };

  const couponInvalid =
    Boolean(coupon) && quote !== undefined && !quoting && quote.discount.amount === 0;
  const couponApplied = Boolean(coupon) && quote !== undefined && quote.discount.amount > 0;

  const canSubmit =
    Boolean(quote) &&
    !quoting &&
    !quoteExpired &&
    !placeOrder.isPending &&
    Boolean(selectedAddress);

  return (
    <>
      <PageContainer className="pt-4">
        <CheckoutStepper current={step} />
      </PageContainer>

      <PageContainer className="flex flex-col gap-4 pt-6 pb-6 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-4">
          <AddressSection addresses={addresses} selectedId={addressId} onSelect={setAddressId} />

          <ShippingSection
            hasAddress={Boolean(selectedAddress)}
            quote={quote}
            quoting={quoting}
            quoteError={quoteError}
            quoteFailed={quoteFailed}
            selection={shippingSel}
            onSelect={(sellerId, optionId) =>
              setShippingSel((s) => ({ ...s, [sellerId]: optionId }))
            }
            onRetry={refreshQuote}
          />

          <PaymentSection
            method={method}
            onMethodChange={setMethod}
            cardForm={cardForm}
            installmentValues={installmentValues}
            payerDocument={payerDocument}
            payerError={payerError}
            onPayerDocumentChange={(digits) => {
              setPayerDocument(digits);
              setPayerError(undefined);
            }}
          />
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
          {/* Cupom */}
          <CheckoutSection id="checkout-coupon" title={t("coupon")}>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setCoupon(couponInput.trim() ? couponInput.trim().toUpperCase() : null);
              }}
            >
              <label htmlFor="coupon" className="sr-only">
                {t("coupon")}
              </label>
              <Input
                id="coupon"
                placeholder={t("couponPlaceholder")}
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                aria-invalid={couponInvalid}
                aria-describedby={couponInvalid || couponApplied ? "coupon-status" : undefined}
                className="flex-1 uppercase"
              />
              <Button
                type="submit"
                variant="secondary"
                className="shrink-0"
                disabled={quoting || !selectedAddress}
              >
                {t("applyCoupon")}
              </Button>
            </form>
            {couponInvalid ? (
              <p
                id="coupon-status"
                role="alert"
                className="flex items-start gap-1.5 text-caption text-danger"
              >
                <AlertCircle className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                {t("couponInvalid")}
              </p>
            ) : couponApplied && quote ? (
              <p
                id="coupon-status"
                role="status"
                className="flex items-start gap-1.5 text-caption text-success"
              >
                <Check className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                {t("couponApplied", { code: coupon ?? "", amount: formatMoney(quote.discount) })}
              </p>
            ) : null}
          </CheckoutSection>

          {/* Resumo */}
          <CheckoutSection id="checkout-summary" title={t("summaryTitle")}>
            <CheckoutSummary
              quote={quote}
              quoting={quoting}
              remaining={remaining}
              expired={quoteExpired}
              onRefresh={() => {
                resetQuote();
                refreshQuote();
              }}
              deliveryRange={deliveryRange}
            />
            <p className="text-caption text-foreground-muted">{t("termsNote")}</p>
            <p className="text-caption text-foreground-muted">{tc("currencyNote")}</p>
          </CheckoutSection>
        </div>
      </PageContainer>

      {/* Espaço para a barra fixa não cobrir o conteúdo no mobile. */}
      <div className="h-24 md:hidden" aria-hidden />

      {/* Barra fixa: total + "Pagar" (único CTA vermelho da tela) */}
      <StickyBar tone="light">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-caption text-foreground-secondary">{t("total")}</span>
          {quote ? (
            <span className="text-title-3 text-foreground tabular-nums">
              {formatMoney(quote.total)}
            </span>
          ) : (
            <Skeleton className="mt-1 h-5 w-24" />
          )}
        </div>
        <Button
          variant="cta"
          className="min-w-32 shrink-0"
          disabled={!canSubmit}
          loading={placeOrder.isPending}
          onClick={submitOrder}
        >
          {t("pay")}
        </Button>
      </StickyBar>
    </>
  );
}
