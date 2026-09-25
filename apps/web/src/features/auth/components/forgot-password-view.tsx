"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForgotPassword } from "@/features/auth/api";
import { Link } from "@/i18n/navigation";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validation/schemas";

import { AuthCard } from "./auth-card";
import { FormField, applyApiErrors, fieldError } from "./form-field";

export function ForgotPasswordView() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const forgot = useForgotPassword();

  const { register, handleSubmit, setError, formState } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) =>
    forgot.mutate(values, {
      onError: (error) => {
        if (!applyApiErrors(error, setError)) toast.error(tErrors("genericTitle"));
      },
    }),
  );

  return (
    <AuthCard
      title={t("forgotTitle")}
      subtitle={t("forgotSubtitle")}
      footer={
        <Link href="/entrar" className="font-bold text-primary hover:underline">
          {t("backToLogin")}
        </Link>
      }
    >
      {forgot.isSuccess ? (
        <div
          role="status"
          className="flex animate-pop flex-col items-center gap-4 py-4 text-center"
        >
          <span className="flex size-[72px] items-center justify-center rounded-3xl bg-success-soft text-success">
            <MailCheck className="size-8" strokeWidth={1.8} aria-hidden />
          </span>
          <p className="max-w-[280px] text-[13.5px] leading-relaxed text-body">{t("linkSent")}</p>
          <Button variant="outline" render={<Link href="/entrar" />}>
            {t("backToLogin")}
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormField label={t("email")} error={fieldError(formState.errors, "email")}>
            {(a11y) => (
              <Input
                {...a11y}
                type="email"
                inputMode="email"
                autoComplete="email"
                {...register("email")}
              />
            )}
          </FormField>
          <Button
            type="submit"
            variant="cta"
            size="lg"
            className="w-full"
            disabled={forgot.isPending}
          >
            <Send data-icon="inline-start" />
            {t("sendLink")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
