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
    <div role="status" className="bg-warning-soft text-warning">
      <p className="mx-auto flex w-full max-w-6xl items-center justify-center gap-2 px-4 py-2 text-caption">
        <WifiOff className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
        {t("offlineBanner")}
      </p>
    </div>
  );
}
