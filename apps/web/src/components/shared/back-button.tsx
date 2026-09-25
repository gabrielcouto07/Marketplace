"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

interface BackButtonProps {
  /** Rota usada quando não há histórico (ex.: link aberto direto). */
  fallbackHref?: string;
  className?: string;
}

/** Quadrado branco de 44 px com seta — usado no topo das páginas internas e flutuando sobre galerias. */
export function BackButton({ fallbackHref = "/", className }: BackButtonProps) {
  const t = useTranslations("nav");
  const router = useRouter();
  return (
    <Button
      variant="white"
      size="icon"
      aria-label={t("back")}
      className={className}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
    >
      <ArrowLeft strokeWidth={2.2} />
    </Button>
  );
}
