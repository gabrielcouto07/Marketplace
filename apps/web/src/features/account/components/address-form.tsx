"use client";

import type { AddressInput } from "@marketplace/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePostalCodeLookup } from "@/features/shipping/api";
import { formatCep, formatPhoneBr, onlyDigits } from "@/lib/validation/documents";
import { addressSchema, type AddressFormOutput, type AddressFormValues } from "@/lib/validation/schemas";

export interface AddressFormProps {
  defaultValues?: Partial<AddressFormValues>;
  onSubmit: (values: AddressInput) => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
  /** Erros por campo vindos da API (ApiError.errors). */
  serverErrors?: Record<string, string[]>;
}

const EMPTY: AddressFormValues = {
  label: "",
  recipientName: "",
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  phone: "",
  isDefault: false,
};

/** Formulário de endereço (BR) com busca de CEP automática e validação Zod. */
export function AddressForm({ defaultValues, onSubmit, submitting, submitLabel, serverErrors }: AddressFormProps) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const form = useForm<AddressFormValues, unknown, AddressFormOutput>({
    resolver: zodResolver(addressSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    mode: "onBlur",
  });
  const { register, handleSubmit, control, watch, setValue, getValues, setError, formState } = form;
  const { errors } = formState;

  const cep = onlyDigits(watch("postalCode") ?? "");
  const lookup = usePostalCodeLookup(cep);

  useEffect(() => {
    if (!lookup.data) return;
    const current = getValues();
    if (!current.street) setValue("street", lookup.data.street, { shouldValidate: true });
    if (!current.neighborhood) setValue("neighborhood", lookup.data.neighborhood, { shouldValidate: true });
    if (!current.city) setValue("city", lookup.data.city, { shouldValidate: true });
    if (!current.state) setValue("state", lookup.data.state, { shouldValidate: true });
  }, [lookup.data, getValues, setValue]);

  useEffect(() => {
    if (!serverErrors) return;
    for (const [field, messages] of Object.entries(serverErrors)) {
      setError(field as keyof AddressFormValues, { message: messages[0] });
    }
  }, [serverErrors, setError]);

  const submit = handleSubmit((values) => {
    const payload: AddressInput = {
      label: values.label,
      recipientName: values.recipientName,
      postalCode: values.postalCode,
      street: values.street,
      number: values.number,
      complement: values.complement ? values.complement : null,
      neighborhood: values.neighborhood,
      city: values.city,
      state: values.state.toUpperCase(),
      phone: values.phone ? values.phone : null,
      isDefault: values.isDefault,
    };
    return onSubmit(payload);
  });

  const cepError = errors.postalCode?.message ?? (lookup.isError ? "invalidCep" : undefined);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField id="addr-label" label={t("addressLabel")} error={errors.label?.message}>
          <Input id="addr-label" autoComplete="off" aria-invalid={Boolean(errors.label)} {...register("label")} />
        </FormField>
        <FormField id="addr-cep" label={t("postalCode")} error={cepError}>
          <div className="relative">
            <Controller
              control={control}
              name="postalCode"
              render={({ field }) => (
                <Input
                  id="addr-cep"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                  aria-invalid={Boolean(cepError)}
                  value={formatCep(field.value ?? "")}
                  onChange={(e) => field.onChange(onlyDigits(e.target.value).slice(0, 8))}
                  onBlur={field.onBlur}
                />
              )}
            />
            {lookup.isFetching ? (
              <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label={tc("loading")} />
            ) : null}
          </div>
        </FormField>
      </div>

      <FormField id="addr-recipient" label={t("recipient")} error={errors.recipientName?.message}>
        <Input id="addr-recipient" autoComplete="name" aria-invalid={Boolean(errors.recipientName)} {...register("recipientName")} />
      </FormField>

      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <FormField id="addr-street" label={t("street")} error={errors.street?.message}>
          <Input id="addr-street" autoComplete="address-line1" aria-invalid={Boolean(errors.street)} {...register("street")} />
        </FormField>
        <FormField id="addr-number" label={t("number")} error={errors.number?.message}>
          <Input id="addr-number" inputMode="numeric" aria-invalid={Boolean(errors.number)} {...register("number")} />
        </FormField>
      </div>

      <FormField id="addr-complement" label={t("complement")} optional error={errors.complement?.message}>
        <Input id="addr-complement" autoComplete="address-line2" {...register("complement")} />
      </FormField>

      <FormField id="addr-neighborhood" label={t("neighborhood")} error={errors.neighborhood?.message}>
        <Input id="addr-neighborhood" aria-invalid={Boolean(errors.neighborhood)} {...register("neighborhood")} />
      </FormField>

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <FormField id="addr-city" label={t("city")} error={errors.city?.message}>
          <Input id="addr-city" autoComplete="address-level2" aria-invalid={Boolean(errors.city)} {...register("city")} />
        </FormField>
        <FormField id="addr-state" label={t("state")} error={errors.state?.message}>
          <Input id="addr-state" maxLength={2} autoComplete="address-level1" className="uppercase" aria-invalid={Boolean(errors.state)} {...register("state")} />
        </FormField>
      </div>

      <FormField id="addr-phone" label={t("phone")} optional error={errors.phone?.message}>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <Input
              id="addr-phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 99999-9999"
              value={formatPhoneBr(field.value ?? "")}
              onChange={(e) => field.onChange(onlyDigits(e.target.value).slice(0, 11))}
              onBlur={field.onBlur}
            />
          )}
        />
      </FormField>

      <Controller
        control={control}
        name="isDefault"
        render={({ field }) => (
          <Label className="min-h-11 cursor-pointer">
            <Checkbox id="addr-default" checked={Boolean(field.value)} onCheckedChange={(checked) => field.onChange(checked === true)} />
            {t("setDefault")}
          </Label>
        )}
      />

      <Button type="submit" variant="cta" size="lg" disabled={submitting} className="mt-2">
        {submitting ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        {submitLabel ?? tc("save")}
      </Button>
    </form>
  );
}
