"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useRegister } from "@/features/auth/api";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPhoneBr } from "@/lib/validation/documents";
import { registerSchema, type RegisterFormValues } from "@/lib/validation/schemas";

import { ApiErrorNotice, AuthCard, GoogleButton, OrDivider } from "./auth-card";
import {
  FormField,
  PasswordInput,
  applyApiErrors,
  fieldError,
  useValidationMessage,
} from "./form-field";
import { useAuthRedirect, useRedirectIfAuthenticated } from "./use-auth-redirect";

export function RegisterView() {
  const t = useTranslations("auth");
  const translate = useValidationMessage();
  const registerMutation = useRegister();
  const redirect = useAuthRedirect();
  const [apiError, setApiError] = useState<string | null>(null);
  useRedirectIfAuthenticated();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
    mode: "onBlur",
  });
  const { register, handleSubmit, setError, control, formState } = form;

  const onSubmit = handleSubmit((values) => {
    setApiError(null);
    registerMutation.mutate(
      {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      },
      {
        onSuccess: (session) => {
          toast.success(t("welcome", { name: session.user.fullName.split(" ")[0] }));
          redirect();
        },
        onError: (error) => {
          if (!applyApiErrors(error, setError)) setApiError(t("loginError"));
        },
      },
    );
  });

  const termsError = translate(fieldError(formState.errors, "acceptTerms"));

  return (
    <AuthCard
      title={t("registerTitle")}
      subtitle={t("registerSubtitle")}
      footer={
        <>
          {t("hasAccount")}
          <Button variant="link" render={<Link href="/entrar" />}>
            {t("signIn")}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <ApiErrorNotice message={apiError} />
        <FormField label={t("fullName")} error={fieldError(formState.errors, "fullName")}>
          {(a11y) => <Input {...a11y} autoComplete="name" {...register("fullName")} />}
        </FormField>
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
        <FormField label={t("phone")} error={fieldError(formState.errors, "phone")}>
          {(a11y) => (
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Input
                  {...a11y}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="(11) 99999-9999"
                  value={formatPhoneBr(field.value ?? "")}
                  onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          )}
        </FormField>
        <FormField label={t("password")} error={fieldError(formState.errors, "password")}>
          {(a11y) => (
            <PasswordInput {...a11y} autoComplete="new-password" {...register("password")} />
          )}
        </FormField>
        <FormField
          label={t("confirmPassword")}
          error={fieldError(formState.errors, "confirmPassword")}
        >
          {(a11y) => (
            <PasswordInput {...a11y} autoComplete="new-password" {...register("confirmPassword")} />
          )}
        </FormField>

        <Controller
          control={control}
          name="acceptTerms"
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <label
                className={cn(
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-body-sm text-foreground-secondary transition-colors",
                  termsError
                    ? "border-danger"
                    : "border-border has-data-checked:border-primary has-data-checked:bg-primary-soft/50",
                )}
              >
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-invalid={Boolean(termsError)}
                  className="mt-px"
                />
                <span>
                  {t.rich("acceptTerms", {
                    terms: (chunks) => (
                      <a href="#" className="font-medium text-primary underline underline-offset-4">
                        {chunks}
                      </a>
                    ),
                    privacy: (chunks) => (
                      <a href="#" className="font-medium text-primary underline underline-offset-4">
                        {chunks}
                      </a>
                    ),
                  })}
                </span>
              </label>
              {termsError ? (
                <p
                  role="alert"
                  className="flex items-start gap-1.5 text-caption font-medium text-danger"
                >
                  <AlertCircle className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {termsError}
                </p>
              ) : null}
            </div>
          )}
        />

        <Button type="submit" variant="primary" fullWidth loading={registerMutation.isPending}>
          {t("signUp")}
        </Button>
      </form>
      <OrDivider />
      <GoogleButton />
    </AuthCard>
  );
}
