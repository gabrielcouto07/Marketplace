"use client";

import type {
  AddressDto,
  CheckoutGroupDto,
  CheckoutQuoteDto,
  CheckoutQuoteRequest,
  PaymentMethod,
} from "@marketplace/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Barcode,
  Clock,
  CreditCard,
  Loader2,
  Lock,
  LogIn,
  MapPin,
  QrCode,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { PageContainer, StickyBar } from "@/components/layout/store-shell";
import { BackButton } from "@/components/shared/back-button";
import { FormField, useValidationMessage } from "@/components/shared/form-field";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddresses, useCreateAddress } from "@/features/account/api";
import { AddressForm } from "@/features/account/components/address-form";
import { useCurrentUser, useIsAuthenticated } from "@/features/auth/store";
import { useCartHydration } from "@/features/cart/components/cart-view";
import { groupBySeller, useCartStore } from "@/features/cart/store";
import { useCheckoutQuote, usePlaceOrder } from "@/features/checkout/api";
import { formatCountdown, useCountdown } from "@/hooks/use-countdown";
import { Link, useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";
import { formatMoney, splitInstallments } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatCep, formatCpf, onlyDigits } from "@/lib/validation/documents";
import { cardSchema, cpfSchema } from "@/lib/validation/schemas";

const cardOnlySchema = cardSchema.omit({ payerDocument: true });
type CardOnlyInput = z.input<typeof cardOnlySchema>;
type CardOnlyOutput = z.output<typeof cardOnlySchema>;

function detectBrand(number: string): string {
  const d = onlyDigits(number);
  if (/^4/.test(d)) return "Visa";
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "Amex";
  if (/^(636368|438935|504175|451416|636297)/.test(d)) return "Elo";
  return "Cartão";
}

function formatCardNumber(value: string): string {
  return onlyDigits(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string): string {
  const d = onlyDigits(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function CheckoutView() {
  const t = useTranslations("checkout");
  const tc = useTranslations("common");
  const tCatalog = useTranslations("catalog");
  const tAccount = useTranslations("account");
  const format = useFormatter();
  const validationMessage = useValidationMessage();
  const router = useRouter();

  const isAuthenticated = useIsAuthenticated();
  const user = useCurrentUser();
  const hydrated = useCartHydration();
  const lines = useCartStore((s) => s.lines);
  const clearCart = useCartStore((s) => s.clear);
  const groups = useMemo(() => groupBySeller(lines), [lines]);

  const addresses = useAddresses();
  const createAddress = useCreateAddress();
  const [chosenAddressId, setAddressId] = useState<string | null>(null);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);

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

  // ----- Estados de bloqueio -----
  if (!isAuthenticated) {
    return (
      <PageContainer className="pt-6">
        <EmptyState
          icon={LogIn}
          title={t("loginRequiredTitle")}
          description={t("loginRequiredDescription")}
          action={
            <Button variant="cta" size="lg" render={<Link href="/entrar?next=/checkout" />}>
              {tAccount("signIn")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (!hydrated) {
    return (
      <PageContainer className="flex flex-col gap-3 pt-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-16 w-full rounded-[18px]" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
      </PageContainer>
    );
  }

  if (lines.length === 0) {
    return (
      <PageContainer className="pt-6">
        <EmptyState
          icon={ShoppingCart}
          title={t("emptyCartTitle")}
          description={t("emptyCartDescription")}
          action={
            <Button variant="cta" size="lg" render={<Link href="/" />}>
              {tCatalog("exploreProducts")}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const step = !selectedAddress ? 1 : !quote ? 2 : 3;

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
        brand: detectBrand(v.number),
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
      {/* Topo fixo: voltar + título + selo "Seguro" + etapas */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/90 md:top-[var(--header-height)]">
        <PageContainer className="flex flex-col gap-3 py-3">
          <div className="flex items-center gap-2.5">
            <BackButton fallbackHref="/carrinho" />
            <h1 className="min-w-0 flex-1 truncate text-[19px] font-extrabold tracking-tight">
              {t("heading")}
            </h1>
            <span className="flex items-center gap-1 text-xs font-bold text-success">
              <Lock className="size-3.5" strokeWidth={2.2} aria-hidden />
              {t("secure")}
            </span>
          </div>
          <Stepper current={step} />
        </PageContainer>
      </div>

      <PageContainer className="flex flex-col gap-3 pt-1 pb-6 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-4">
        <div className="flex flex-col gap-3">
          {/* Câmbio travado */}
          {quote ? (
            quoteExpired ? (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-[18px] bg-destructive-soft px-3.5 py-3 text-destructive"
              >
                <Clock className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                <span className="flex-1 text-[13px] leading-snug font-bold">
                  {t("exchangeExpired")}
                </span>
                <Button
                  size="sm"
                  variant="white"
                  onClick={() => {
                    resetQuote();
                    refreshQuote();
                  }}
                >
                  <RefreshCw data-icon="inline-start" /> {t("refreshQuote")}
                </Button>
              </div>
            ) : (
              <div
                role="status"
                className="flex animate-rise items-center gap-2.5 rounded-[18px] bg-ink px-3.5 py-3 text-ink-foreground shadow-ink"
              >
                <Clock className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col leading-snug">
                  <span className="text-[13px] font-bold tabular-nums">
                    {t("exchangeLockedFor", { time: formatCountdown(remaining) })}
                  </span>
                  <span className="truncate text-xs text-ink-muted">
                    {quote.exchangeRate.displayRate} ·{" "}
                    {t("quotedAt", {
                      time: format.dateTime(new Date(quote.exchangeRate.quotedAt), {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    })}
                  </span>
                </div>
              </div>
            )
          ) : null}

          {/* 1. Endereço */}
          <Section number={1} title={t("addressTitle")} index={0}>
            {addresses.isPending ? (
              <div className="flex flex-col gap-2.5">
                <Skeleton className="h-[74px] w-full rounded-2xl" />
                <Skeleton className="h-[74px] w-full rounded-2xl" />
              </div>
            ) : addresses.isError ? (
              <ErrorState compact error={addresses.error} onRetry={() => addresses.refetch()} />
            ) : addresses.data.length === 0 ? (
              <p className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2.5 text-[12.5px] font-semibold text-muted-foreground">
                <MapPin className="size-4 shrink-0" aria-hidden /> {t("noAddressDescription")}
              </p>
            ) : (
              <div
                role="radiogroup"
                aria-label={t("selectAddress")}
                className="flex flex-col gap-2.5"
              >
                {addresses.data.map((a) => (
                  <OptionCard
                    key={a.id}
                    selected={addressId === a.id}
                    onSelect={() => setAddressId(a.id)}
                    size="lg"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-bold">
                        {a.label}
                        {a.isDefault ? (
                          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
                            {tAccount("default")}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[12.5px] leading-relaxed text-muted-foreground">
                        {a.street}, {a.number}
                        {a.complement ? ` · ${a.complement}` : ""}
                        <br />
                        {a.neighborhood} · {a.city}/{a.state} · {formatCep(a.postalCode)}
                      </span>
                    </span>
                  </OptionCard>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setAddressSheetOpen(true)}
              className="h-[46px] w-full pressable rounded-lg border-[1.5px] border-dashed border-line-300 text-[13.5px] font-bold text-primary transition-colors outline-none hover:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              + {t("newAddress")}
            </button>
            <Sheet open={addressSheetOpen} onOpenChange={setAddressSheetOpen}>
              <SheetContent
                side="bottom"
                className="max-h-[92dvh] overflow-y-auto sm:mx-auto sm:max-w-lg"
              >
                <SheetHeader>
                  <SheetTitle>{t("newAddress")}</SheetTitle>
                  <SheetDescription>{t("noAddressDescription")}</SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-4">
                  <AddressForm
                    submitting={createAddress.isPending}
                    submitLabel={t("useThisAddress")}
                    serverErrors={
                      isApiError(createAddress.error) ? createAddress.error.errors : undefined
                    }
                    defaultValues={{
                      recipientName: user?.fullName ?? "",
                      phone: user?.phone ?? "",
                    }}
                    onSubmit={(values) =>
                      createAddress.mutate(values, {
                        onSuccess: (created) => {
                          setAddressId(created.id);
                          setAddressSheetOpen(false);
                          toast.success(tAccount("addressSaved"));
                        },
                        onError: (err) =>
                          toast.error(isApiError(err) ? err.message : t("orderFailed")),
                      })
                    }
                  />
                </div>
              </SheetContent>
            </Sheet>
          </Section>

          {/* 2. Frete por loja */}
          <Section number={2} title={t("shippingTitle")} index={1} gap="lg">
            {!selectedAddress ? (
              <p className="text-[13px] text-muted-foreground">{t("selectAddress")}</p>
            ) : quoteFailed && !quote ? (
              <ErrorState compact error={quoteError} onRetry={refreshQuote} />
            ) : !quote ? (
              <div className="flex flex-col gap-2.5">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-[62px] w-full rounded-lg" />
                <Skeleton className="h-[62px] w-full rounded-lg" />
              </div>
            ) : (
              <div
                className={cn("flex flex-col gap-3.5 transition-opacity", quoting && "opacity-60")}
                aria-busy={quoting}
              >
                {quote.groups.map((g) => (
                  <ShippingGroup
                    key={g.seller.id}
                    group={g}
                    selectedId={shippingSel[g.seller.id] ?? g.selectedShippingOptionId}
                    onSelect={(id) => setShippingSel((s) => ({ ...s, [g.seller.id]: id }))}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* 3. Pagamento */}
          <Section number={3} title={t("stepPayment")} index={2} gap="lg">
            <div
              role="radiogroup"
              aria-label={t("paymentTitle")}
              className="grid grid-cols-3 gap-2"
            >
              {(
                [
                  { value: "Pix", icon: QrCode, label: t("pix") },
                  { value: "Boleto", icon: Barcode, label: t("boletoShort") },
                  { value: "Cartao", icon: CreditCard, label: t("cardShort") },
                ] as const
              ).map((opt) => {
                const selected = method === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMethod(opt.value)}
                    className={cn(
                      "relative flex pressable flex-col items-center gap-1.5 rounded-2xl border-2 px-1.5 pt-3.5 pb-3 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                      selected
                        ? "border-primary bg-selected text-primary"
                        : "border-border bg-card text-foreground hover:border-line-200",
                    )}
                  >
                    <opt.icon className="size-[22px]" strokeWidth={2} aria-hidden />
                    <span className="text-[13px] font-extrabold">{opt.label}</span>
                    {/* Etiqueta "-5%" no Pix: só quando a cotação trouxer desconto Pix — o contrato atual não tem esse campo. */}
                  </button>
                );
              })}
            </div>

            {method === "Pix" ? (
              <p className="text-[13px] leading-relaxed text-body">{t("pixNote")}</p>
            ) : null}
            {method === "Boleto" ? (
              <p className="text-[13px] leading-relaxed text-body">{t("boletoNote")}</p>
            ) : null}

            {method === "Cartao" ? (
              <form
                className="flex flex-col gap-2.5"
                onSubmit={(e) => e.preventDefault()}
                noValidate
              >
                <FormField
                  id="card-number"
                  label={t("cardNumber")}
                  error={cardForm.formState.errors.number?.message}
                  hint={t("testCardHint")}
                >
                  <Controller
                    control={cardForm.control}
                    name="number"
                    render={({ field }) => (
                      <Input
                        id="card-number"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        placeholder="0000 0000 0000 0000"
                        aria-invalid={Boolean(cardForm.formState.errors.number)}
                        value={formatCardNumber(field.value ?? "")}
                        onChange={(e) => field.onChange(onlyDigits(e.target.value).slice(0, 19))}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                </FormField>
                <FormField
                  id="card-holder"
                  label={t("cardHolder")}
                  error={cardForm.formState.errors.holderName?.message}
                >
                  <Input
                    id="card-holder"
                    autoComplete="cc-name"
                    className="uppercase"
                    aria-invalid={Boolean(cardForm.formState.errors.holderName)}
                    {...cardForm.register("holderName")}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField
                    id="card-expiry"
                    label={t("cardExpiry")}
                    error={cardForm.formState.errors.expiry?.message}
                  >
                    <Controller
                      control={cardForm.control}
                      name="expiry"
                      render={({ field }) => (
                        <Input
                          id="card-expiry"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          placeholder="MM/AA"
                          aria-invalid={Boolean(cardForm.formState.errors.expiry)}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(formatExpiry(e.target.value))}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  </FormField>
                  <FormField
                    id="card-cvv"
                    label={t("cardCvv")}
                    error={cardForm.formState.errors.cvv?.message}
                  >
                    <Input
                      id="card-cvv"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      maxLength={4}
                      placeholder="123"
                      aria-invalid={Boolean(cardForm.formState.errors.cvv)}
                      {...cardForm.register("cvv")}
                    />
                  </FormField>
                </div>
                <FormField
                  id="card-installments"
                  label={t("cardInstallments")}
                  error={cardForm.formState.errors.installments?.message}
                >
                  <Controller
                    control={cardForm.control}
                    name="installments"
                    render={({ field }) => (
                      <select
                        id="card-installments"
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="h-12 w-full rounded-lg border-[1.5px] border-input bg-card px-3 text-[14.5px] text-foreground transition-colors outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                      >
                        {installmentValues.map((amount, i) => (
                          <option key={i + 1} value={i + 1}>
                            {t("installmentOption", { count: i + 1, amount: formatMoney(amount) })}
                          </option>
                        ))}
                        {installmentValues.length === 0 ? <option value={1}>1x</option> : null}
                      </select>
                    )}
                  />
                </FormField>
              </form>
            ) : null}

            <FormField
              id="payer-document"
              label={t("payerDocument")}
              error={payerError}
              hint={t("cpfRequired")}
            >
              <Input
                id="payer-document"
                inputMode="numeric"
                placeholder="000.000.000-00"
                aria-invalid={Boolean(payerError)}
                value={formatCpf(payerDocument)}
                onChange={(e) => {
                  setPayerDocument(onlyDigits(e.target.value).slice(0, 11));
                  setPayerError(undefined);
                }}
              />
            </FormField>
          </Section>
        </div>

        <div className="flex flex-col gap-3 lg:sticky lg:top-[calc(var(--header-height)+7.5rem)]">
          {/* Cupom */}
          <Section title={t("coupon")} index={3}>
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
                className={cn("flex-1 uppercase", couponApplied && "border-success")}
              />
              <Button
                type="submit"
                variant="soft"
                className="shrink-0 font-extrabold"
                disabled={quoting || !selectedAddress}
              >
                {t("applyCoupon")}
              </Button>
            </form>
            {couponInvalid ? (
              <p role="alert" className="text-[12.5px] font-semibold text-destructive">
                {t("couponInvalid")}
              </p>
            ) : couponApplied && quote ? (
              <p role="status" className="text-[12.5px] font-bold text-success">
                {t("couponApplied", { code: coupon ?? "", amount: formatMoney(quote.discount) })}
              </p>
            ) : null}
          </Section>

          {/* Resumo */}
          <Section title={t("summaryShort")} index={4}>
            {!quote ? (
              <div className="flex flex-col gap-2.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-8 w-1/2 self-end" />
              </div>
            ) : (
              <Summary quote={quote} quoting={quoting} />
            )}
            <p className="text-center text-[11px] text-muted-foreground">{t("termsNote")}</p>
            <p className="text-center text-[11px] text-muted-foreground">{tc("currencyNote")}</p>
            {payerError ? <p className="sr-only">{validationMessage(payerError)}</p> : null}
          </Section>
        </div>
      </PageContainer>

      {/* Barra fixa: total + Finalizar pedido */}
      <StickyBar tone="light">
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-xs text-muted-foreground">{t("total")}</span>
          {quote ? (
            <span className="text-[19px] font-extrabold tabular-nums">
              {formatMoney(quote.total)}
            </span>
          ) : (
            <Skeleton className="mt-1 h-5 w-24" />
          )}
        </div>
        <Button
          variant="cta"
          size="lg"
          className="shrink-0 font-extrabold"
          disabled={!canSubmit}
          onClick={submitOrder}
        >
          {placeOrder.isPending ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : null}
          {placeOrder.isPending ? t("placing") : t("finishOrder")}
        </Button>
      </StickyBar>
      <div className="h-24 md:hidden" aria-hidden />
    </>
  );
}

// ---------------------------------------------------------------------------

function Stepper({ current }: { current: number }) {
  const t = useTranslations("checkout");
  const steps = [t("stepAddress"), t("stepShipping"), t("stepPayment")];
  return (
    <ol className="flex items-center gap-1.5" aria-label={t("progressLabel")}>
      {steps.map((label, i) => {
        const n = i + 1;
        const reached = n <= current;
        return (
          <li
            key={label}
            className="flex flex-1 flex-col gap-1.5"
            aria-current={n === current ? "step" : undefined}
          >
            <span
              className={cn(
                "h-1 rounded-full transition-colors",
                reached ? "bg-primary" : "bg-surface-strong",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "text-[11.5px] font-bold",
                reached ? "text-foreground" : "text-chevron",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Section({
  number,
  title,
  index,
  gap = "md",
  children,
}: {
  number?: number;
  title: string;
  index: number;
  gap?: "md" | "lg";
  children: ReactNode;
}) {
  const id = `checkout-section-${number ?? title}`;
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex animate-rise flex-col rounded-3xl bg-card p-4 shadow-card",
        gap === "lg" ? "gap-3.5" : "gap-2.5",
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <h2 id={id} className="text-[15px] font-extrabold">
        {number ? `${number}. ` : ""}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Card de opção (endereço, frete) com borda de 2 px e "radio" customizado. */
function OptionCard({
  selected,
  onSelect,
  size = "md",
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full pressable items-center gap-3 border-2 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        size === "lg" ? "items-start rounded-2xl p-3" : "rounded-lg px-3 py-[11px]",
        selected ? "border-primary bg-selected" : "border-border bg-card hover:border-line-200",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border-2",
          size === "lg" ? "mt-px size-[22px]" : "size-5",
          selected ? "border-primary" : "border-line-200",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "rounded-full bg-primary transition-transform",
            size === "lg" ? "size-2.5" : "size-[9px]",
            selected ? "scale-100" : "scale-0",
          )}
        />
      </span>
      {children}
    </button>
  );
}

function ShippingGroup({
  group,
  selectedId,
  onSelect,
}: {
  group: CheckoutGroupDto;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("checkout");
  const tc = useTranslations("common");
  const tOrders = useTranslations("orders");
  const tCatalog = useTranslations("catalog");
  const count = group.lines.reduce((acc, l) => acc + l.quantity, 0);
  return (
    <div
      role="radiogroup"
      aria-label={t("shippingBy", { seller: group.seller.name })}
      className="flex flex-col gap-2"
    >
      <span className="text-[12.5px] font-bold text-muted-foreground">
        {group.seller.name} · {tOrders("items", { count })}
      </span>
      {group.shippingOptions.map((opt) => (
        <OptionCard key={opt.id} selected={selectedId === opt.id} onSelect={() => onSelect(opt.id)}>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13.5px] font-bold">
              {opt.service} · {opt.carrier}
            </span>
            <span className="text-xs text-muted-foreground">
              {tc("businessDays", { min: opt.estimatedDays.min, max: opt.estimatedDays.max })}
              {opt.description ? ` · ${opt.description}` : ""}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 text-[13.5px] font-extrabold tabular-nums",
              opt.price.amount === 0 ? "text-success" : "text-foreground",
            )}
          >
            {opt.price.amount === 0 ? tCatalog("freeShipping") : formatMoney(opt.price)}
          </span>
        </OptionCard>
      ))}
    </div>
  );
}

function Summary({ quote, quoting }: { quote: CheckoutQuoteDto; quoting: boolean }) {
  const t = useTranslations("checkout");
  const rate = quote.importTaxRateBasisPoints / 100;
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 text-[13.5px] transition-opacity",
        quoting && "opacity-60",
      )}
      aria-busy={quoting}
    >
      <Row label={t("subtotal")} value={formatMoney(quote.subtotal)} />
      <Row
        label={t("shipping")}
        value={quote.shippingTotal.amount === 0 ? "—" : formatMoney(quote.shippingTotal)}
      />
      <Row label={t("importTax")} value={formatMoney(quote.estimatedImportTax)} />
      <p className="-mt-1 text-[11px] leading-snug text-muted-foreground">
        {t("importTaxHint", { rate })}
      </p>
      {quote.discount.amount > 0 ? (
        <Row
          label={t("discount")}
          value={`− ${formatMoney(quote.discount)}`}
          valueClassName="text-success"
        />
      ) : null}

      <div className="flex items-baseline justify-between border-t border-border pt-3">
        <span className="text-[15px] font-extrabold">{t("total")}</span>
        <span className="text-xl font-extrabold tabular-nums">{formatMoney(quote.total)}</span>
      </div>
      <span className="self-end text-[12.5px] text-muted-foreground tabular-nums">
        {t("totalReference", { amount: formatMoney(quote.totalReference) })}
      </span>
    </div>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-bold tabular-nums", valueClassName)}>{value}</span>
    </div>
  );
}
