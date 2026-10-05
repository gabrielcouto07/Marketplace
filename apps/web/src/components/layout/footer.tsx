"use client";

import { useTranslations } from "next-intl";

import { BrandMark } from "@/components/layout/brand-mark";
import { RemessaConformeSeal } from "@/components/shared/trust-badge";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LINK =
  "rounded-sm text-body-sm text-white/80 transition-colors hover:text-white hover:underline link-on-deep";

/**
 * Footer de loja (DESIGN.md › Navegação): faixa "Voltar ao início" em Marinho claro, colunas de
 * links em Marinho e a faixa das quatro cores da marca na base. Só aponta para rotas existentes.
 */
export function Footer({ className }: { className?: string }) {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();
  const columns = [
    {
      title: t("shop"),
      links: [
        { href: "/busca?onlyOffers=true", label: t("deals") },
        { href: "/busca?sort=bestSelling", label: t("bestSellers") },
        { href: "/busca?sort=newest", label: t("newArrivals") },
        { href: "/categorias", label: t("departments") },
        { href: "/lojas", label: t("stores") },
      ],
    },
    {
      title: t("account"),
      links: [
        { href: "/conta", label: t("myAccount") },
        { href: "/conta/pedidos", label: t("orders") },
        { href: "/conta/enderecos", label: t("addresses") },
        { href: "/favoritos", label: t("favorites") },
      ],
    },
    {
      title: t("sell"),
      links: [
        { href: "/vendedor/cadastro", label: t("registerStore") },
        { href: "/vendedor", label: t("sellerPanel") },
      ],
    },
    {
      title: t("app"),
      links: [{ href: "/instalar", label: t("install") }],
    },
  ];

  return (
    <footer aria-label={t("label")} className={cn("bg-brand-deep text-white", className)}>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="flex h-12 w-full items-center justify-center bg-brand-deep-raised text-body-sm font-semibold transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-amarelo"
      >
        {t("backToTop")}
      </button>
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-4 gap-y-8 px-4 py-10 md:grid-cols-4">
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-3">
            <h2 className="text-body font-bold">{col.title}</h2>
            <ul className="flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={LINK}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 py-6 text-center md:flex-row md:justify-between md:text-left">
          <BrandMark size="sm" />
          <RemessaConformeSeal />
          <p className="text-caption text-white/80">
            {t("tagline")} {t("copyright", { year })}
          </p>
        </div>
      </div>
      <div aria-hidden className="h-1.5 brand-quartet" />
    </footer>
  );
}
