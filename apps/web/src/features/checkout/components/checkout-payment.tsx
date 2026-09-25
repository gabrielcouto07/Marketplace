"use client";

import type { Money, PaymentMethod } from "@marketplace/contracts";
import { Barcode, CreditCard, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  detectBrand,
  formatCardNumber,
  formatExpiry,
  type CardOnlyInput,
  type CardOnlyOutput,
} from "@/features/checkout/components/card-utils";
import { CheckoutSection, OptionCard } from "@/features/checkout/components/checkout-section";
import { formatMoney } from "@/lib/money";
import { formatCpf, onlyDigits } from "@/lib/validation/documents";

const METHODS = [
  { value: "Pix", icon: QrCode, label: "pix", hint: "pixDescription" },
  { value: "Boleto", icon: Barcode, label: "boleto", hint: "boletoDescription" },
  { value: "Cartao", icon: CreditCard, label: "card", hint: "cardDescription" },
] as const;

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "Pix" || value === "Boleto" || value === "Cartao";
}

interface PaymentSectionProps {
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  cardForm: UseFormReturn<CardOnlyInput, unknown, CardOnlyOutput>;
  /** Valor de cada parcela (1x … 12x) sobre o total cotado. */
  installmentValues: Money[];
  payerDocument: string;
  payerError?: string;
  onPayerDocumentChange: (digits: string) => void;
}

/** 3. Pagamento: método em radio cards (ícone + dica), formulário do cartão e CPF do pagador. */
export function PaymentSection({
  method,
  onMethodChange,
  cardForm,
  installmentValues,
  payerDocument,
  payerError,
  onPayerDocumentChange,
}: PaymentSectionProps) {
  const t = useTranslations("checkout");
  return (
    <CheckoutSection id="checkout-payment" title={t("paymentSectionTitle")}>
      <RadioGroup
        aria-label={t("paymentTitle")}
        value={method}
        onValueChange={(value) => {
          if (isPaymentMethod(value)) onMethodChange(value);
        }}
      >
        {METHODS.map((opt) => (
          <OptionCard key={opt.value} value={opt.value}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <opt.icon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-sm font-medium text-foreground">{t(opt.label)}</span>
              <span className="text-caption text-foreground-secondary">{t(opt.hint)}</span>
            </span>
          </OptionCard>
        ))}
      </RadioGroup>

      {method === "Pix" ? (
        <p className="text-body-sm text-foreground-secondary">{t("pixNote")}</p>
      ) : null}
      {method === "Boleto" ? (
        <p className="text-body-sm text-foreground-secondary">{t("boletoNote")}</p>
      ) : null}
      {method === "Cartao" ? (
        <CardForm form={cardForm} installmentValues={installmentValues} />
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
          autoComplete="off"
          placeholder="000.000.000-00"
          aria-invalid={Boolean(payerError)}
          aria-describedby={payerError ? "payer-document-error" : "payer-document-hint"}
          value={formatCpf(payerDocument)}
          onChange={(e) => onPayerDocumentChange(onlyDigits(e.target.value).slice(0, 11))}
        />
      </FormField>
    </CheckoutSection>
  );
}

function CardForm({
  form,
  installmentValues,
}: {
  form: UseFormReturn<CardOnlyInput, unknown, CardOnlyOutput>;
  installmentValues: Money[];
}) {
  const t = useTranslations("checkout");
  const { errors } = form.formState;
  const number = useWatch({ control: form.control, name: "number" });
  const brand = detectBrand(number ?? "");

  const installmentItems = useMemo<Record<string, string>>(() => {
    if (installmentValues.length === 0) return { "1": "1x" };
    return Object.fromEntries(
      installmentValues.map((amount, i) => [
        String(i + 1),
        t("installmentOption", { count: i + 1, amount: formatMoney(amount) }),
      ]),
    );
  }, [installmentValues, t]);

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
      <FormField
        id="card-number"
        label={t("cardNumber")}
        error={errors.number?.message}
        hint={t("testCardHint")}
      >
        <div className="relative">
          <Controller
            control={form.control}
            name="number"
            render={({ field }) => (
              <Input
                id="card-number"
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="0000 0000 0000 0000"
                aria-invalid={Boolean(errors.number)}
                aria-describedby={errors.number ? "card-number-error" : "card-number-hint"}
                className={brand ? "pr-24" : undefined}
                value={formatCardNumber(field.value ?? "")}
                onChange={(e) => field.onChange(onlyDigits(e.target.value).slice(0, 19))}
                onBlur={field.onBlur}
              />
            )}
          />
          {brand ? (
            <Badge
              variant="neutral"
              className="absolute top-1/2 right-3 -translate-y-1/2"
              aria-label={t("cardBrand", { brand })}
            >
              {brand}
            </Badge>
          ) : null}
        </div>
      </FormField>

      <FormField id="card-holder" label={t("cardHolder")} error={errors.holderName?.message}>
        <Input
          id="card-holder"
          autoComplete="cc-name"
          className="uppercase"
          aria-invalid={Boolean(errors.holderName)}
          aria-describedby={errors.holderName ? "card-holder-error" : undefined}
          {...form.register("holderName")}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField id="card-expiry" label={t("cardExpiry")} error={errors.expiry?.message}>
          <Controller
            control={form.control}
            name="expiry"
            render={({ field }) => (
              <Input
                id="card-expiry"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/AA"
                aria-invalid={Boolean(errors.expiry)}
                aria-describedby={errors.expiry ? "card-expiry-error" : undefined}
                value={field.value ?? ""}
                onChange={(e) => field.onChange(formatExpiry(e.target.value))}
                onBlur={field.onBlur}
              />
            )}
          />
        </FormField>
        <FormField id="card-cvv" label={t("cardCvv")} error={errors.cvv?.message}>
          <Input
            id="card-cvv"
            inputMode="numeric"
            autoComplete="cc-csc"
            maxLength={4}
            placeholder="123"
            aria-invalid={Boolean(errors.cvv)}
            aria-describedby={errors.cvv ? "card-cvv-error" : undefined}
            {...form.register("cvv")}
          />
        </FormField>
      </div>

      <FormField
        id="card-installments"
        label={t("cardInstallments")}
        error={errors.installments?.message}
      >
        <Controller
          control={form.control}
          name="installments"
          render={({ field }) => (
            <Select
              value={String(field.value ?? 1)}
              onValueChange={(value) => field.onChange(Number(value))}
              items={installmentItems}
            >
              <SelectTrigger id="card-installments" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(installmentItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
    </form>
  );
}
