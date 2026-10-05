"use client";

import type { SellerVerificationDto } from "@marketplace/contracts";
import { BadgeCheck, Clock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";

import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StoreFormValues } from "@/lib/validation/schemas";

import { SingleImageUpload } from "./image-upload";

/**
 * Responsável e documentos da loja (política de admissão de vendedores — Portaria Coana 130/2023, art. 8º, V) e o
 * endereço completo de origem, que sai como remetente na declaração e na etiqueta. A equipe confere antes de aprovar.
 */
export function VerificationSection({
  control,
  register,
  errors,
  verification,
  describedBy,
}: {
  control: Control<StoreFormValues>;
  register: UseFormRegister<StoreFormValues>;
  errors: FieldErrors<StoreFormValues>;
  verification: SellerVerificationDto | null;
  describedBy: (id: string, hasError: boolean, hasHint?: boolean) => string | undefined;
}) {
  const t = useTranslations("sellerPanel");
  const format = useFormatter();
  const docTypes = { CedulaPy: t("docCedulaPy"), Cpf: t("docCpf"), Passaporte: t("docPassport") };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-title-3 text-foreground">{t("verificationTitle")}</h2>
        <p className="text-body-sm text-foreground-secondary">{t("verificationHint")}</p>
        {verification ? (
          verification.verifiedAt ? (
            <p className="flex items-center gap-1.5 text-body-sm font-medium text-success">
              <BadgeCheck className="size-4" strokeWidth={2} aria-hidden />
              {t("verificationDone", { date: format.dateTime(new Date(verification.verifiedAt), "short") })}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-body-sm font-medium text-warning">
              <Clock className="size-4" strokeWidth={2} aria-hidden />
              {t("verificationPending")}
            </p>
          )
        ) : null}
      </div>

      <FormField id="store-legal-address" label={t("legalAddress")} hint={t("legalAddressHint")} error={errors.legalAddress?.message}>
        <Input
          id="store-legal-address"
          autoComplete="street-address"
          placeholder={t("legalAddressPlaceholder")}
          aria-invalid={Boolean(errors.legalAddress) || undefined}
          aria-describedby={describedBy("store-legal-address", Boolean(errors.legalAddress), true)}
          {...register("legalAddress")}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="store-responsible" label={t("responsibleName")} error={errors.responsibleName?.message}>
          <Input
            id="store-responsible"
            autoComplete="name"
            aria-invalid={Boolean(errors.responsibleName) || undefined}
            aria-describedby={describedBy("store-responsible", Boolean(errors.responsibleName))}
            {...register("responsibleName")}
          />
        </FormField>
        <FormField id="store-doc-type" label={t("responsibleDocumentType")} error={errors.responsibleDocumentType?.message}>
          <Controller
            control={control}
            name="responsibleDocumentType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "CedulaPy")} items={docTypes}>
                <SelectTrigger id="store-doc-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(docTypes).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>

      <FormField
        id="store-doc"
        label={t("responsibleDocument")}
        hint={verification?.responsibleDocumentMasked ? t("responsibleDocumentOnFile", { doc: verification.responsibleDocumentMasked }) : undefined}
        error={errors.responsibleDocument?.message}
      >
        <Input
          id="store-doc"
          autoComplete="off"
          className="tabular-nums"
          placeholder={verification?.responsibleDocumentMasked ?? ""}
          aria-invalid={Boolean(errors.responsibleDocument) || undefined}
          aria-describedby={describedBy("store-doc", Boolean(errors.responsibleDocument), Boolean(verification?.responsibleDocumentMasked))}
          {...register("responsibleDocument")}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="store-identity-doc" label={t("identityDocument")} hint={t("identityDocumentHint")} error={errors.identityDocumentUrl?.message}>
          <Controller
            control={control}
            name="identityDocumentUrl"
            render={({ field }) => (
              <SingleImageUpload id="store-identity-doc" value={field.value ?? null} onChange={field.onChange} label={t("identityDocument")} />
            )}
          />
        </FormField>
        <FormField id="store-ruc-certificate" label={t("rucCertificate")} hint={t("rucCertificateHint")} error={errors.rucCertificateUrl?.message}>
          <Controller
            control={control}
            name="rucCertificateUrl"
            render={({ field }) => (
              <SingleImageUpload id="store-ruc-certificate" value={field.value ?? null} onChange={field.onChange} label={t("rucCertificate")} />
            )}
          />
        </FormField>
      </div>
    </section>
  );
}
