"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { BrandLogo } from "@/components/layout/brand-logo";
import { usePwa } from "@/components/layout/pwa-provider";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const DISMISS_KEY = "mktpy.install.dismissedAt";
const DISMISS_DAYS = 7;

/**
 * Barra discreta de instalação, acima da bottom nav.
 * - Android/Chrome: usa o evento beforeinstallprompt capturado no PwaProvider.
 * - iOS: leva à página /instalar com as instruções.
 * Aparece após 8 s e respeita "dispensar por 7 dias".
 */
export function InstallPrompt() {
  const t = useTranslations("pwa");
  const { canPrompt, isIos, isStandalone, promptInstall } = usePwa();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone) return;
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed && Date.now() - Number(dismissed) < DISMISS_DAYS * 86_400_000) return;
    } catch {
      /* ignore */
    }
    if (!canPrompt && !isIos) return;
    const timer = window.setTimeout(() => setVisible(true), 8000);
    return () => window.clearTimeout(timer);
  }, [canPrompt, isIos, isStandalone]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom))] z-40 border-t border-border bg-surface shadow-md md:bottom-0"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
        <BrandLogo tile size={40} />
        <div className="min-w-0 flex-1">
          <p id="install-title" className="truncate text-body-sm font-medium text-foreground">
            {t("installTitle")}
          </p>
          <p className="truncate text-caption text-foreground-secondary">{t("androidHint")}</p>
        </div>
        {canPrompt ? (
          <Button
            variant="primary"
            size="sm"
            onClick={async () => {
              const result = await promptInstall();
              if (result !== "dismissed") setVisible(false);
            }}
          >
            {t("installButton")}
          </Button>
        ) : (
          <Button variant="primary" size="sm" render={<Link href="/instalar" onClick={dismiss} />}>
            {t("howToInstall")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="-mr-2 text-foreground-secondary"
          onClick={dismiss}
          aria-label={t("close")}
        >
          <X strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  );
}
