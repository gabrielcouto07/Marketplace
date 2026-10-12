"use client";

import type { SellerPolicyInfoDto } from "@marketplace/contracts";
import { useTranslations } from "next-intl";

import {
  SELLER_POLICY_ANNEX,
  SELLER_POLICY_ANNEX_INTRO,
  SELLER_POLICY_ANNEX_TITLE,
  SELLER_POLICY_APPROVAL,
  SELLER_POLICY_PREAMBLE,
  SELLER_POLICY_SECTIONS,
  SELLER_POLICY_TITLE,
} from "@/features/compliance/content/seller-policy";
import { cn } from "@/lib/utils";

/** Empresa no preâmbulo: razão social, documento e sede, como pede o texto aprovado. */
function companyText(policy: SellerPolicyInfoDto): string | null {
  if (!policy.companyLegalName) return null;
  const parts = [policy.companyLegalName];
  if (policy.companyDocument) parts.push(`${policy.companyDocumentType ?? "CNPJ"} ${policy.companyDocument}`);
  if (policy.companyAddress) parts.push(`com sede em ${policy.companyAddress}`);
  return parts.join(", ");
}

function platformText(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Texto integral da Política de Admissão e de Monitoramento de Vendedores, com os dados da empresa e a data de
 * aprovação configurados. Usado na página pública (item 2.4) e no cadastro da loja, antes do aceite (item 2.3).
 */
export function SellerPolicyText({
  policy,
  compact,
  className,
}: {
  policy: SellerPolicyInfoDto;
  /** Versão para caixa com rolagem (cadastro): títulos menores. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("sellerPolicy");
  const company = companyText(policy);
  const approvedAt = policy.approvedAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(policy.approvedAt))
    : null;

  const pending = (text: string) => (
    <span className="rounded-sm bg-warning-soft px-1 font-medium text-foreground">{text}</span>
  );
  const [beforeCompany, afterCompany] = SELLER_POLICY_PREAMBLE.split("{company}");
  const [beforePlatform, afterPlatform] = afterCompany.split("{platform}");
  const [beforeDate, afterDate] = SELLER_POLICY_APPROVAL.split("{date}");

  const sectionTitle = compact ? "text-body-sm font-bold text-foreground" : "text-title-3 text-foreground";

  return (
    <article lang="pt-BR" className={cn("flex flex-col gap-5 text-body-sm text-foreground-secondary", className)}>
      <header className="flex flex-col gap-2">
        <h2 className={compact ? "text-body font-bold text-foreground" : "text-title-2 text-foreground"}>{SELLER_POLICY_TITLE}</h2>
        <p className="leading-relaxed">
          {beforeCompany}
          {company ?? pending(t("companyPending"))}
          {beforePlatform}
          <span className="font-medium text-foreground">{platformText(policy.platformUrl)}</span>
          {afterPlatform}
        </p>
      </header>

      {SELLER_POLICY_SECTIONS.map((section) => (
        <section key={section.number} aria-labelledby={`politica-${section.number}`} className="flex flex-col gap-2">
          <h3 id={`politica-${section.number}`} className={sectionTitle}>
            {section.number} – {section.title}
          </h3>
          {section.clauses.map((clause) => (
            <div key={clause.id} id={`item-${clause.id}`} className="flex flex-col gap-1 leading-relaxed">
              <p>
                <span className="font-semibold text-foreground tabular-nums">{clause.id}</span>{" "}
                {clause.id === "10.1" ? (
                  <>
                    {beforeDate}
                    {approvedAt ? <span className="font-medium text-foreground">{approvedAt}</span> : pending(t("approvalPending"))}
                    {afterDate}
                  </>
                ) : (
                  clause.text
                )}
              </p>
              {clause.items ? (
                <ol className="flex flex-col gap-1 pl-4">
                  {clause.items.map((item) => (
                    <li key={item.letter}>
                      ({item.letter}) {item.text}
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          ))}
        </section>
      ))}

      <section id="anexo-i" aria-labelledby="politica-anexo" className="flex flex-col gap-2">
        <h3 id="politica-anexo" className={sectionTitle}>
          {SELLER_POLICY_ANNEX_TITLE}
        </h3>
        <p>{SELLER_POLICY_ANNEX_INTRO}</p>
        <ol className="flex flex-col gap-1 pl-4 leading-relaxed">
          {SELLER_POLICY_ANNEX.map((item) => (
            <li key={item.letter}>
              ({item.letter}) {item.text}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
