"use client";

import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTestMode } from "@/features/testing/api";
import { cn } from "@/lib/utils";

interface TestFillButtonProps {
  onFill: () => void;
  /** Aviso depois de preencher (ex.: a senha de teste, que o campo mascara). */
  note?: string;
  className?: string;
}

/** Faixa "Preencher com dados de teste": só aparece no modo de testes (pagamentos fictícios ou mock). */
export function TestFillButton({ onFill, note, className }: TestFillButtonProps) {
  const t = useTranslations("testing");
  const enabled = useTestMode();
  if (!enabled) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border border-dashed border-warning/30 bg-warning-soft px-3 py-2",
        className,
      )}
    >
      <FlaskConical className="size-4 shrink-0 text-warning" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1 text-caption text-foreground-secondary">{t("hint")}</span>
      <Button
        type="button"
        variant="secondary"
        size="xs"
        onClick={() => {
          onFill();
          toast.success(note ?? t("filled"));
        }}
      >
        {t("fill")}
      </Button>
    </div>
  );
}
