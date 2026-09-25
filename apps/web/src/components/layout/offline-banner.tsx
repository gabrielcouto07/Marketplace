"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { usePwa } from "@/components/layout/pwa-provider";

/** Aviso persistente quando o dispositivo está offline (carrinho e favoritos continuam funcionando). */
export function OfflineBanner() {
  const t = useTranslations("pwa");
  const { isOnline } = usePwa();
  if (isOnline) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
      <WifiOff className="size-4" aria-hidden />
      {t("offlineBanner")}
    </div>
  );
}
