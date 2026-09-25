"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function OfflineContent() {
  const t = useTranslations("errors");
  return (
    <EmptyState
      icon={WifiOff}
      title={t("offlinePageTitle")}
      description={t("offlinePageDescription")}
      className="min-h-[60vh]"
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="cta" onClick={() => window.location.reload()}>
            {t("reload")}
          </Button>
          <Button variant="outline" render={<Link href="/carrinho" />}>
            {t("goHome")}
          </Button>
        </div>
      }
    />
  );
}
