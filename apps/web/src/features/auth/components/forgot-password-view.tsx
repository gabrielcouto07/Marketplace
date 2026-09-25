"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Illustration } from "@/components/shared/illustrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForgotPassword } from "@/features/auth/api";
import { Link } from "@/i18n/navigation";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validation/schemas";

import { ApiErrorNotice, AuthCard } from "./auth-card";
import { FormField, applyApiErrors, fieldError } from "./form-field";

export function ForgotPasswordView() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const forgot = useForgotPassword();
  const [apiError, setApiError] = useState<string | null>(null);

  const { register, handleSubmit, setError, formState } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
    mode: "onBlur",
  });

  const onSubmit = handleSubmit((values) => {
    setApiError(null);
    forgot.mutate(values, {
      onError: (error) => {
        if (!applyApiErrors(error, setError)) setApiError(tErrors("genericTitle"));
      },
    });
  });

  return (
    <AuthCard
      title={t("forgotTitle")}
      subtitle={t("forgotSubtitle")}
      footer={
        <Button variant="link" render={<Link href="/entrar" />}>
          {t("backToLogin")}
        </Button>
      }
    >
      {forgot.isSuccess ? (
        <div role="status" className="flex flex-col items-center gap-4 py-4 text-center">
          <Illustration name="check" />
          <p className="max-w-[280px] text-body-sm text-foreground-secondary">{t("linkSent")}</p>
          <Button variant="secondary" render={<Link href="/entrar" />}>
            {t("backToLogin")}
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <ApiErrorNotice message={apiError} />
          <FormField label={t("email")} error={fieldError(formState.errors, "email")}>
            {(a11y) => (
              <Input
                {...a11y}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                {...register("email")}
              />
            )}
          </FormField>
          <Button type="submit" variant="primary" fullWidth loading={forgot.isPending}>
            {t("sendLink")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
