"use client";

import type { SellerProfileInput } from "@marketplace/contracts";
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
import { formatRuc } from "@/lib/validation/documents";
import { storeSchema, type StoreFormOutput, type StoreFormValues } from "@/lib/validation/schemas";

import { useSellerCities } from "../api";
import { SingleImageUpload } from "./image-upload";

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
        </div>
      </section>

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
