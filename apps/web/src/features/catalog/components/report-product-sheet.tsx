"use client";

import type { ProductReportReason } from "@marketplace/contracts";
import { Flag } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/shared/form-field";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useIsAuthenticated } from "@/features/auth/store";
import { OptionCard } from "@/features/checkout/components/checkout-section";
import { useReportProduct } from "@/features/compliance/api";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";

export const REPORT_REASONS: ProductReportReason[] = [
  "Falsificado",
  "PropriedadeIntelectual",
  "OrigemIlicita",
  "ProdutoProibido",
  "PrecoSuspeito",
  "DescricaoIncorreta",
  "Outro",
];

/**
 * Denúncia de produto pela página do anúncio (Política de Vendedores 6.4): aberta a qualquer pessoa, cadastrada ou
 * não. Falsificação, violação de propriedade intelectual, origem ilícita, produto proibido (Anexo I), preço suspeito
 * ou descrição errada; a equipe decide em até 2 dias úteis (6.5) e quem denunciou recebe um protocolo.
 */
export function ReportProductButton({ productId }: { productId: string; productSlug?: string }) {
  const t = useTranslations("report");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const authenticated = useIsAuthenticated();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ProductReportReason>("Falsificado");
  const [details, setDetails] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rightsHolder, setRightsHolder] = useState(false);
  const [rightsHolderName, setRightsHolderName] = useState("");
  const [evidence, setEvidence] = useState("");
  // Campo isca: invisível para pessoas, preenchido por robôs.
  const [website, setWebsite] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>();
  const report = useReportProduct(productId);

  const reset = () => {
    setDetails("");
    setEvidence("");
    setRightsHolder(false);
    setRightsHolderName("");
    setFieldErrors(undefined);
  };

  const submit = () =>
    report.mutate(
      {
        reason,
        details: details.trim() || null,
        reporterName: authenticated ? null : name.trim() || null,
        reporterEmail: authenticated ? null : email.trim() || null,
        isRightsHolder: rightsHolder,
        rightsHolderName: rightsHolder ? rightsHolderName.trim() || null : null,
        evidenceUrls: evidence.trim() ? [evidence.trim()] : null,
        website: website || null,
      },
      {
        onSuccess: (result) => {
          toast.success(
            result.protocol && result.dueAt
              ? t("successProtocol", {
                  protocol: result.protocol,
                  date: format.dateTime(new Date(result.dueAt), { dateStyle: "short" }),
                })
              : t("success"),
            { duration: 10_000 },
          );
          setOpen(false);
          reset();
        },
        onError: (error) => {
          if (isApiError(error) && error.errors) setFieldErrors(error.errors);
          toast.error(isApiError(error) ? (Object.values(error.errors ?? {})[0]?.[0] ?? error.message) : tErrors("genericTitle"));
        },
      },
    );

  const fieldError = (key: string) => fieldErrors?.[key]?.[0];

  return (
    <>
      <Button variant="ghost" size="sm" className="self-start text-foreground-secondary" onClick={() => setOpen(true)}>
        <Flag data-icon="inline-start" strokeWidth={1.75} />
        {t("cta")}
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent className="sm:mx-auto sm:max-w-lg">
          <BottomSheetHeader>
            <BottomSheetTitle>{t("title")}</BottomSheetTitle>
            <BottomSheetDescription>{t("description")}</BottomSheetDescription>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-4">
            <RadioGroup value={reason} onValueChange={(v) => setReason(v as ProductReportReason)} className="flex flex-col gap-2">
              {REPORT_REASONS.map((r) => (
                <OptionCard key={r} value={r} align="start">
                  <span className="flex flex-col">
                    <span className="text-body-sm font-medium text-foreground">{t(`reason.${r}`)}</span>
                    <span className="text-caption text-foreground-secondary">{t(`reasonHint.${r}`)}</span>
                  </span>
                </OptionCard>
              ))}
            </RadioGroup>
            <FormField
              id="report-details"
              label={t("details")}
              hint={t("detailsHint")}
              optional={reason !== "Outro"}
              error={fieldError("details")}
            >
              <Textarea
                id="report-details"
                rows={3}
                maxLength={1000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </FormField>
            <FormField id="report-evidence" label={t("evidence")} hint={t("evidenceHint")} optional error={fieldError("evidenceUrls")}>
              <Input
                id="report-evidence"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
              />
            </FormField>
            <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-3 text-body-sm text-foreground has-data-checked:border-primary">
              <Checkbox className="mt-0.5" checked={rightsHolder} onCheckedChange={(v) => setRightsHolder(v === true)} />
              <span>{t("rightsHolder")}</span>
            </label>
            {rightsHolder ? (
              <FormField id="report-rights-holder" label={t("rightsHolderName")} error={fieldError("rightsHolderName")}>
                <Input
                  id="report-rights-holder"
                  value={rightsHolderName}
                  maxLength={160}
                  onChange={(e) => setRightsHolderName(e.target.value)}
                />
              </FormField>
            ) : null}
            {authenticated ? null : (
              <div className="flex flex-col gap-4 rounded-md bg-surface-muted p-3">
                <p className="text-caption text-foreground-secondary">{t("anonymousHint")}</p>
                <FormField id="report-name" label={t("reporterName")} optional error={fieldError("reporterName")}>
                  <Input id="report-name" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
                </FormField>
                <FormField id="report-email" label={t("reporterEmail")} hint={t("reporterEmailHint")} optional error={fieldError("reporterEmail")}>
                  <Input
                    id="report-email"
                    type="email"
                    autoComplete="email"
                    maxLength={160}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </FormField>
              </div>
            )}
            <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="report-website">Website</label>
              <input id="report-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            <p className="text-caption text-foreground-muted">
              {t.rich("deadline", {
                policy: (chunks) => (
                  <Link href="/politica-de-vendedores" className="font-medium text-primary underline-offset-2 hover:underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </BottomSheetBody>
          <BottomSheetFooter>
            <Button variant="primary" fullWidth loading={report.isPending} onClick={submit}>
              {t("submit")}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
