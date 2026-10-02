"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Illustration } from "@/components/shared/illustrations";
import { Button } from "@/components/ui/button";
import { useResetPassword } from "@/features/auth/api";
import { useAuthStore } from "@/features/auth/store";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validation/schemas";

import { ApiErrorNotice, AuthCard } from "./auth-card";
import { FormField, PasswordInput, applyApiErrors, fieldError } from "./form-field";

/**
 * Destino do link enviado por "Esqueci minha senha" (`/redefinir-senha?token=…`). O backend revoga todas as
 * sessões antigas ao trocar a senha, então a sessão local (se houver) também é encerrada.
 */
export function ResetPasswordView() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const token = useSearchParams().get("token") ?? "";
  const reset = useResetPassword();
  const signOut = useAuthStore((s) => s.signOut);
  const [apiError, setApiError] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(!token);

  const { register, handleSubmit, setError, formState } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const onSubmit = handleSubmit((values) => {
    setApiError(null);
    reset.mutate(
      { token, password: values.password },
      {
        onSuccess: () => signOut(),
        onError: (error) => {
          // 422 em "token" = link vencido ou já usado: o formulário não ajuda mais, só pedir outro link.
          if (isApiError(error) && error.errors?.token) {
            setLinkInvalid(true);
            return;
          }
          if (!applyApiErrors(error, setError)) setApiError(tErrors("genericTitle"));
        },
      },
    );
  });

  const footer = (
    <Button variant="link" render={<Link href="/entrar" />}>
      {t("backToLogin")}
    </Button>
  );

  if (linkInvalid) {
    return (
      <AuthCard title={t("resetTitle")} footer={footer}>
        <div role="alert" className="flex flex-col items-center gap-4 py-4 text-center">
          <Illustration name="alert" />
          <p className="max-w-[280px] text-body-sm text-foreground-secondary">
            {t("resetInvalidLink")}
          </p>
          <Button variant="primary" render={<Link href="/recuperar-senha" />}>
            {t("requestNewLink")}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("resetTitle")} subtitle={t("resetSubtitle")} footer={footer}>
      {reset.isSuccess ? (
        <div role="status" className="flex flex-col items-center gap-4 py-4 text-center">
          <Illustration name="check" />
          <p className="max-w-[280px] text-body-sm text-foreground-secondary">{t("resetSuccess")}</p>
          <Button variant="primary" render={<Link href="/entrar" />}>
            {t("signIn")}
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <ApiErrorNotice message={apiError} />
          <FormField label={t("newPassword")} error={fieldError(formState.errors, "password")}>
            {(a11y) => (
              <PasswordInput {...a11y} autoComplete="new-password" {...register("password")} />
            )}
          </FormField>
          <FormField
            label={t("confirmPassword")}
            error={fieldError(formState.errors, "confirmPassword")}
          >
            {(a11y) => (
              <PasswordInput
                {...a11y}
                autoComplete="new-password"
                {...register("confirmPassword")}
              />
            )}
          </FormField>
          <Button type="submit" variant="primary" fullWidth loading={reset.isPending}>
            {t("savePassword")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
