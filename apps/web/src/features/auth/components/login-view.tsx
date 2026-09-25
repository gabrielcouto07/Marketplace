"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/features/auth/api";
import { Link } from "@/i18n/navigation";
import { loginSchema, type LoginFormValues } from "@/lib/validation/schemas";

import { AuthCard, GoogleButton, OrDivider } from "./auth-card";
import { FormField, PasswordInput, applyApiErrors, fieldError } from "./form-field";
import { useAuthRedirect, useRedirectIfAuthenticated } from "./use-auth-redirect";

export function LoginView() {
  const t = useTranslations("auth");
  const login = useLogin();
  const redirect = useAuthRedirect();
  useRedirectIfAuthenticated();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { register, handleSubmit, setError, formState } = form;

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: (session) => {
        toast.success(t("welcome", { name: session.user.fullName.split(" ")[0] }));
        redirect();
      },
      onError: (error) => {
        if (!applyApiErrors(error, setError)) toast.error(t("loginError"));
      },
    }),
  );

  return (
    <AuthCard
      title={t("loginTitle")}
      subtitle={t("loginSubtitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/cadastrar" className="font-semibold text-primary hover:underline">
            {t("signUp")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormField label={t("email")} error={fieldError(formState.errors, "email")}>
          {(a11y) => <Input {...a11y} type="email" inputMode="email" autoComplete="email" placeholder="voce@exemplo.com" {...register("email")} />}
        </FormField>
        <FormField label={t("password")} error={fieldError(formState.errors, "password")}>
          {(a11y) => <PasswordInput {...a11y} autoComplete="current-password" {...register("password")} />}
        </FormField>
        <div className="-mt-2 text-right">
          <Link href="/recuperar-senha" className="text-sm font-medium text-primary hover:underline">
            {t("forgotPassword")}
          </Link>
        </div>
        <Button type="submit" variant="cta" size="lg" className="w-full" disabled={login.isPending}>
          <LogIn data-icon="inline-start" />
          {t("signIn")}
        </Button>
        <p className="rounded-md bg-accent px-3 py-2 text-center text-xs text-accent-foreground">{t("demoHint")}</p>
      </form>
      <OrDivider />
      <GoogleButton />
    </AuthCard>
  );
}
