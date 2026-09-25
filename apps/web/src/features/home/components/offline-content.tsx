"use client";

import { useTranslations } from "next-intl";

import { PageContainer } from "@/components/layout/store-shell";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Fallback offline do service worker: ilustração de wi-fi, frase curta e duas ações (recarregar, início). */
export function OfflineContent() {
  const t = useTranslations("errors");
  return (
    <PageContainer className="py-8">
      <EmptyState
        illustration="wifi"
        title={t("offlinePageTitle")}
        description={t("offlinePageDescription")}
        className="min-h-[60vh]"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => window.location.reload()}>
              {t("reload")}
            </Button>
            <Button variant="secondary" render={<Link href="/" />}>
              {t("goHome")}
            </Button>
          </div>
        }
      />
    </PageContainer>
  );
}
