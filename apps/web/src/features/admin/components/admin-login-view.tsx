"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/features/auth/api";
import { ApiErrorNotice, AuthCard } from "@/features/auth/components/auth-card";
import {
  FormField,
  PasswordInput,
  applyApiErrors,
  fieldError,
} from "@/features/auth/components/form-field";
import { useAuthStore } from "@/features/auth/store";
import { useRouter } from "@/i18n/navigation";
import { loginSchema, type LoginFormValues } from "@/lib/validation/schemas";

/** Link alternativo de acesso: /admin/entrar. Só contas com o papel Admin passam. */
export function AdminLoginView() {
  const t = useTranslations("admin");
  const tAuth = useTranslations("auth");
  const login = useLogin();
  const signOut = useAuthStore((s) => s.signOut);
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  const { register, handleSubmit, setError, formState } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const onSubmit = handleSubmit((values) => {
    setApiError(null);
    login.mutate(values, {
      onSuccess: (session) => {
        if (!session.user.roles.includes("Admin")) {
          signOut();
          setApiError(t("loginNotAdmin"));
          return;
        }
        toast.success(t("loginWelcome", { name: session.user.fullName.split(" ")[0] }));
        router.replace("/admin");
      },
      onError: (error) => {
        if (!applyApiErrors(error, setError)) setApiError(tAuth("loginError"));
      },
    });
  });

  return (
    <AuthCard title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <p className="flex items-center gap-2 rounded-md bg-primary-soft/60 px-3 py-2 text-caption text-foreground-secondary">
          <ShieldCheck className="size-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
          <span>{t("loginRestricted")}</span>
        </p>
        <ApiErrorNotice message={apiError} />
        <FormField label={tAuth("email")} error={fieldError(formState.errors, "email")}>
          {(a11y) => (
            <Input
              {...a11y}
              type="email"
              inputMode="email"
              autoComplete="username"
              {...register("email")}
            />
          )}
        </FormField>
        <FormField label={tAuth("password")} error={fieldError(formState.errors, "password")}>
          {(a11y) => (
            <PasswordInput {...a11y} autoComplete="current-password" {...register("password")} />
          )}
        </FormField>
        <Button type="submit" variant="primary" fullWidth loading={login.isPending}>
          {t("loginSubmit")}
        </Button>
      </form>
    </AuthCard>
  );
}
