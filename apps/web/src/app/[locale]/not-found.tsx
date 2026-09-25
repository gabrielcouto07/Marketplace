"use client";

import { useTranslations } from "next-intl";

import { PageContainer, StoreShell } from "@/components/layout/store-shell";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <StoreShell hideSearch>
      <PageContainer className="py-8">
        <EmptyState
          illustration="search"
          title={t("page404Title")}
          description={t("page404Description")}
          action={
            <Button variant="primary" render={<Link href="/" />}>
              {t("goHome")}
            </Button>
          }
          className="min-h-[60vh]"
        />
      </PageContainer>
    </StoreShell>
  );
}
