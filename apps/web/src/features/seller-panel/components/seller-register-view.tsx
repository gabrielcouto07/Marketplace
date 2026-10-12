"use client";

import { BadgeCheck, Banknote, FileText, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useSellerPolicy } from "@/features/compliance/api";
import { SellerPolicyText } from "@/features/compliance/components/seller-policy-text";
import { Link, useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";

import { useRegisterSeller } from "../api";
import { StoreForm } from "./store-form";

/**
 * Cadastro da loja: a Política de Vendedores é apresentada antes do cadastro (item 2.3) e o representante legal a aceita
 * eletronicamente (2.2; a API grava data, hora, IP e quem aceitou). Depois a loja vira vendedora, recebe nova sessão
 * com o papel Vendedor e vai para o painel; as vendas ficam liberadas só depois da verificação da equipe (3.3).
 */
export function SellerRegisterView() {
  const t = useTranslations("sellerPanel");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const register = useRegisterSeller();
  const policy = useSellerPolicy();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [representative, setRepresentative] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>();

  const benefits = [
    { icon: Truck, text: t("registerBenefitShipping") },
    { icon: Banknote, text: t("registerBenefitPayout") },
    { icon: BadgeCheck, text: t("registerBenefitTrust") },
  ];

  const checkbox = (checked: boolean, onChange: (v: boolean) => void, label: ReactNode) => (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-4 text-body-sm text-foreground has-data-checked:border-primary">
      <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div>
        <PanelTitle className="mb-2">{t("registerTitle")}</PanelTitle>
        <p className="text-body text-foreground-secondary">{t("registerSubtitle")}</p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-3">
        {benefits.map(({ icon: Icon, text }) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-md bg-primary-soft/60 px-4 py-3 text-body-sm text-foreground"
          >
            <Icon className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
            {text}
          </li>
        ))}
      </ul>

      <section aria-labelledby="register-policy" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id="register-policy" className="flex items-center gap-2 text-title-3 text-foreground">
            <FileText className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
            {t("registerPolicyTitle")}
          </h2>
          <p className="text-body-sm text-foreground-secondary">
            {t.rich("registerPolicyHint", {
              link: (chunks) => (
                <Link href="/politica-de-vendedores" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
        <div tabIndex={0} className="max-h-80 overflow-y-auto rounded-md border border-border bg-surface-muted p-4 focus-ring" aria-label={t("registerPolicyTitle")}>
          {policy.data ? <SellerPolicyText policy={policy.data} compact /> : <Skeleton className="h-40" />}
        </div>
      </section>

      <StoreForm
        submitLabel={t("registerSubmit")}
        submitting={register.isPending}
        serverErrors={serverErrors}
        footer={
          <div className="flex flex-col gap-3">
            {checkbox(
              acceptPolicy,
              setAcceptPolicy,
              t("registerPolicyAccept", { version: policy.data?.version ?? "" }),
            )}
            {checkbox(representative, setRepresentative, t("registerRepresentative"))}
            {checkbox(acceptTerms, setAcceptTerms, t("registerTerms"))}
          </div>
        }
        onSubmit={(values) => {
          if (!acceptPolicy || !representative) {
            toast.error(t("registerPolicyRequired"));
            return;
          }
          if (!acceptTerms) {
            toast.error(t("registerTermsRequired"));
            return;
          }
          setServerErrors(undefined);
          register.mutate(
            { ...values, acceptTerms, acceptSellerPolicy: acceptPolicy, representativeDeclaration: representative },
            {
              onSuccess: () => {
                toast.success(t("registerSuccess"));
                router.replace("/vendedor");
              },
              onError: (error) => {
                if (isApiError(error) && error.errors) setServerErrors(error.errors);
                else toast.error(isApiError(error) ? error.message : tErrors("genericTitle"));
              },
            },
          );
        }}
      />
    </div>
  );
}
