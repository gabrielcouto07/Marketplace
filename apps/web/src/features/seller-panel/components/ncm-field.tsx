"use client";

import type { ProductStatus } from "@marketplace/contracts";
import { CheckCircle2, CircleAlert, Loader2, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { useNcmLookup } from "@/features/compliance/api";
import { onlyDigits } from "@/lib/validation/documents";

import { moderationKey } from "../moderation";

/** "85171300" → "8517.13.00" enquanto digita. */
export function formatNcm(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`;
  return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`;
}

/**
 * NCM do produto, conferido na tabela oficial do Siscomex enquanto o vendedor digita: mostra a descrição vigente ou
 * avisa que o código não existe. A API recusa NCM fora da categoria ou de capítulo proibido em remessa.
 */
export function NcmField({
  value,
  onChange,
  onBlur,
  error,
  initialDescription,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  initialDescription: string | null;
}) {
  const t = useTranslations("sellerPanel");
  const digits = onlyDigits(value);
  const lookup = useNcmLookup(digits);
  const description = lookup.data?.description || (digits.length === 8 && !lookup.isFetched ? initialDescription : null);

  return (
    <FormField id="product-ncm" label={t("productNcm")} hint={t("productNcmHint")} error={error}>
      <Input
        id="product-ncm"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0000.00.00"
        className="tabular-nums"
        value={formatNcm(value)}
        onChange={(e) => onChange(onlyDigits(e.target.value).slice(0, 8))}
        onBlur={onBlur}
        aria-invalid={Boolean(error) || (lookup.isError && digits.length === 8) || undefined}
        aria-describedby={error ? "product-ncm-error" : "product-ncm-hint"}
      />
      {digits.length === 8 ? (
        <p className="flex items-start gap-1.5 text-caption" aria-live="polite">
          {lookup.isFetching ? (
            <>
              <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-foreground-muted" aria-hidden />
              <span className="text-foreground-muted">{t("productNcmChecking")}</span>
            </>
          ) : lookup.isError ? (
            <>
              <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden />
              <span className="text-danger">{t("productNcmNotFound")}</span>
            </>
          ) : description ? (
            <>
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
              <span className="text-foreground-secondary">
                <span className="font-medium text-foreground">{t("productNcmOfficial")}</span> {description}
              </span>
            </>
          ) : null}
        </p>
      ) : null}
    </FormField>
  );
}

/** Aviso no topo do formulário quando a plataforma pôs o produto em análise ou o bloqueou. */
export function ModerationNotice({
  status,
  reason,
  note,
}: {
  status: Extract<ProductStatus, "EmAnalise" | "Bloqueado">;
  reason: string | null;
  note: string | null;
}) {
  const t = useTranslations("sellerPanel");
  const blocked = status === "Bloqueado";
  return (
    <div
      role="status"
      className={
        blocked
          ? "flex items-start gap-3 rounded-lg bg-danger-soft p-4 text-danger"
          : "flex items-start gap-3 rounded-lg bg-warning-soft p-4 text-warning"
      }
    >
      <ShieldAlert className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-body-sm font-semibold">{blocked ? t("moderationBlockedTitle") : t("moderationReviewTitle")}</p>
        {reason ? <p className="text-body-sm">{t(`moderationReason.${moderationKey(reason)}`)}</p> : null}
        {note ? <p className="text-caption">{note}</p> : null}
        <p className="text-caption">{blocked ? t("moderationBlockedHint") : t("moderationReviewHint")}</p>
      </div>
    </div>
  );
}
