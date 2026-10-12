"use client";

import type { ProductReportReason, ReportReceiptDto } from "@marketplace/contracts";
import { CheckCircle2, Flag, ShieldAlert } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { PageContainer } from "@/components/layout/store-shell";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useIsAuthenticated } from "@/features/auth/store";
import { REPORT_REASONS } from "@/features/catalog/components/report-product-sheet";
import { OptionCard } from "@/features/checkout/components/checkout-section";
import { usePublicReport } from "@/features/compliance/api";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";

const MAX_EVIDENCE = 5;

/**
 * Canal público de denúncias (Política de Vendedores 6.4): qualquer pessoa, com ou sem cadastro, aponta um anúncio de
 * produto de origem ilícita, contrafeito ou que infrinja propriedade intelectual. A equipe decide em até 2 dias úteis
 * (6.5) e a decisão fica registrada (6.8); quem informa o e-mail recebe o resultado.
 */
export function PublicReportView({ initialProduct = "" }: { initialProduct?: string }) {
  const t = useTranslations("publicReport");
  const tReport = useTranslations("report");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const authenticated = useIsAuthenticated();
  const report = usePublicReport();

  const [product, setProduct] = useState(initialProduct);
  const [reason, setReason] = useState<ProductReportReason>("Falsificado");
  const [details, setDetails] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rightsHolder, setRightsHolder] = useState(false);
  const [rightsHolderName, setRightsHolderName] = useState("");
  const [evidence, setEvidence] = useState("");
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>();
  const [receipt, setReceipt] = useState<ReportReceiptDto | null>(null);

  const fieldError = (key: string) => errors?.[key]?.[0];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setErrors(undefined);
    const links = evidence
      .split(/\s+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, MAX_EVIDENCE);
    report.mutate(
      {
        product: product.trim(),
        reason,
        details: details.trim() || null,
        reporterName: authenticated ? null : name.trim() || null,
        reporterEmail: authenticated ? null : email.trim() || null,
        isRightsHolder: rightsHolder,
        rightsHolderName: rightsHolder ? rightsHolderName.trim() || null : null,
        evidenceUrls: links.length > 0 ? links : null,
        website: website || null,
      },
      {
        onSuccess: (result) => setReceipt(result),
        onError: (error) => {
          if (isApiError(error) && error.errors) setErrors(error.errors);
          else setErrors({ form: [isApiError(error) ? error.message : tErrors("genericTitle")] });
        },
      },
    );
  };

  if (receipt) {
    return (
      <PageContainer className="flex max-w-2xl flex-col gap-6 py-6">
        <section className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs" role="status">
          <CheckCircle2 className="size-8 text-success" strokeWidth={1.75} aria-hidden />
          <h1 className="text-title-2 text-foreground">{t("successTitle")}</h1>
          <p className="text-body text-foreground-secondary">{t("successText", { product: receipt.productName })}</p>
          <dl className="grid w-full grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-md bg-surface-muted p-3 text-body-sm">
            <dt className="text-foreground-secondary">{t("protocol")}</dt>
            <dd className="font-semibold text-foreground tabular-nums">{receipt.protocol}</dd>
            <dt className="text-foreground-secondary">{t("dueAt")}</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {format.dateTime(new Date(receipt.dueAt), { dateStyle: "medium", timeStyle: "short" })}
            </dd>
          </dl>
          <p className="text-caption text-foreground-muted">{t("successHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setReceipt(null);
                setProduct("");
                setDetails("");
                setEvidence("");
              }}
            >
              {t("another")}
            </Button>
            <Button variant="secondary" size="sm" render={<Link href="/" />}>
              {t("backHome")}
            </Button>
          </div>
        </section>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex max-w-2xl flex-col gap-6 py-6">
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5 shadow-xs">
        <h1 className="flex items-center gap-2 text-title-1 text-foreground">
          <ShieldAlert className="size-6 text-primary" strokeWidth={1.75} aria-hidden />
          {t("title")}
        </h1>
        <p className="text-body text-foreground-secondary">{t("intro")}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-body-sm text-foreground-secondary">
          <li>{t("point1")}</li>
          <li>{t("point2")}</li>
          <li>
            {t.rich("point3", {
              policy: (chunks) => (
                <Link href="/politica-de-vendedores" className="font-medium text-primary underline-offset-2 hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </li>
        </ul>
      </section>

      <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5 shadow-xs">
        <FormField id="public-report-product" label={t("product")} hint={t("productHint")} error={fieldError("product")}>
          <Input
            id="public-report-product"
            required
            maxLength={500}
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder={t("productPlaceholder")}
            aria-invalid={Boolean(fieldError("product"))}
          />
        </FormField>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-body-sm font-medium text-foreground">{t("reason")}</legend>
          <RadioGroup value={reason} onValueChange={(v) => setReason(v as ProductReportReason)} className="flex flex-col gap-2">
            {REPORT_REASONS.map((r) => (
              <OptionCard key={r} value={r} align="start">
                <span className="flex flex-col">
                  <span className="text-body-sm font-medium text-foreground">{tReport(`reason.${r}`)}</span>
                  <span className="text-caption text-foreground-secondary">{tReport(`reasonHint.${r}`)}</span>
                </span>
              </OptionCard>
            ))}
          </RadioGroup>
        </fieldset>

        <FormField id="public-report-details" label={tReport("details")} hint={t("detailsHint")} error={fieldError("details")}>
          <Textarea
            id="public-report-details"
            rows={4}
            required
            maxLength={2000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            aria-invalid={Boolean(fieldError("details"))}
          />
        </FormField>

        <FormField
          id="public-report-evidence"
          label={t("evidence")}
          hint={t("evidenceHint", { max: MAX_EVIDENCE })}
          optional
          error={fieldError("evidenceUrls")}
        >
          <Textarea
            id="public-report-evidence"
            rows={2}
            inputMode="url"
            placeholder="https://"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
        </FormField>

        <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-3 text-body-sm text-foreground has-data-checked:border-primary">
          <Checkbox className="mt-0.5" checked={rightsHolder} onCheckedChange={(v) => setRightsHolder(v === true)} />
          <span>{tReport("rightsHolder")}</span>
        </label>
        {rightsHolder ? (
          <FormField id="public-report-holder" label={tReport("rightsHolderName")} error={fieldError("rightsHolderName")}>
            <Input id="public-report-holder" maxLength={160} value={rightsHolderName} onChange={(e) => setRightsHolderName(e.target.value)} />
          </FormField>
        ) : null}

        {authenticated ? (
          <p className="text-caption text-foreground-secondary">{t("signedInHint")}</p>
        ) : (
          <div className="flex flex-col gap-4 rounded-md bg-surface-muted p-3">
            <p className="text-caption text-foreground-secondary">{tReport("anonymousHint")}</p>
            <FormField id="public-report-name" label={tReport("reporterName")} optional error={fieldError("reporterName")}>
              <Input id="public-report-name" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField
              id="public-report-email"
              label={tReport("reporterEmail")}
              hint={tReport("reporterEmailHint")}
              optional
              error={fieldError("reporterEmail")}
            >
              <Input
                id="public-report-email"
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
          <label htmlFor="public-report-website">Website</label>
          <input id="public-report-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        {fieldError("form") ? (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-body-sm text-danger">
            {fieldError("form")}
          </p>
        ) : null}

        <Button type="submit" variant="primary" fullWidth loading={report.isPending}>
          <Flag data-icon="inline-start" strokeWidth={1.75} />
          {tReport("submit")}
        </Button>
      </form>
    </PageContainer>
  );
}
