"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ValidationKey = Parameters<ReturnType<typeof useTranslations<"validation">>>[0];

/**
 * Converte a mensagem de erro dos schemas Zod (que são chaves do namespace "validation")
 * em texto traduzido. Mensagens que não são chaves (ex.: vindas da API) passam direto.
 */
export function useValidationMessage() {
  const t = useTranslations("validation");
  return (message?: string | null): string | undefined => {
    if (!message) return undefined;
    return t.has(message as ValidationKey) ? t(message as ValidationKey) : message;
  };
}

interface FormFieldProps {
  id: string;
  label: string;
  error?: string | null;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Label acima do campo, helper text abaixo; erro sempre com ícone + texto (DESIGN.md › Formulários).
 * Ligue o controle com `aria-describedby={`${id}-error` | `${id}-hint`}` e `aria-invalid`.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  optional,
  className,
  children,
}: FormFieldProps) {
  const t = useTranslations("common");
  const message = useValidationMessage();
  const errorText = message(error);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? (
          <span className="text-caption font-normal text-foreground-muted">({t("optional")})</span>
        ) : null}
      </Label>
      {children}
      {errorText ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-caption font-medium text-danger"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {errorText}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-foreground-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
