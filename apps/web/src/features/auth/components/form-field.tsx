"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import type { FieldErrors, FieldValues, Path, UseFormSetError } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

/**
 * Traduz mensagens de erro de formulário: chaves do namespace "validation"
 * (ex.: "invalidCpf") viram texto; mensagens já legíveis (vindas da API) passam direto.
 */
export function useValidationMessage() {
  const t = useTranslations("validation");
  return (message: string | undefined): string | undefined => {
    if (!message) return undefined;
    return t.has(message as never) ? t(message as never) : message;
  };
}

/** Aplica erros 422 da API (ApiError.errors) nos campos do react-hook-form. */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!isApiError(error) || !error.errors) return false;
  let applied = false;
  for (const [field, messages] of Object.entries(error.errors)) {
    if (messages?.length) {
      setError(field as Path<T>, { type: "server", message: messages[0] });
      applied = true;
    }
  }
  return applied;
}

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}

/** Label + controle + erro/dica, acessível (aria-invalid / aria-describedby). */
export function FormField({ label, error, hint, optional, className, children }: FormFieldProps) {
  const id = useId();
  const tCommon = useTranslations("common");
  const translate = useValidationMessage();
  const message = translate(error);
  const describedBy = message ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="text-[13px]">
        {label}
        {optional ? (
          <span className="text-xs font-medium text-placeholder">({tCommon("optional")})</span>
        ) : null}
      </Label>
      {children({ id, "aria-invalid": Boolean(message), "aria-describedby": describedBy })}
      {message ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-bold text-destructive">
          {message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Input de senha com botão mostrar/ocultar (área de toque 44px). */
export function PasswordInput({ className, ...props }: ComponentProps<typeof Input>) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 pressable items-center justify-center rounded-md text-chevron transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
      </button>
    </div>
  );
}

/** Extrai a mensagem de erro de um campo do react-hook-form. */
export function fieldError<T extends FieldValues>(
  errors: FieldErrors<T>,
  name: keyof T,
): string | undefined {
  const e = errors[name as Path<T>];
  return typeof e?.message === "string" ? e.message : undefined;
}
