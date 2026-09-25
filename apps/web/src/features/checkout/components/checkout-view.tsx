"use client";

import type { AddressDto, CheckoutGroupDto, CheckoutQuoteDto, CheckoutQuoteRequest, PaymentMethod } from "@marketplace/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Barcode, Check, CreditCard, Info, Loader2, LogIn, MapPin, Plus, QrCode, RefreshCw, ShoppingCart, Timer } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { PageContainer } from "@/components/layout/store-shell";
import { FormField, useValidationMessage } from "@/components/shared/form-field";
import { SellerBadge } from "@/components/shared/seller-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

  const { mutate: requestQuote, data: quote, isPending: quoting, isError: quoteFailed, error: quoteError, reset: resetQuote } = useCheckoutQuote();
  const placeOrder = usePlaceOrder();
  const idempotencyKey = useRef<string | null>(null);

  const cardForm = useForm<CardOnlyInput, unknown, CardOnlyOutput>({
    resolver: zodResolver(cardOnlySchema),
    defaultValues: { holderName: "", number: "", expiry: "", cvv: "", installments: 1 },
    mode: "onBlur",
  });

  // Endereço padrão pré-selecionado (derivado; o usuário pode trocar)
  const addressId =
    chosenAddressId ?? (addresses.data?.length ? (addresses.data.find((a) => a.isDefault) ?? addresses.data[0]).id : null);
  const selectedAddress: AddressDto | undefined = addresses.data?.find((a) => a.id === addressId);
  const postalCode = selectedAddress?.postalCode;

  const buildRequest = useCallback((): CheckoutQuoteRequest | null => {
    if (!postalCode || groups.length === 0) return null;
    return {
      postalCode,
      couponCode: coupon,
      groups: groups.map((g) => ({
        sellerId: g.seller.id,
        items: g.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
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
  const installmentValues = useMemo(() => (total ? Array.from({ length: 12 }, (_, i) => splitInstallments(total, i + 1)[0]) : []), [total]);

  // ----- Estados de bloqueio -----
  if (!isAuthenticated) {
    return (
      <PageContainer>
        <EmptyState
          icon={LogIn}
          title={t("loginRequiredTitle")}
          description={t("loginRequiredDescription")}
          className="min-h-[60vh]"
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
      <PageContainer className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </PageContainer>
    );
  }

  if (lines.length === 0) {
    return (
      <PageContainer>
        <EmptyState
          icon={ShoppingCart}
          title={t("emptyCartTitle")}
          description={t("emptyCartDescription")}
          className="min-h-[60vh]"
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
          items: g.lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
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
          router.replace(res.payment.status === "Aprovado" ? `/pedido/confirmado?purchase=${res.purchaseId}` : `/pagamento/${res.payment.id}`);
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

  return (
    <PageContainer className="flex flex-col gap-5 pt-4 pb-8 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-6">
      <div className="flex flex-col gap-5">
        <Stepper current={step} />

        {/* 1. Endereço */}
        <Section number={1} title={t("addressTitle")} icon={MapPin}>
          {addresses.isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : addresses.isError ? (
            <ErrorState compact error={addresses.error} onRetry={() => addresses.refetch()} />
          ) : addresses.data.length === 0 ? (
            <EmptyState icon={MapPin} title={t("noAddressTitle")} description={t("noAddressDescription")} className="py-6" />
          ) : (
            <div role="radiogroup" aria-label={t("selectAddress")} className="flex flex-col gap-2">
              {addresses.data.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors has-checked:border-primary has-checked:bg-accent/40 has-focus-visible:ring-2 has-focus-visible:ring-ring",
                  )}
                >
                  <input
                    type="radio"
                    name="address"
                    value={a.id}
                    checked={addressId === a.id}
                    onChange={() => setAddressId(a.id)}
                    className="mt-1 size-4 accent-primary"
                  />
                  <span className="flex min-w-0 flex-col text-sm">
                    <span className="font-semibold">
                      {a.label}
                      {a.isDefault ? <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{tAccount("default")}</span> : null}
                    </span>
                    <span className="text-muted-foreground">
                      {a.recipientName} · {a.street}, {a.number}
                      {a.complement ? ` · ${a.complement}` : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {a.neighborhood} · {a.city}/{a.state} · {formatCep(a.postalCode)}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <Button variant="outline" className="mt-3 w-full sm:w-auto" onClick={() => setAddressSheetOpen(true)}>
            <Plus data-icon="inline-start" /> {t("addAddress")}
          </Button>
          <Sheet open={addressSheetOpen} onOpenChange={setAddressSheetOpen}>
            <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl pb-safe sm:mx-auto sm:max-w-lg">
              <SheetHeader>
                <SheetTitle>{t("newAddress")}</SheetTitle>
                <SheetDescription>{t("noAddressDescription")}</SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4">
                <AddressForm
                  submitting={createAddress.isPending}
                  submitLabel={t("useThisAddress")}
                  serverErrors={isApiError(createAddress.error) ? createAddress.error.errors : undefined}
                  defaultValues={{ recipientName: user?.fullName ?? "", phone: user?.phone ?? "" }}
                  onSubmit={(values) =>
                    createAddress.mutate(values, {
                      onSuccess: (created) => {
                        setAddressId(created.id);
                        setAddressSheetOpen(false);
                        toast.success(tAccount("addressSaved"));
                      },
                      onError: (err) => toast.error(isApiError(err) ? err.message : t("orderFailed")),
                    })
                  }
                />
              </div>
            </SheetContent>
          </Sheet>
        </Section>

        {/* 2. Frete por vendedor */}
        <Section number={2} title={t("shippingTitle")} icon={Timer}>
          {!selectedAddress ? (
            <p className="text-sm text-muted-foreground">{t("selectAddress")}</p>
          ) : quoteFailed && !quote ? (
            <ErrorState compact error={quoteError} onRetry={refreshQuote} />
          ) : !quote ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          ) : (
            <div className={cn("flex flex-col gap-4", quoting && "opacity-60")} aria-busy={quoting}>
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
        <Section number={3} title={t("paymentTitle")} icon={CreditCard}>
          <div role="radiogroup" aria-label={t("paymentTitle")} className="flex flex-col gap-2">
            {(
              [
                { value: "Pix", icon: QrCode, label: t("pix"), description: t("pixDescription") },
                { value: "Boleto", icon: Barcode, label: t("boleto"), description: t("boletoDescription") },
                { value: "Cartao", icon: CreditCard, label: t("card"), description: t("cardDescription") },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors has-checked:border-primary has-checked:bg-accent/40 has-focus-visible:ring-2 has-focus-visible:ring-ring"
              >
                <input type="radio" name="payment" value={opt.value} checked={method === opt.value} onChange={() => setMethod(opt.value)} className="size-4 accent-primary" />
                <opt.icon className="size-5 text-primary" aria-hidden />
                <span className="flex flex-col text-sm">
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-muted-foreground">{opt.description}</span>
                </span>
              </label>
            ))}
          </div>

          {method === "Cartao" ? (
            <form className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-surface p-3" onSubmit={(e) => e.preventDefault()} noValidate>
              <FormField id="card-number" label={t("cardNumber")} error={cardForm.formState.errors.number?.message} hint={t("testCardHint")}>
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
              <FormField id="card-holder" label={t("cardHolder")} error={cardForm.formState.errors.holderName?.message}>
                <Input id="card-holder" autoComplete="cc-name" className="uppercase" aria-invalid={Boolean(cardForm.formState.errors.holderName)} {...cardForm.register("holderName")} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField id="card-expiry" label={t("cardExpiry")} error={cardForm.formState.errors.expiry?.message}>
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
                <FormField id="card-cvv" label={t("cardCvv")} error={cardForm.formState.errors.cvv?.message}>
                  <Input id="card-cvv" inputMode="numeric" autoComplete="cc-csc" maxLength={4} placeholder="123" aria-invalid={Boolean(cardForm.formState.errors.cvv)} {...cardForm.register("cvv")} />
                </FormField>
              </div>
              <FormField id="card-installments" label={t("cardInstallments")} error={cardForm.formState.errors.installments?.message}>
                <Controller
                  control={cardForm.control}
                  name="installments"
                  render={({ field }) => (
                    <select
                      id="card-installments"
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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

          <FormField id="payer-document" label={t("payerDocument")} error={payerError} hint={t("cpfRequired")} className="mt-4">
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

      {/* 4. Resumo */}
      <aside className="lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
        <Section number={4} title={t("summaryTitle")} icon={Check}>
          {!quote ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-8 w-1/2" />
            </div>
          ) : (
            <Summary
              quote={quote}
              quoting={quoting}
              expired={quoteExpired}
              remaining={remaining}
              couponInput={couponInput}
              onCouponInput={setCouponInput}
              onApplyCoupon={() => setCoupon(couponInput.trim() ? couponInput.trim().toUpperCase() : null)}
              onRefresh={() => {
                resetQuote();
                refreshQuote();
              }}
              lockedUntilLabel={format.dateTime(new Date(quote.lockedUntil), { hour: "2-digit", minute: "2-digit" })}
            />
          )}
          <Button
            variant="cta"
            size="lg"
            className="mt-4 w-full"
            disabled={!quote || quoting || quoteExpired || placeOrder.isPending || !selectedAddress}
            onClick={submitOrder}
          >
            {placeOrder.isPending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {placeOrder.isPending ? t("placing") : t("placeOrder")}
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("termsNote")}</p>
          <p className="mt-1 text-center text-[11px] text-muted-foreground">{tc("currencyNote")}</p>
          {payerError ? <p className="sr-only">{validationMessage(payerError)}</p> : null}
        </Section>
      </aside>
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------

function Stepper({ current }: { current: number }) {
  const t = useTranslations("checkout");
  const steps = [t("stepAddress"), t("stepShipping"), t("stepPayment"), t("stepReview")];
  return (
    <ol className="flex items-center gap-1" aria-label={t("title")}>
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-1 last:flex-none">
            <span className="flex items-center gap-1.5">
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                  done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground" : "bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300",
                )}
              >
                {done ? <Check className="size-3.5" /> : n}
              </span>
              <span className={cn("hidden text-xs font-medium sm:inline", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            </span>
            {i < steps.length - 1 ? <span className={cn("h-px flex-1", done ? "bg-success" : "bg-border")} aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function Section({ number, title, icon: Icon, children }: { number: number; title: string; icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`checkout-section-${number}`} className="rounded-xl border border-border bg-card p-4">
      <h2 id={`checkout-section-${number}`} className="mb-3 flex items-center gap-2 text-base font-bold">
        <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">{number}</span>
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}

function ShippingGroup({ group, selectedId, onSelect }: { group: CheckoutGroupDto; selectedId: string | null; onSelect: (id: string) => void }) {
  const t = useTranslations("checkout");
  const tc = useTranslations("common");
  const tCatalog = useTranslations("catalog");
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2 text-sm">
        <SellerBadge seller={group.seller} className="font-semibold text-foreground" />
        <span className="ml-auto text-xs text-muted-foreground">{t("shippingBy", { seller: group.seller.name })}</span>
      </div>
      <ul className="flex gap-2 overflow-x-auto px-3 py-2 scrollbar-none">
        {group.lines.map((l) => (
          <li key={`${l.productId}:${l.variantId ?? "-"}`} className="relative size-12 shrink-0 overflow-hidden rounded-md bg-surface" title={l.name}>
            <Image src={l.thumbnailUrl} alt={l.name} fill sizes="48px" className="object-cover" />
            {l.quantity > 1 ? (
              <span className="absolute right-0 bottom-0 rounded-tl-md bg-neutral-900/80 px-1 text-[10px] font-bold text-white">×{l.quantity}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <div role="radiogroup" aria-label={t("shippingTitle")} className="flex flex-col gap-2 p-3 pt-1">
        {group.shippingOptions.map((opt) => (
          <label
            key={opt.id}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors has-checked:border-primary has-checked:bg-accent/40 has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input type="radio" name={`shipping-${group.seller.id}`} value={opt.id} checked={selectedId === opt.id} onChange={() => onSelect(opt.id)} className="size-4 accent-primary" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium">
                {opt.service} <span className="font-normal text-muted-foreground">· {opt.carrier}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {tc("businessDays", { min: opt.estimatedDays.min, max: opt.estimatedDays.max })}
                {opt.description ? ` · ${opt.description}` : ""}
              </span>
            </span>
            <span className={cn("shrink-0 font-semibold", opt.price.amount === 0 && "text-success")}>
              {opt.price.amount === 0 ? tCatalog("freeShipping") : formatMoney(opt.price)}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

interface SummaryProps {
  quote: CheckoutQuoteDto;
  quoting: boolean;
  expired: boolean;
  remaining: number;
  couponInput: string;
  onCouponInput: (v: string) => void;
  onApplyCoupon: () => void;
  onRefresh: () => void;
  lockedUntilLabel: string;
}

function Summary({ quote, quoting, expired, remaining, couponInput, onCouponInput, onApplyCoupon, onRefresh, lockedUntilLabel }: SummaryProps) {
  const t = useTranslations("checkout");
  const rate = quote.importTaxRateBasisPoints / 100;
  return (
    <div className={cn("flex flex-col gap-2 text-sm", quoting && "opacity-60")} aria-busy={quoting}>
      <Row label={t("subtotal")} value={formatMoney(quote.subtotal)} />
      <Row label={t("shipping")} value={quote.shippingTotal.amount === 0 ? "—" : formatMoney(quote.shippingTotal)} />
      <Row
        label={
          <span className="flex items-center gap-1">
            {t("importTax")}
            <span className="group relative inline-flex">
              <Info className="size-3.5 text-muted-foreground" aria-hidden />
              <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-56 -translate-x-1/2 rounded-md bg-neutral-900 p-2 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {t("importTaxHint", { rate })}
              </span>
            </span>
          </span>
        }
        value={formatMoney(quote.estimatedImportTax)}
      />
      <p className="-mt-1 text-[11px] text-muted-foreground">{t("importTaxHint", { rate })}</p>
      {quote.discount.amount > 0 ? <Row label={t("discount")} value={`− ${formatMoney(quote.discount)}`} className="text-success" /> : null}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onApplyCoupon();
        }}
      >
        <label htmlFor="coupon" className="sr-only">
          {t("coupon")}
        </label>
        <Input id="coupon" placeholder={t("couponPlaceholder")} value={couponInput} onChange={(e) => onCouponInput(e.target.value)} className="uppercase" />
        <Button type="submit" variant="outline" disabled={quoting}>
          {t("applyCoupon")}
        </Button>
      </form>

      <div className="mt-1 flex items-end justify-between border-t border-border pt-3">
        <span className="font-semibold">{t("total")}</span>
        <span className="flex flex-col items-end">
          <span className="text-2xl font-bold">{formatMoney(quote.total)}</span>
          <span className="text-xs text-muted-foreground">{t("totalReference", { amount: formatMoney(quote.totalReference) })}</span>
        </span>
      </div>

      <div className={cn("mt-1 rounded-lg px-3 py-2 text-xs", expired ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground")}>
        {expired ? (
          <div className="flex items-center justify-between gap-2">
            <span>{t("exchangeExpired")}</span>
            <Button size="xs" variant="outline" onClick={onRefresh}>
              <RefreshCw data-icon="inline-start" /> {t("refreshQuote")}
            </Button>
          </div>
        ) : (
          <span className="flex items-center gap-1.5">
            <Timer className="size-3.5 shrink-0" aria-hidden />
            {t("exchangeLocked", { rate: quote.exchangeRate.displayRate })} · {t("exchangeLockedUntil", { time: lockedUntilLabel })} ({formatCountdown(remaining)})
          </span>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, className }: { label: React.ReactNode; value: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
