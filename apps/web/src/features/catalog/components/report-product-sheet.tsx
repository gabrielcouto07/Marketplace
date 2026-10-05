"use client";

import type { ProductReportReason } from "@marketplace/contracts";
import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/shared/form-field";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useIsAuthenticated } from "@/features/auth/store";
import { OptionCard } from "@/features/checkout/components/checkout-section";
import { useReportProduct } from "@/features/compliance/api";
import { useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";

const REASONS: ProductReportReason[] = ["Falsificado", "PrecoSuspeito", "DescricaoIncorreta", "ProdutoProibido", "Outro"];

/**
 * Denúncia de produto (política de monitoramento de vendedores — Portaria Coana 130/2023, art. 8º, V): o comprador
 * aponta falsificação, preço suspeito, descrição errada ou produto proibido; a equipe julga na fila de denúncias.
 */
export function ReportProductButton({ productId, productSlug }: { productId: string; productSlug: string }) {
  const t = useTranslations("report");
  const tErrors = useTranslations("errors");
  const authenticated = useIsAuthenticated();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ProductReportReason>("Falsificado");
  const [details, setDetails] = useState("");
  const report = useReportProduct(productId);

  const start = () => {
    if (!authenticated) {
      router.push(`/entrar?next=${encodeURIComponent(`/produto/${productSlug}`)}`);
      return;
    }
    setOpen(true);
  };

  const submit = () =>
    report.mutate(
      { reason, details: details.trim() || null },
      {
        onSuccess: () => {
          toast.success(t("success"));
          setOpen(false);
          setDetails("");
        },
        onError: (error) =>
          toast.error(isApiError(error) ? (error.errors?.details?.[0] ?? error.message) : tErrors("genericTitle")),
      },
    );

  return (
    <>
      <Button variant="ghost" size="sm" className="self-start text-foreground-secondary" onClick={start}>
        <Flag data-icon="inline-start" strokeWidth={1.75} />
        {t("cta")}
      </Button>
      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent className="sm:mx-auto sm:max-w-lg">
          <BottomSheetHeader>
            <BottomSheetTitle>{t("title")}</BottomSheetTitle>
            <BottomSheetDescription>{t("description")}</BottomSheetDescription>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-4">
            <RadioGroup value={reason} onValueChange={(v) => setReason(v as ProductReportReason)} className="flex flex-col gap-2">
              {REASONS.map((r) => (
                <OptionCard key={r} value={r} align="start">
                  <span className="flex flex-col">
                    <span className="text-body-sm font-medium text-foreground">{t(`reason.${r}`)}</span>
                    <span className="text-caption text-foreground-secondary">{t(`reasonHint.${r}`)}</span>
                  </span>
                </OptionCard>
              ))}
            </RadioGroup>
            <FormField id="report-details" label={t("details")} hint={t("detailsHint")} optional={reason !== "Outro"}>
              <Textarea
                id="report-details"
                rows={3}
                maxLength={1000}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </FormField>
          </BottomSheetBody>
          <BottomSheetFooter>
            <Button variant="primary" fullWidth loading={report.isPending} onClick={submit}>
              {t("submit")}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}
