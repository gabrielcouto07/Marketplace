"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

interface BackButtonProps {
  /** Rota usada quando não há histórico (ex.: link aberto direto). */
  fallbackHref?: string;
  /** `ghost` no header · `floating` sobre galerias/heros. */
  variant?: "ghost" | "floating";
  className?: string;
}

/** Botão de voltar de 44 px; usa o histórico quando existe, senão o `fallbackHref`. */
export function BackButton({ fallbackHref = "/", variant = "ghost", className }: BackButtonProps) {
  const t = useTranslations("nav");
  const router = useRouter();
  return (
    <Button
      variant={variant}
      size="icon"
      aria-label={t("back")}
      className={className}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
    >
      <ArrowLeft strokeWidth={1.75} />
    </Button>
  );
}
