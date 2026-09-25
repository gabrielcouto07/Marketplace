"use client";

import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

import { StoreShell } from "@/components/layout/store-shell";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");
  return (
    <StoreShell>
      <EmptyState
        icon={SearchX}
        title={t("page404Title")}
        description={t("page404Description")}
        action={
          <Button variant="cta" render={<Link href="/" />}>
            {t("goHome")}
          </Button>
        }
        className="min-h-[60vh]"
      />
    </StoreShell>
  );
}
