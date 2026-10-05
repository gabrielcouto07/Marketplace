"use client";

import type { OrderDto } from "@marketplace/contracts";
import { FileDown, PackageCheck, Tag, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadAuthenticated } from "@/lib/api/download";
import { isApiError } from "@/lib/api/errors";

import { useCreateShipment, useSellerShippingPolicy, useShipOrder } from "../api";

/**
 * Envio pelo Remessa Conforme: o vendedor não digita rastreio. A plataforma registra a declaração antecipada no operador
 * e emite a etiqueta com marca, nome comercial e CNPJ/TIN (critérios i e iii); o vendedor baixa, cola no pacote, posta
 * e confirma. Só quando a plataforma não exige a etiqueta (política de envio) aparece "Informar envio", com
 * transportadora e rastreio digitados.
 */
export function OrderShipmentActions({
  order,
  onPrepare,
  onShip,
  preparing,
}: {
  order: OrderDto;
  onPrepare?: (order: OrderDto) => void;
  /** Abre o formulário de rastreio manual (só quando a política permite). */
  onShip?: (order: OrderDto) => void;
  preparing?: boolean;
}) {
  const t = useTranslations("sellerPanel");
  const tErrors = useTranslations("errors");
  const createShipment = useCreateShipment();
  const ship = useShipOrder();
  const policy = useSellerShippingPolicy();
  const [downloading, setDownloading] = useState(false);
  const shipment = order.shipment ?? null;
  const open = order.status === "Pago" || order.status === "EmPreparacao";
  const labelReady = shipment?.status === "EtiquetaEmitida";
  // Enquanto a política carrega, vale o padrão: etiqueta da plataforma, sem rastreio manual.
  const canIssueLabel = policy.data?.carrierConfigured ?? true;
  const manualAllowed = policy.data ? !policy.data.requirePlatformLabel : false;
  const fail = (e: unknown) =>
    toast.error(isApiError(e) ? (Object.values(e.errors ?? {})[0]?.[0] ?? e.message) : tErrors("genericTitle"));

  const download = async () => {
    if (!shipment?.labelUrl) return;
    setDownloading(true);
    try {
      await downloadAuthenticated(shipment.labelUrl, `etiqueta-${order.number}.pdf`);
    } catch (e) {
      fail(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-2">
        {order.status === "Pago" && onPrepare ? (
          <Button variant="secondary" size="sm" loading={preparing} onClick={() => onPrepare(order)}>
            <PackageCheck data-icon="inline-start" strokeWidth={1.75} /> {t("actionPrepare")}
          </Button>
        ) : null}
        {open && !labelReady && canIssueLabel ? (
          <Button
            variant="primary"
            size="sm"
            loading={createShipment.isPending}
            onClick={() =>
              createShipment.mutate(order.id, {
                onSuccess: (s) => toast.success(t("labelSuccess", { number: order.number, tracking: s.trackingCode ?? "" })),
                onError: fail,
              })
            }
          >
            <Tag data-icon="inline-start" strokeWidth={1.75} /> {t("actionLabel")}
          </Button>
        ) : null}
        {open && !labelReady && manualAllowed && onShip ? (
          <Button variant={canIssueLabel ? "secondary" : "primary"} size="sm" onClick={() => onShip(order)}>
            <Truck data-icon="inline-start" strokeWidth={1.75} /> {t("shipTitle")}
          </Button>
        ) : null}
        {shipment?.hasLabel && shipment.labelUrl ? (
          <Button variant="secondary" size="sm" loading={downloading} onClick={download}>
            <FileDown data-icon="inline-start" strokeWidth={1.75} /> {t("actionDownloadLabel")}
          </Button>
        ) : null}
        {open && labelReady ? (
          <Button
            variant="primary"
            size="sm"
            loading={ship.isPending}
            onClick={() =>
              ship.mutate(
                { id: order.id, body: {} },
                { onSuccess: () => toast.success(t("shipSuccess", { number: order.number })), onError: fail },
              )
            }
          >
            <Truck data-icon="inline-start" strokeWidth={1.75} /> {t("actionConfirmPosting")}
          </Button>
        ) : null}
      </div>
      {shipment ? (
        <span className="flex flex-wrap items-center justify-end gap-1.5 text-caption text-foreground-secondary tabular-nums">
          {shipment.sandbox ? <Badge variant="warning">{t("sandbox")}</Badge> : null}
          {shipment.trackingCode}
          {shipment.declarationNumber ? <span>· {t("declaration", { number: shipment.declarationNumber })}</span> : null}
          {shipment.status === "Falhou" && shipment.lastError ? <span className="text-danger">{shipment.lastError}</span> : null}
        </span>
      ) : order.trackingCode ? (
        <span className="text-caption text-foreground-secondary tabular-nums">{order.trackingCode}</span>
      ) : open && !canIssueLabel && !manualAllowed ? (
        <span className="max-w-64 text-right text-caption text-warning">{t("labelUnavailable")}</span>
      ) : null}
    </div>
  );
}
