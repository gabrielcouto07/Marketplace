"use client";

import { FileText, Flag, Store } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/store-shell";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSellerPolicy } from "@/features/compliance/api";
import { Link } from "@/i18n/navigation";

import { SellerPolicyText } from "./seller-policy-text";

/**
 * Página pública da Política de Admissão e de Monitoramento de Vendedores (itens 2.3 e 2.4): texto integral com a
 * versão em vigor, a data de aprovação e os dados da empresa, mais os atalhos para o cadastro de loja e o canal de
 * denúncias.
 */
export function SellerPolicyView() {
  const t = useTranslations("sellerPolicy");
  const format = useFormatter();
  const locale = useLocale();
  const policy = useSellerPolicy();

  return (
    <PageContainer className="flex max-w-3xl flex-col gap-6 py-6">
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs">
        <h1 className="flex items-center gap-2 text-title-1 text-foreground">
          <FileText className="size-6 text-primary" strokeWidth={1.75} aria-hidden />
          {t("title")}
        </h1>
        <p className="text-body text-foreground-secondary">{t("intro")}</p>
        {policy.data ? (
          <p className="text-body-sm text-foreground-secondary tabular-nums">
            {t("version", { version: policy.data.version })}
            {policy.data.approvedAt
              ? ` · ${t("approvedAt", { date: format.dateTime(new Date(policy.data.approvedAt), { dateStyle: "long", timeZone: "UTC" }) })}`
              : null}
          </p>
        ) : null}
        {locale !== "pt-BR" ? <p className="rounded-md bg-surface-muted p-3 text-body-sm text-foreground">{t("officialLanguage")}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" render={<Link href="/vendedor/cadastro" />}>
            <Store data-icon="inline-start" strokeWidth={1.75} />
            {t("sellCta")}
          </Button>
          <Button variant="secondary" size="sm" render={<Link href="/denuncia" />}>
            <Flag data-icon="inline-start" strokeWidth={1.75} />
            {t("reportCta")}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-xs">
        {policy.isError ? (
          <ErrorState error={policy.error} onRetry={() => policy.refetch()} />
        ) : policy.data ? (
          <SellerPolicyText policy={policy.data} />
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}
      </section>
    </PageContainer>
  );
}
