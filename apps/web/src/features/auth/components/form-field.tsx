"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import type { FieldErrors, FieldValues, Path, UseFormSetError } from "react-hook-form";

import { FormField as SharedFormField, useValidationMessage } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

export { useValidationMessage };

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
  optional?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}

/**
 * Variante com render-prop do `FormField` compartilhado: gera o `id` e entrega os atributos
 * de acessibilidade (`aria-invalid`, `aria-describedby`) ao controle. O visual é o do
 * componente compartilhado (label acima, erro com ícone, dica abaixo).
 */
export function FormField({ label, error, hint, optional, className, children }: FormFieldProps) {
  const id = useId();
  const translate = useValidationMessage();
  const message = translate(error);
  const describedBy = message ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <SharedFormField
      id={id}
      label={label}
      error={error}
      hint={hint}
      optional={optional}
      className={className}
    >
      {children({ id, "aria-invalid": Boolean(message), "aria-describedby": describedBy })}
    </SharedFormField>
  );
}

/** Input de senha com botão mostrar/ocultar (ghost, 40 px) dentro do campo. */
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
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 -translate-y-1/2 text-foreground-secondary"
      >
        {visible ? <EyeOff strokeWidth={1.75} /> : <Eye strokeWidth={1.75} />}
      </Button>
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
