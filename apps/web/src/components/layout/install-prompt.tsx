"use client";

import { Download, Share, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { usePwa } from "@/components/layout/pwa-provider";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const DISMISS_KEY = "mktpy.install.dismissedAt";
const DISMISS_DAYS = 7;

/**
 * Banner de instalação customizado.
 * - Android/Chrome: usa o evento beforeinstallprompt capturado no PwaProvider.
 * - iOS: mostra instruções (Compartilhar → Adicionar à Tela de Início).
 * Aparece após 2 visitas/8s e respeita "dispensar por 7 dias".
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
      className="fixed inset-x-3 bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom)+0.75rem)] z-50 mx-auto max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl md:bottom-6"
    >
      <div className="flex items-start gap-3">
        <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="size-12 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p id="install-title" className="font-semibold">
            {t("installTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {isIos ? (
              t.rich("iosHint", {
                share: () => <Share aria-label={t("shareIcon")} className="inline size-4 align-text-bottom" />,
              })
            ) : (
              t("androidHint")
            )}
          </p>
          <div className="mt-3 flex gap-2">
            {canPrompt ? (
              <Button
                size="sm"
                variant="cta"
                onClick={async () => {
                  const result = await promptInstall();
                  if (result !== "dismissed") setVisible(false);
                }}
              >
                <Download data-icon="inline-start" />
                {t("installButton")}
              </Button>
            ) : (
              <Button size="sm" variant="outline" render={<Link href="/instalar" />}>
                {t("howToInstall")}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t("notNow")}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("close")}
          className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
