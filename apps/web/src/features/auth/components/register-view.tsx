"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useRegister } from "@/features/auth/api";
import { Link } from "@/i18n/navigation";
import { formatPhoneBr } from "@/lib/validation/documents";
import { registerSchema, type RegisterFormValues } from "@/lib/validation/schemas";

import { AuthCard, GoogleButton, OrDivider } from "./auth-card";
import { FormField, PasswordInput, applyApiErrors, fieldError, useValidationMessage } from "./form-field";
import { useAuthRedirect, useRedirectIfAuthenticated } from "./use-auth-redirect";

export function RegisterView() {
  const t = useTranslations("auth");
  const translate = useValidationMessage();
  const registerMutation = useRegister();
  const redirect = useAuthRedirect();
  useRedirectIfAuthenticated();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: "", phone: "", password: "", confirmPassword: "", acceptTerms: false },
  });
  const { register, handleSubmit, setError, control, formState } = form;

  const onSubmit = handleSubmit((values) =>
    registerMutation.mutate(
      { fullName: values.fullName, email: values.email, phone: values.phone, password: values.password },
      {
        onSuccess: (session) => {
          toast.success(t("welcome", { name: session.user.fullName.split(" ")[0] }));
          redirect();
        },
        onError: (error) => {
          if (!applyApiErrors(error, setError)) toast.error(t("loginError"));
        },
      },
    ),
  );

  const termsError = translate(fieldError(formState.errors, "acceptTerms"));

  return (
    <AuthCard
      title={t("registerTitle")}
      subtitle={t("registerSubtitle")}
      footer={
        <>
          {t("hasAccount")}{" "}
          <Link href="/entrar" className="font-semibold text-primary hover:underline">
            {t("signIn")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormField label={t("fullName")} error={fieldError(formState.errors, "fullName")}>
          {(a11y) => <Input {...a11y} autoComplete="name" {...register("fullName")} />}
        </FormField>
        <FormField label={t("email")} error={fieldError(formState.errors, "email")}>
          {(a11y) => <Input {...a11y} type="email" inputMode="email" autoComplete="email" {...register("email")} />}
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
          {(a11y) => <PasswordInput {...a11y} autoComplete="new-password" {...register("password")} />}
        </FormField>
        <FormField label={t("confirmPassword")} error={fieldError(formState.errors, "confirmPassword")}>
          {(a11y) => <PasswordInput {...a11y} autoComplete="new-password" {...register("confirmPassword")} />}
        </FormField>

        <Controller
          control={control}
          name="acceptTerms"
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-invalid={Boolean(termsError)}
                  className="mt-0.5 size-5"
                />
                <span>
                  {t.rich("acceptTerms", {
                    terms: (chunks) => (
                      <a href="#" className="font-medium text-primary underline">
                        {chunks}
                      </a>
                    ),
                    privacy: (chunks) => (
                      <a href="#" className="font-medium text-primary underline">
                        {chunks}
                      </a>
                    ),
                  })}
                </span>
              </label>
              {termsError ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {termsError}
                </p>
              ) : null}
            </div>
          )}
        />

        <Button type="submit" variant="cta" size="lg" className="w-full" disabled={registerMutation.isPending}>
          <UserPlus data-icon="inline-start" />
          {t("signUp")}
        </Button>
      </form>
      <OrDivider />
      <GoogleButton />
    </AuthCard>
  );
}
