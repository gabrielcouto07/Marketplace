"use client";

import { BadgeCheck, Banknote, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";

import { useRegisterSeller } from "../api";
import { StoreForm } from "./store-form";

/** Cadastro da loja: vira vendedor, recebe nova sessão com o papel Vendedor e vai para o painel. */
export function SellerRegisterView() {
  const t = useTranslations("sellerPanel");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const register = useRegisterSeller();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>();

  const benefits = [
    { icon: Truck, text: t("registerBenefitShipping") },
    { icon: Banknote, text: t("registerBenefitPayout") },
    { icon: BadgeCheck, text: t("registerBenefitTrust") },
  ];

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

      <StoreForm
        submitLabel={t("registerSubmit")}
        submitting={register.isPending}
        serverErrors={serverErrors}
        footer={
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-4 text-body-sm text-foreground has-data-checked:border-primary">
            <Checkbox
              className="mt-0.5"
              checked={acceptTerms}
              onCheckedChange={(v) => setAcceptTerms(v === true)}
            />
            <span>{t("registerTerms")}</span>
          </label>
        }
        onSubmit={(values) => {
          if (!acceptTerms) {
            toast.error(t("registerTermsRequired"));
            return;
          }
          setServerErrors(undefined);
          register.mutate(
            { ...values, acceptTerms },
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
