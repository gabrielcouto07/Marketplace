"use client";

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

/** Label + controle + mensagem de erro/dica, com aria-describedby e aria-invalid. */
export function FormField({ id, label, error, hint, optional, className, children }: FormFieldProps) {
  const t = useTranslations("common");
  const message = useValidationMessage();
  const errorText = message(error);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground">({t("optional")})</span> : null}
      </Label>
      {children}
      {errorText ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {errorText}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
