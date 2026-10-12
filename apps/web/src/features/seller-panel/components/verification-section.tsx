"use client";

import type { SellerVerificationDto } from "@marketplace/contracts";
import { BadgeCheck, Clock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { Controller } from "react-hook-form";

import { DocumentUpload } from "@/components/shared/document-upload";
import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StoreFormValues } from "@/lib/validation/schemas";

import { uploadDocument } from "../api";

type DescribedBy = (id: string, hasError: boolean, hasHint?: boolean) => string | undefined;

interface SectionProps {
  control: Control<StoreFormValues>;
  register: UseFormRegister<StoreFormValues>;
  errors: FieldErrors<StoreFormValues>;
  verification: SellerVerificationDto | null;
  describedBy: DescribedBy;
}

type DocumentField = "identityDocumentUrl" | "rucCertificateUrl" | "taxComplianceCertificateUrl" | "articlesOfIncorporationUrl";

/**
 * Representante legal e documentos da loja (Política de Vendedores 3.2): atos constitutivos e registro comercial,
 * Constancia de RUC, Certificado de Cumplimiento Tributario e documento com foto do representante. Mais o endereço
 * completo de origem, que sai como remetente na declaração e na etiqueta. A equipe confere tudo antes de liberar as
 * vendas (3.3); os arquivos ficam em armazenamento privado (9.4).
 */
export function VerificationSection({ control, register, errors, verification, describedBy }: SectionProps) {
  const t = useTranslations("sellerPanel");
  const format = useFormatter();
  const docTypes = { CedulaPy: t("docCedulaPy"), Cpf: t("docCpf"), Passaporte: t("docPassport") };

  const documents: Array<{ name: DocumentField; label: string; hint: string }> = [
    { name: "articlesOfIncorporationUrl", label: t("articlesOfIncorporation"), hint: t("articlesOfIncorporationHint") },
    { name: "rucCertificateUrl", label: t("rucCertificate"), hint: t("rucCertificateHint") },
    { name: "taxComplianceCertificateUrl", label: t("taxComplianceCertificate"), hint: t("taxComplianceCertificateHint") },
    { name: "identityDocumentUrl", label: t("identityDocument"), hint: t("identityDocumentHint") },
  ];

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

      <div className="flex flex-col gap-1">
        <h3 className="text-body font-semibold text-foreground">{t("documentsTitle")}</h3>
        <p className="text-caption text-foreground-secondary">{t("documentsHint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {documents.map((doc) => {
          const id = `store-${doc.name}`;
          const error = errors[doc.name]?.message;
          return (
            <FormField key={doc.name} id={id} label={doc.label} hint={doc.hint} error={error}>
              <Controller
                control={control}
                name={doc.name}
                render={({ field }) => (
                  <DocumentUpload
                    id={id}
                    value={field.value ?? null}
                    onChange={field.onChange}
                    label={doc.label}
                    upload={uploadDocument}
                    invalid={Boolean(error)}
                    describedBy={describedBy(id, Boolean(error), true)}
                  />
                )}
              />
            </FormField>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Meio de recebimento associado à loja (Política de Vendedores 3.1 e): conta bancária, carteira digital ou outro. A
 * conta volta mascarada; deixar o campo vazio mantém a já informada.
 */
export function PayoutSection({ control, register, errors, verification, describedBy }: SectionProps) {
  const t = useTranslations("sellerPanel");
  const methods = {
    ContaBancaria: t("payoutMethodBank"),
    CarteiraDigital: t("payoutMethodWallet"),
    Outro: t("payoutMethodOther"),
  };
  const masked = verification?.payoutAccountMasked;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-title-3 text-foreground">{t("payoutTitle")}</h2>
        <p className="text-body-sm text-foreground-secondary">{t("payoutHint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="store-payout-method" label={t("payoutMethod")} error={errors.payoutMethod?.message}>
          <Controller
            control={control}
            name="payoutMethod"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "ContaBancaria")} items={methods}>
                <SelectTrigger id="store-payout-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(methods).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
        <FormField
          id="store-payout-institution"
          label={t("payoutInstitution")}
          optional
          hint={t("payoutInstitutionHint")}
          error={errors.payoutInstitution?.message}
        >
          <Input
            id="store-payout-institution"
            aria-invalid={Boolean(errors.payoutInstitution) || undefined}
            aria-describedby={describedBy("store-payout-institution", Boolean(errors.payoutInstitution), true)}
            {...register("payoutInstitution")}
          />
        </FormField>
        <FormField
          id="store-payout-account"
          label={t("payoutAccount")}
          hint={masked ? t("payoutAccountOnFile", { account: masked }) : t("payoutAccountHint")}
          error={errors.payoutAccount?.message}
        >
          <Input
            id="store-payout-account"
            autoComplete="off"
            className="tabular-nums"
            placeholder={masked ?? ""}
            aria-invalid={Boolean(errors.payoutAccount) || undefined}
            aria-describedby={describedBy("store-payout-account", Boolean(errors.payoutAccount), true)}
            {...register("payoutAccount")}
          />
        </FormField>
        <FormField id="store-payout-holder" label={t("payoutHolder")} hint={t("payoutHolderHint")} error={errors.payoutHolder?.message}>
          <Input
            id="store-payout-holder"
            autoComplete="organization"
            aria-invalid={Boolean(errors.payoutHolder) || undefined}
            aria-describedby={describedBy("store-payout-holder", Boolean(errors.payoutHolder), true)}
            {...register("payoutHolder")}
          />
        </FormField>
      </div>
    </section>
  );
}
