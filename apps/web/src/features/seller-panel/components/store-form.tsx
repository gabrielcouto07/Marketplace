"use client";

import type { SellerProfileInput, SellerVerificationDto } from "@marketplace/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCategories } from "@/features/catalog/api";
import { formatRuc, onlyDigits } from "@/lib/validation/documents";
import { storeSchema, type StoreFormOutput, type StoreFormValues } from "@/lib/validation/schemas";

import { useSellerCities } from "../api";
import { SingleImageUpload } from "./image-upload";
import { VerificationSection } from "./verification-section";

/** `+595 61 500 123` → `+595 61 500 123` (mantém só dígitos, espaços e o "+" inicial). */
function normalizePhoneInput(value: string): string {
  const plus = value.trim().startsWith("+") ? "+" : "";
  return (
    plus +
    value
      .replace(/[^\d ]/g, "")
      .replace(/\s{2,}/g, " ")
      .slice(0, 20)
  );
}

export interface StoreFormProps {
  defaultValues?: Partial<StoreFormValues>;
  onSubmit: (values: SellerProfileInput) => void | Promise<void>;
  submitting?: boolean;
  submitLabel: string;
  serverErrors?: Record<string, string[]>;
  /** Conteúdo extra antes do botão (ex.: aceite de termos no cadastro). */
  footer?: ReactNode;
  /** Só no cadastro: o RUC não pode ser alterado depois pelo painel. */
  rucEditable?: boolean;
  /** Situação da verificação de documentos (perfil). */
  verification?: SellerVerificationDto | null;
}

const EMPTY: StoreFormValues = {
  name: "",
  ruc: "",
  city: "",
  description: "",
  logoUrl: null,
  bannerUrl: null,
  exchangePolicy: "",
  categoryIds: [],
  originPostalCode: "",
  phone: "",
  legalAddress: "",
  responsibleName: "",
  responsibleDocumentType: "CedulaPy",
  responsibleDocument: "",
  documentOnFile: false,
  identityDocumentUrl: null,
  rucCertificateUrl: null,
};

/** Dados da loja: nome, logo, banner, RUC, cidade de envio, bio, categorias e política de troca. */
export function StoreForm({
  defaultValues,
  onSubmit,
  submitting,
  submitLabel,
  serverErrors,
  footer,
  rucEditable = true,
  verification,
}: StoreFormProps) {
  const t = useTranslations("sellerPanel");
  const categories = useCategories();
  const cities = useSellerCities();
  const form = useForm<StoreFormValues, unknown, StoreFormOutput>({
    resolver: zodResolver(storeSchema),
    defaultValues: { ...EMPTY, ...defaultValues },
    mode: "onBlur",
  });
  const { register, handleSubmit, control, setError, formState } = form;
  const { errors } = formState;

  useEffect(() => {
    if (!serverErrors) return;
    for (const [field, messages] of Object.entries(serverErrors))
      setError(field as keyof StoreFormValues, { message: messages[0] });
  }, [serverErrors, setError]);

  // Mantém o "+" quando informado (E.164: +595 61 500 123 → +59561500123); só dígitos no resto.
  const normalizePhone = (value: string) =>
    value.trim().startsWith("+") ? `+${onlyDigits(value)}` : onlyDigits(value);

  const submit = handleSubmit((values) =>
    onSubmit({
      name: values.name,
      ruc: values.ruc,
      city: values.city,
      description: values.description,
      logoUrl: values.logoUrl,
      bannerUrl: values.bannerUrl,
      exchangePolicy: values.exchangePolicy || null,
      categoryIds: values.categoryIds,
      originPostalCode: values.originPostalCode ? onlyDigits(values.originPostalCode) : null,
      phone: values.phone ? normalizePhone(values.phone) : null,
      legalAddress: values.legalAddress,
      responsibleName: values.responsibleName,
      responsibleDocumentType: values.responsibleDocumentType,
      responsibleDocument: values.responsibleDocument || null,
      identityDocumentUrl: values.identityDocumentUrl,
      rucCertificateUrl: values.rucCertificateUrl,
    }),
  );

  const cityItems = Object.fromEntries((cities.data ?? []).map((c) => [c, c]));
  const describedBy = (id: string, hasError: boolean, hasHint = false) =>
    hasError ? `${id}-error` : hasHint ? `${id}-hint` : undefined;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-title-3 text-foreground">{t("storeIdentity")}</h2>
          <p className="text-body-sm text-foreground-secondary">{t("storeIdentityHint")}</p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <FormField id="store-logo" label={t("storeLogo")} hint={t("storeLogoHint")}>
            <Controller
              control={control}
              name="logoUrl"
              render={({ field }) => (
                <SingleImageUpload
                  id="store-logo"
                  value={field.value ?? null}
                  onChange={field.onChange}
                  label={t("storeLogo")}
                />
              )}
            />
          </FormField>
          <FormField
            id="store-banner"
            label={t("storeBanner")}
            optional
            hint={t("storeBannerHint")}
            className="flex-1"
          >
            <Controller
              control={control}
              name="bannerUrl"
              render={({ field }) => (
                <SingleImageUpload
                  id="store-banner"
                  value={field.value ?? null}
                  onChange={field.onChange}
                  shape="wide"
                  label={t("storeBanner")}
                />
              )}
            />
          </FormField>
        </div>

        <FormField id="store-name" label={t("storeName")} error={errors.name?.message}>
          <Input
            id="store-name"
            autoComplete="organization"
            placeholder={t("storeNamePlaceholder")}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={describedBy("store-name", Boolean(errors.name))}
            {...register("name")}
          />
        </FormField>

        <FormField
          id="store-description"
          label={t("storeDescription")}
          error={errors.description?.message}
          hint={t("storeDescriptionHint")}
        >
          <Textarea
            id="store-description"
            rows={4}
            placeholder={t("storeDescriptionPlaceholder")}
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={describedBy("store-description", Boolean(errors.description), true)}
            {...register("description")}
          />
        </FormField>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-title-3 text-foreground">{t("storeLegal")}</h2>
          <p className="text-body-sm text-foreground-secondary">{t("settingsStoreHint")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="store-ruc"
            label={t("rucLabel")}
            error={errors.ruc?.message}
            hint={t("rucHint")}
          >
            <Controller
              control={control}
              name="ruc"
              render={({ field }) => (
                <Input
                  id="store-ruc"
                  inputMode="numeric"
                  placeholder="80012345-0"
                  className="tabular-nums"
                  disabled={!rucEditable}
                  aria-invalid={Boolean(errors.ruc) || undefined}
                  aria-describedby={describedBy("store-ruc", Boolean(errors.ruc), true)}
                  value={field.value}
                  onChange={(e) => field.onChange(formatRuc(e.target.value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          </FormField>

          <FormField
            id="store-city"
            label={t("storeCity")}
            error={errors.city?.message}
            hint={t("storeCityHint")}
          >
            <Controller
              control={control}
              name="city"
              render={({ field }) =>
                cities.isPending ? (
                  <Skeleton className="h-12 rounded-md" />
                ) : (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v ?? "")}
                    items={cityItems}
                  >
                    <SelectTrigger
                      id="store-city"
                      className="w-full"
                      aria-invalid={Boolean(errors.city) || undefined}
                      aria-describedby={describedBy("store-city", Boolean(errors.city), true)}
                    >
                      <SelectValue placeholder={t("storeCityPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(cities.data ?? []).map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              }
            />
          </FormField>

          <FormField
            id="store-origin-cep"
            label={t("storeOriginPostalCode")}
            optional
            error={errors.originPostalCode?.message}
            hint={t("storeOriginPostalCodeHint")}
          >
            <Input
              id="store-origin-cep"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="7000"
              className="tabular-nums"
              aria-invalid={Boolean(errors.originPostalCode) || undefined}
              aria-describedby={describedBy(
                "store-origin-cep",
                Boolean(errors.originPostalCode),
                true,
              )}
              {...register("originPostalCode")}
            />
          </FormField>

          <FormField
            id="store-phone"
            label={t("storePhone")}
            optional
            error={errors.phone?.message}
            hint={t("storePhoneHint")}
          >
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Input
                  id="store-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+595 61 500 123"
                  className="tabular-nums"
                  aria-invalid={Boolean(errors.phone) || undefined}
                  aria-describedby={describedBy("store-phone", Boolean(errors.phone), true)}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(normalizePhoneInput(e.target.value))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          </FormField>
        </div>
      </section>

      <VerificationSection
        control={control}
        register={register}
        errors={errors}
        verification={verification ?? null}
        describedBy={describedBy}
      />

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
        <FormField
          id="store-categories"
          label={t("storeCategories")}
          error={errors.categoryIds?.message}
          hint={t("storeCategoriesHint")}
        >
          <Controller
            control={control}
            name="categoryIds"
            render={({ field }) => (
              <ul
                id="store-categories"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                aria-describedby={describedBy(
                  "store-categories",
                  Boolean(errors.categoryIds),
                  true,
                )}
              >
                {categories.isPending
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 rounded-md" />
                    ))
                  : (categories.data ?? []).map((category) => {
                      const checked = field.value.includes(category.id);
                      return (
                        <li key={category.id}>
                          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-border px-3 text-body-sm text-foreground transition-colors has-data-checked:border-primary has-data-checked:bg-primary-soft/50">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) =>
                                field.onChange(
                                  next === true
                                    ? [...field.value, category.id]
                                    : field.value.filter((id) => id !== category.id),
                                )
                              }
                            />
                            {category.name}
                          </label>
                        </li>
                      );
                    })}
              </ul>
            )}
          />
        </FormField>

        <FormField
          id="store-policy"
          label={t("storePolicy")}
          optional
          error={errors.exchangePolicy?.message}
          hint={t("storePolicyHint")}
        >
          <Textarea
            id="store-policy"
            rows={3}
            placeholder={t("storePolicyPlaceholder")}
            aria-describedby={describedBy("store-policy", Boolean(errors.exchangePolicy), true)}
            {...register("exchangePolicy")}
          />
        </FormField>
      </section>

      {footer}

      <Button
        type="submit"
        variant="primary"
        loading={submitting}
        className="w-full sm:w-auto sm:self-start"
      >
        {submitLabel}
      </Button>
    </form>
  );
}
