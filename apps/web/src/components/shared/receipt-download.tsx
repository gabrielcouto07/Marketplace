"use client";

import { FileDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downloadAuthenticated } from "@/lib/api/download";

/**
 * Comprovante do pedido em PDF (Programa de Conformidade 10.3): pagamento aprovado e valor da compra discriminado,
 * guardado com o pedido por 5 anos. `path` é a rota da API para quem está vendo (comprador, vendedor ou admin).
 */
export function ReceiptDownloadButton({
  path,
  orderNumber,
  variant = "secondary",
  size = "sm",
  fullWidth,
  className,
}: {
  path: string;
  orderNumber: string;
  variant?: "secondary" | "ghost" | "soft";
  size?: "sm" | "xs" | "default";
  fullWidth?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      className={className}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadAuthenticated(path, `comprovante-${orderNumber}.pdf`);
        } catch {
          toast.error(t("receiptError"));
        } finally {
          setBusy(false);
        }
      }}
    >
      <FileDown data-icon="inline-start" strokeWidth={1.75} />
      {t("receipt")}
    </Button>
  );
}
