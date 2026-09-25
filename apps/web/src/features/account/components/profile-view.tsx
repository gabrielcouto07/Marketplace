"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateProfile } from "@/features/auth/api";
import { FormField, applyApiErrors, fieldError } from "@/features/auth/components/form-field";
import { useAuthStore, useCurrentUser } from "@/features/auth/store";
import { Link } from "@/i18n/navigation";
import { initials } from "@/lib/palette";
import { formatCpf, formatPhoneBr } from "@/lib/validation/documents";
import { profileSchema, type ProfileFormValues } from "@/lib/validation/schemas";

export function ProfileView() {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const user = useCurrentUser();
  const hydrated = useAuthStore.persist.hasHydrated();
  const update = useUpdateProfile();

  const { register, handleSubmit, control, reset, setError, formState } =
    useForm<ProfileFormValues>({
      resolver: zodResolver(profileSchema),
      defaultValues: { fullName: "", phone: "", cpf: "" },
    });

  useEffect(() => {
    if (user) reset({ fullName: user.fullName, phone: user.phone ?? "", cpf: user.cpf ?? "" });
  }, [user, reset]);

  if (!hydrated) return null;
  if (!user) return <LoginRequired />;

  const onSubmit = handleSubmit((values) =>
    update.mutate(
      { fullName: values.fullName, phone: values.phone || null, cpf: values.cpf || null },
      {
        onSuccess: () => toast.success(t("profileSaved")),
        onError: (error) => {
          if (!applyApiErrors(error, setError)) toast.error(tErrors("genericTitle"));
        },
      },
    ),
  );

  return (
    <PageContainer className="flex flex-col gap-3 py-4">
      <div className="mx-auto flex w-full max-w-md animate-rise items-center gap-3.5 rounded-3xl bg-card p-4 shadow-card">
        <span
          aria-hidden
          className="flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-accent text-lg font-extrabold text-primary"
        >
          {initials(user.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold">{user.fullName}</p>
          <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="mx-auto flex w-full max-w-md animate-rise flex-col gap-4 rounded-3xl bg-card p-4 shadow-card sm:p-6"
        style={{ animationDelay: "40ms" }}
      >
        <FormField label={t("email")}>
          {(a11y) => <Input {...a11y} type="email" value={user.email} readOnly disabled />}
        </FormField>
        <FormField label={t("fullName")} error={fieldError(formState.errors, "fullName")}>
          {(a11y) => <Input {...a11y} autoComplete="name" {...register("fullName")} />}
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
        <FormField label={t("cpf")} hint={t("cpfHint")} error={fieldError(formState.errors, "cpf")}>
          {(a11y) => (
            <Controller
              control={control}
              name="cpf"
              render={({ field }) => (
                <Input
                  {...a11y}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={formatCpf(field.value ?? "")}
                  onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          )}
        </FormField>
        <Button
          type="submit"
          variant="cta"
          size="lg"
          className="mt-1"
          disabled={update.isPending || !formState.isDirty}
        >
          <Save data-icon="inline-start" />
          {tCommon("save")}
        </Button>
      </form>
    </PageContainer>
  );
}

export function LoginRequired({ next }: { next?: string }) {
  const t = useTranslations("account");
  const tErrors = useTranslations("errors");
  return (
    <PageContainer className="py-4">
      <EmptyState
        title={t("guestTitle")}
        description={tErrors("unauthorized")}
        className="min-h-[50vh]"
        action={
          <Button
            variant="cta"
            render={<Link href={next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar"} />}
          >
            {t("signIn")}
          </Button>
        }
      />
    </PageContainer>
  );
}
