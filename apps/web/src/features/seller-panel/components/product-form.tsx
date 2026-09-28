"use client";

import type { SellerProductDto, SellerProductInput } from "@marketplace/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCategories } from "@/features/catalog/api";
import { formatMoney } from "@/lib/money";
import {
  productSchema,
  type ProductFormOutput,
  type ProductFormValues,
} from "@/lib/validation/schemas";

import { GalleryUpload } from "./image-upload";

export interface ProductFormProps {
  product?: SellerProductDto;
  onSubmit: (values: SellerProductInput) => void | Promise<void>;
  submitting?: boolean;
  submitLabel: string;
  serverErrors?: Record<string, string[]>;
}

const EMPTY: ProductFormValues = {
  name: "",
  description: "",
  categoryId: "",
  priceAmount: 0,
  compareAtAmount: null,
  stock: 1,
  freeShipping: false,
  warrantyMonths: null,
  handlingDaysMin: 1,
  handlingDaysMax: 3,
  attributes: [],
  images: [],
  status: "Ativo",
};

function toFormValues(p: SellerProductDto): ProductFormValues {
  return {
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    priceAmount: p.price.amount,
    compareAtAmount: p.compareAtPrice?.amount ?? null,
    stock: p.stock,
    freeShipping: p.freeShipping,
    warrantyMonths: p.warrantyMonths,
    handlingDaysMin: p.handlingDays.min,
    handlingDaysMax: p.handlingDays.max,
    attributes: p.attributes,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt, storageKey: i.storageKey })),
    status: p.status === "Rascunho" ? "Rascunho" : "Ativo",
  };
}

/** Preço em centavos digitado "como caixa eletrônico": só dígitos, sempre formatado em BRL. */
function MoneyInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
  name,
}: {
  id: string;
  value: number | null;
  onChange: (cents: number | null) => void;
  onBlur: () => void;
  invalid?: boolean;
  describedBy?: string;
  name: string;
}) {
  return (
    <Input
      id={id}
      name={name}
      inputMode="numeric"
      className="tabular-nums"
      placeholder="R$ 0,00"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      value={value === null ? "" : formatMoney({ amount: value, currency: "BRL" })}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
        onChange(digits ? Number(digits) : null);
      }}
      onBlur={onBlur}
    />
  );
}

function IntInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
  name,
  min = 0,
  max,
  allowEmpty,
}: {
  id: string;
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  onBlur: () => void;
  invalid?: boolean;
  describedBy?: string;
  name: string;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
}) {
  return (
    <Input
      id={id}
      name={name}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      className="tabular-nums"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(e) => {
        if (e.target.value === "") onChange(allowEmpty ? null : 0);
        else onChange(Math.max(min, Math.trunc(Number(e.target.value))));
      }}
      onBlur={onBlur}
    />
  );
}

/** Cadastro/edição de produto: fotos, dados básicos, preço/estoque, envio e características. */
export function ProductForm({
  product,
  onSubmit,
  submitting,
  submitLabel,
  serverErrors,
}: ProductFormProps) {
  const t = useTranslations("sellerPanel");
  const categories = useCategories();
  const form = useForm<ProductFormValues, unknown, ProductFormOutput>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? toFormValues(product) : EMPTY,
    mode: "onBlur",
  });
  const { register, handleSubmit, control, setError, formState, watch } = form;
  const { errors } = formState;
  const attributes = useFieldArray({ control, name: "attributes" });
  const price = watch("priceAmount");
  const compareAt = watch("compareAtAmount");
  const discount =
    compareAt && price && compareAt > price
      ? Math.round(((compareAt - price) / compareAt) * 100)
      : 0;

  useEffect(() => {
    if (!serverErrors) return;
    for (const [field, messages] of Object.entries(serverErrors))
      setError(field as keyof ProductFormValues, { message: messages[0] });
  }, [serverErrors, setError]);

  const submit = handleSubmit((values) =>
    onSubmit({
      name: values.name,
      description: values.description,
      categoryId: values.categoryId,
      priceAmount: values.priceAmount,
      compareAtAmount: values.compareAtAmount,
      stock: values.stock,
      freeShipping: values.freeShipping,
      warrantyMonths: values.warrantyMonths,
      handlingDaysMin: values.handlingDaysMin,
      handlingDaysMax: values.handlingDaysMax,
      attributes: values.attributes.filter((a) => a.name && a.value),
      images: values.images.map((i) => ({
        url: i.url,
        alt: i.alt ?? null,
        storageKey: i.storageKey ?? null,
      })),
      status: values.status,
    }),
  );

  const categoryItems = Object.fromEntries((categories.data ?? []).map((c) => [c.id, c.name]));
  const describedBy = (id: string, hasError: boolean, hasHint = false) =>
    hasError ? `${id}-error` : hasHint ? `${id}-hint` : undefined;
  const imagesError = errors.images?.message ?? errors.images?.root?.message;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
        <h2 className="text-title-3 text-foreground">{t("productPhotos")}</h2>
        <FormField id="product-images" label={t("productGallery")} error={imagesError}>
          <Controller
            control={control}
            name="images"
            render={({ field }) => (
              <GalleryUpload
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(imagesError)}
                describedBy={describedBy("product-images", Boolean(imagesError))}
              />
            )}
          />
        </FormField>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
        <h2 className="text-title-3 text-foreground">{t("productBasics")}</h2>
        <FormField
          id="product-name"
          label={t("productName")}
          error={errors.name?.message}
          hint={t("productNameHint")}
        >
          <Input
            id="product-name"
            placeholder={t("productNamePlaceholder")}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={describedBy("product-name", Boolean(errors.name), true)}
            {...register("name")}
          />
        </FormField>

        <FormField
          id="product-category"
          label={t("productCategory")}
          error={errors.categoryId?.message}
        >
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) =>
              categories.isPending ? (
                <Skeleton className="h-12 rounded-md" />
              ) : (
                <Select
                  value={field.value}
                  onValueChange={(v) => field.onChange(v ?? "")}
                  items={categoryItems}
                >
                  <SelectTrigger
                    id="product-category"
                    className="w-full"
                    aria-invalid={Boolean(errors.categoryId) || undefined}
                    aria-describedby={describedBy("product-category", Boolean(errors.categoryId))}
                  >
                    <SelectValue placeholder={t("productCategoryPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            }
          />
        </FormField>

        <FormField
          id="product-description"
          label={t("productDescription")}
          error={errors.description?.message}
          hint={t("productDescriptionHint")}
        >
          <Textarea
            id="product-description"
            rows={6}
            placeholder={t("productDescriptionPlaceholder")}
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={describedBy("product-description", Boolean(errors.description), true)}
            {...register("description")}
          />
        </FormField>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
        <h2 className="text-title-3 text-foreground">{t("productPricing")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="product-price"
            label={t("productPrice")}
            error={errors.priceAmount?.message}
            hint={t("productPriceHint")}
          >
            <Controller
              control={control}
              name="priceAmount"
              render={({ field }) => (
                <MoneyInput
                  id="product-price"
                  name={field.name}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  onBlur={field.onBlur}
                  invalid={Boolean(errors.priceAmount)}
                  describedBy={describedBy("product-price", Boolean(errors.priceAmount), true)}
                />
              )}
            />
          </FormField>
          <FormField
            id="product-compare"
            label={t("productCompareAt")}
            optional
            error={errors.compareAtAmount?.message}
            hint={
              discount > 0
                ? t("productDiscountHint", { percent: discount })
                : t("productCompareAtHint")
            }
          >
            <Controller
              control={control}
              name="compareAtAmount"
              render={({ field }) => (
                <MoneyInput
                  id="product-compare"
                  name={field.name}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={Boolean(errors.compareAtAmount)}
                  describedBy={describedBy(
                    "product-compare",
                    Boolean(errors.compareAtAmount),
                    true,
                  )}
                />
              )}
            />
          </FormField>
          <FormField id="product-stock" label={t("productStock")} error={errors.stock?.message}>
            <Controller
              control={control}
              name="stock"
              render={({ field }) => (
                <IntInput
                  id="product-stock"
                  name={field.name}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  onBlur={field.onBlur}
                  invalid={Boolean(errors.stock)}
                  describedBy={describedBy("product-stock", Boolean(errors.stock))}
                />
              )}
            />
          </FormField>
          <FormField
            id="product-warranty"
            label={t("productWarranty")}
            optional
            error={errors.warrantyMonths?.message}
            hint={t("productWarrantyHint")}
          >
            <Controller
              control={control}
              name="warrantyMonths"
              render={({ field }) => (
                <IntInput
                  id="product-warranty"
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  max={120}
                  allowEmpty
                  describedBy={describedBy(
                    "product-warranty",
                    Boolean(errors.warrantyMonths),
                    true,
                  )}
                />
              )}
            />
          </FormField>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
        <h2 className="text-title-3 text-foreground">{t("productShipping")}</h2>
        <Controller
          control={control}
          name="freeShipping"
          render={({ field }) => (
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-md border border-border px-4 text-body-sm text-foreground">
              <span className="flex flex-col">
                <span className="font-medium">{t("productFreeShipping")}</span>
                <span className="text-caption text-foreground-secondary">
                  {t("productFreeShippingHint")}
                </span>
              </span>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </label>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="product-handling-min"
            label={t("productHandlingMin")}
            error={errors.handlingDaysMin?.message}
          >
            <Controller
              control={control}
              name="handlingDaysMin"
              render={({ field }) => (
                <IntInput
                  id="product-handling-min"
                  name={field.name}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  onBlur={field.onBlur}
                  max={30}
                />
              )}
            />
          </FormField>
          <FormField
            id="product-handling-max"
            label={t("productHandlingMax")}
            error={errors.handlingDaysMax?.message}
            hint={t("productHandlingHint")}
          >
            <Controller
              control={control}
              name="handlingDaysMax"
              render={({ field }) => (
                <IntInput
                  id="product-handling-max"
                  name={field.name}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                  onBlur={field.onBlur}
                  max={30}
                  invalid={Boolean(errors.handlingDaysMax)}
                  describedBy={describedBy(
                    "product-handling-max",
                    Boolean(errors.handlingDaysMax),
                    true,
                  )}
                />
              )}
            />
          </FormField>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-title-3 text-foreground">{t("productAttributes")}</h2>
          <p className="text-body-sm text-foreground-secondary">{t("productAttributesHint")}</p>
        </div>
        {attributes.fields.length ? (
          <ul className="flex flex-col gap-2">
            {attributes.fields.map((item, index) => (
              <li key={item.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  aria-label={t("attributeName")}
                  placeholder={t("attributeNamePlaceholder")}
                  {...register(`attributes.${index}.name`)}
                />
                <Input
                  aria-label={t("attributeValue")}
                  placeholder={t("attributeValuePlaceholder")}
                  {...register(`attributes.${index}.value`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("attributeRemove")}
                  onClick={() => attributes.remove(index)}
                >
                  <Trash2 strokeWidth={1.75} />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={attributes.fields.length >= 20}
          onClick={() => attributes.append({ name: "", value: "" })}
        >
          <Plus data-icon="inline-start" strokeWidth={1.75} /> {t("attributeAdd")}
        </Button>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 text-body-sm text-foreground">
              <span className="flex flex-col">
                <span className="font-medium">{t("productPublish")}</span>
                <span className="text-caption text-foreground-secondary">
                  {t("productPublishHint")}
                </span>
              </span>
              <Switch
                checked={field.value === "Ativo"}
                onCheckedChange={(checked) => field.onChange(checked ? "Ativo" : "Rascunho")}
              />
            </label>
          )}
        />
      </section>

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
