"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/features/auth/api";
import { Link } from "@/i18n/navigation";
import { loginSchema, type LoginFormValues } from "@/lib/validation/schemas";

import { ApiErrorNotice, AuthCard, DemoHint, GoogleButton, OrDivider } from "./auth-card";
import { FormField, PasswordInput, applyApiErrors, fieldError } from "./form-field";
import { useAuthRedirect, useRedirectIfAuthenticated } from "./use-auth-redirect";

export function LoginView() {
  const t = useTranslations("auth");
  const login = useLogin();
  const redirect = useAuthRedirect();
  const [apiError, setApiError] = useState<string | null>(null);
  useRedirectIfAuthenticated();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });
  const { register, handleSubmit, setError, formState } = form;

  const onSubmit = handleSubmit((values) => {
    setApiError(null);
    login.mutate(values, {
      onSuccess: (session) => {
        toast.success(t("welcome", { name: session.user.fullName.split(" ")[0] }));
        redirect();
      },
      onError: (error) => {
        if (!applyApiErrors(error, setError)) setApiError(t("loginError"));
      },
    });
  });

  return (
    <AuthCard
      title={t("loginTitle")}
      subtitle={t("loginSubtitle")}
      footer={
        <>
          {t("noAccount")}
          <Button variant="link" render={<Link href="/cadastrar" />}>
            {t("signUp")}
          </Button>
        </>
      }
    >
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
        <FormField label={t("password")} error={fieldError(formState.errors, "password")}>
          {(a11y) => (
            <PasswordInput {...a11y} autoComplete="current-password" {...register("password")} />
          )}
        </FormField>
        <div className="flex justify-end">
          <Button variant="link" render={<Link href="/recuperar-senha" />}>
            {t("forgotPassword")}
          </Button>
        </div>
        <Button type="submit" variant="primary" fullWidth loading={login.isPending}>
          {t("signIn")}
        </Button>
        <DemoHint>{t("demoHint")}</DemoHint>
      </form>
      <OrDivider />
      <GoogleButton />
    </AuthCard>
  );
}
