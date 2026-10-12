"use client";

import { FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildDeclaration } from "@/lib/compliance/declaration";
import { countryOptions } from "@/lib/countries";
import type { ProductFormValues } from "@/lib/validation/schemas";

/**
 * Descrição da mercadoria na declaração de importação (Programa de Conformidade 7.4 e 7.6): natureza, marca e modelo
 * quando houver, material, quantidade e país de origem, sem expressões genéricas. Obrigatória para publicar; a prévia
 * mostra exatamente o texto que vai ao operador logístico.
 */
export function DeclarationSection({
  control,
  register,
  errors,
  describedBy,
}: {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  describedBy: (id: string, hasError: boolean, hasHint?: boolean) => string | undefined;
}) {
  const t = useTranslations("sellerPanel");
  const locale = useLocale();
  const countries = useMemo(() => countryOptions(locale), [locale]);
  const countryItems = useMemo(() => Object.fromEntries(countries.map((c) => [c.code, c.name])), [countries]);
  const [nature, brand, unbranded, model, material, quantity] = useWatch({
    control,
    name: ["nature", "brand", "unbranded", "model", "material", "packageQuantity"],
  });
  const preview =
    (nature ?? "").trim().length >= 3 && (material ?? "").trim().length >= 2 && (unbranded || (brand ?? "").trim())
      ? buildDeclaration({ nature: nature ?? "", brand, unbranded, model, material: material ?? "", quantity: quantity ?? 1 })
      : null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-title-3 text-foreground">{t("declarationTitle")}</h2>
        <p className="text-body-sm text-foreground-secondary">{t("declarationHint")}</p>
      </div>

      <FormField id="product-nature" label={t("declarationNature")} hint={t("declarationNatureHint")} error={errors.nature?.message}>
        <Input
          id="product-nature"
          placeholder={t("declarationNaturePlaceholder")}
          maxLength={120}
          aria-invalid={Boolean(errors.nature) || undefined}
          aria-describedby={describedBy("product-nature", Boolean(errors.nature), true)}
          {...register("nature")}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="product-brand" label={t("declarationBrand")} error={errors.brand?.message}>
          <Input
            id="product-brand"
            maxLength={80}
            disabled={Boolean(unbranded)}
            aria-invalid={Boolean(errors.brand) || undefined}
            aria-describedby={describedBy("product-brand", Boolean(errors.brand))}
            {...register("brand")}
          />
          <Controller
            control={control}
            name="unbranded"
            render={({ field }) => (
              <label className="flex cursor-pointer items-center gap-2 text-body-sm text-foreground">
                <Checkbox checked={Boolean(field.value)} onCheckedChange={(v) => field.onChange(v === true)} />
                {t("declarationUnbranded")}
              </label>
            )}
          />
        </FormField>
        <FormField id="product-model" label={t("declarationModel")} optional hint={t("declarationModelHint")} error={errors.model?.message}>
          <Input
            id="product-model"
            maxLength={80}
            aria-invalid={Boolean(errors.model) || undefined}
            aria-describedby={describedBy("product-model", Boolean(errors.model), true)}
            {...register("model")}
          />
        </FormField>
        <FormField id="product-material" label={t("declarationMaterial")} hint={t("declarationMaterialHint")} error={errors.material?.message}>
          <Input
            id="product-material"
            maxLength={160}
            placeholder={t("declarationMaterialPlaceholder")}
            aria-invalid={Boolean(errors.material) || undefined}
            aria-describedby={describedBy("product-material", Boolean(errors.material), true)}
            {...register("material")}
          />
        </FormField>
        <FormField
          id="product-package-quantity"
          label={t("declarationQuantity")}
          hint={t("declarationQuantityHint")}
          error={errors.packageQuantity?.message}
        >
          <Controller
            control={control}
            name="packageQuantity"
            render={({ field }) => (
              <Input
                id="product-package-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                className="tabular-nums"
                aria-invalid={Boolean(errors.packageQuantity) || undefined}
                aria-describedby={describedBy("product-package-quantity", Boolean(errors.packageQuantity), true)}
                value={field.value === undefined || field.value === null ? "" : String(field.value)}
                onChange={(e) => field.onChange(e.target.value === "" ? 1 : Math.max(1, Math.trunc(Number(e.target.value))))}
                onBlur={field.onBlur}
                name={field.name}
              />
            )}
          />
        </FormField>
        <FormField
          id="product-origin-country"
          label={t("declarationOrigin")}
          hint={t("declarationOriginHint")}
          error={errors.originCountry?.message}
          className="sm:col-span-2"
        >
          <Controller
            control={control}
            name="originCountry"
            render={({ field }) => (
              <Select value={field.value || null} onValueChange={(v) => field.onChange(v ?? "")} items={countryItems}>
                <SelectTrigger
                  id="product-origin-country"
                  className="w-full"
                  aria-invalid={Boolean(errors.originCountry) || undefined}
                  aria-describedby={describedBy("product-origin-country", Boolean(errors.originCountry), true)}
                >
                  <SelectValue placeholder={t("declarationOriginPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{t("declarationOriginCommon")}</SelectLabel>
                    {countries
                      .filter((c) => c.common)
                      .map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>{t("declarationOriginAll")}</SelectLabel>
                    {countries
                      .filter((c) => !c.common)
                      .map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>

      <div className="flex items-start gap-3 rounded-md bg-surface-muted p-3">
        <FileText className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-caption font-semibold text-foreground-secondary uppercase">{t("declarationPreview")}</p>
          <p className="text-body-sm text-foreground">{preview ?? t("declarationPreviewEmpty")}</p>
        </div>
      </div>
    </section>
  );
}
