"use client";

import type { PaymentDto, PaymentStatus } from "@marketplace/contracts";
import { AlertCircle, Clock, Copy, CreditCard, Download, PlayCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import type { IllustrationName } from "@/components/shared/illustrations";
import { ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePayment, usePurchaseOrders, useSimulatePaymentApproval } from "@/features/orders/api";
import { ResultHeader } from "@/features/orders/components/confirmation-view";
import {
  PurchaseSkeleton,
  PurchaseTotalsCard,
} from "@/features/orders/components/purchase-order-card";
import { formatCountdown, useCountdown } from "@/hooks/use-countdown";
import { Link, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";

export function PaymentView({ paymentId }: { paymentId: string }) {
  const t = useTranslations("payment");
  const tOrders = useTranslations("orders");
  const tCart = useTranslations("cart");
  const router = useRouter();
  const { data: payment, isPending, isError, error, refetch } = usePayment(paymentId);
  const orders = usePurchaseOrders(payment?.purchaseId ?? "");
  const simulate = useSimulatePaymentApproval(paymentId);
  const redirected = useRef(false);

  const confirmationHref = payment
    ? `/pedido/confirmado?purchase=${payment.purchaseId}`
    : "/conta/pedidos";

  // Pix/boleto aprovados: avisa e redireciona para a confirmação após 2 s.
  useEffect(() => {
    if (
      !payment ||
      payment.status !== "Aprovado" ||
      payment.method === "Cartao" ||
      redirected.current
    )
      return;
    redirected.current = true;
    toast.success(t("approved"));
    const timer = window.setTimeout(() => router.replace(confirmationHref), 2000);
    return () => window.clearTimeout(timer);
  }, [payment, confirmationHref, router, t]);

  const expires = payment?.pix?.expiresAt ?? null;
  const remaining = useCountdown(payment?.status === "Pendente" ? expires : null);

  if (isPending) return <PurchaseSkeleton />;

  if (isError) {
    return (
      <PageContainer className="pt-4">
        <ErrorState error={error} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  const pixExpired =
    payment.method === "Pix" && payment.status === "Pendente" && expires !== null && remaining <= 0;
  const approved = payment.status === "Aprovado";
  const pendingActive = payment.status === "Pendente" && !pixExpired;

  const heading: { illustration: IllustrationName; title: string; subtitle?: string } = pixExpired
    ? { illustration: "alert", title: t("expired"), subtitle: t("pixExpiredHint") }
    : approved
      ? {
          illustration: "check",
          title: t("approved"),
          subtitle:
            payment.method === "Cartao" && payment.card
              ? t("cardApproved", { last4: payment.card.last4 })
              : undefined,
        }
      : pendingActive
        ? {
            illustration: "box",
            title: t("pendingTitle"),
            subtitle:
              payment.method === "Pix"
                ? t("pixInstructions")
                : payment.method === "Boleto"
                  ? t("boletoInstructions")
                  : t("waiting"),
          }
        : {
            illustration: "alert",
            title:
              payment.status === "Estornado"
                ? t("refunded")
                : payment.status === "Expirado"
                  ? t("expired")
                  : t("declined"),
            subtitle: payment.status === "Recusado" ? t("cardDeclinedHint") : undefined,
          };

  return (
    <PageContainer className="flex flex-col gap-6 pt-6 pb-6 sm:max-w-lg">
      <div role="status" aria-live="polite">
        <ResultHeader
          illustration={heading.illustration}
          title={heading.title}
          subtitle={heading.subtitle}
        >
          <PaymentStatusBadge status={pixExpired ? "Expirado" : payment.status} />
        </ResultHeader>
        <span className="sr-only">{t("status")}</span>
      </div>

      {payment.method === "Pix" && payment.pix && pendingActive ? (
        <PixCard payment={payment} remaining={remaining} />
      ) : null}
      {payment.method === "Boleto" && payment.boleto && pendingActive ? (
        <BoletoCard payment={payment} />
      ) : null}
      {payment.method === "Cartao" && payment.card ? (
        <section className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <CreditCard className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-body-sm font-medium text-foreground">{t("cardTitle")}</p>
            <p className="text-caption text-foreground-secondary tabular-nums">
              {payment.card.brand} · {payment.card.installments}x{" "}
              {formatMoney(payment.card.installmentAmount)}
            </p>
          </div>
          <span className="shrink-0 text-body-sm font-medium text-foreground tabular-nums">
            {formatMoney(payment.amount)}
          </span>
        </section>
      ) : null}

      {orders.data && orders.data.length > 0 ? (
        <PurchaseTotalsCard orders={orders.data} pending={!approved} />
      ) : (
        <section className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
          <span className="text-body-sm font-medium text-foreground">
            {approved ? tOrders("totalPaid") : tOrders("totalDue")}
          </span>
          <span className="text-title-3 text-foreground tabular-nums">
            {formatMoney(payment.amount)}
          </span>
        </section>
      )}

      {payment.status === "Pendente" ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-caption text-foreground-secondary">{t("simulateHint")}</p>
          <Button
            variant="ghost"
            size="sm"
            loading={simulate.isPending}
            onClick={() => simulate.mutate()}
          >
            <PlayCircle data-icon="inline-start" strokeWidth={1.75} />
            {t("simulateApproval")}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" fullWidth render={<Link href="/conta/pedidos" />}>
          {tOrders("title")}
        </Button>
        {approved ? (
          <Button variant="primary" fullWidth render={<Link href={confirmationHref} />}>
            {t("goToConfirmation")}
          </Button>
        ) : (
          <Button variant="primary" fullWidth render={<Link href="/" />}>
            {tCart("continueShopping")}
          </Button>
        )}
      </div>
      <p className="sr-only">{tOrders("paymentInfo")}</p>
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<PaymentStatus, "warning" | "success" | "danger" | "neutral"> = {
  Pendente: "warning",
  Aprovado: "success",
  Recusado: "danger",
  Expirado: "danger",
  Estornado: "neutral",
};

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations("orders.paymentStatus");
  const variant = STATUS_BADGE[status];
  return (
    <Badge variant={variant}>
      {variant === "danger" ? <AlertCircle strokeWidth={1.75} aria-hidden /> : null}
      {t(status)}
    </Badge>
  );
}

function useCopy() {
  const tc = useTranslations("common");
  return async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(tc("copied"));
    } catch {
      toast.error(tc("copy"));
    }
  };
}

function PixCard({ payment, remaining }: { payment: PaymentDto; remaining: number }) {
  const t = useTranslations("payment");
  const tc = useTranslations("common");
  const copy = useCopy();
  const pix = payment.pix!;
  return (
    <section
      aria-labelledby="pix-title"
      className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs"
    >
      <h2 id="pix-title" className="text-title-3 text-foreground">
        {t("pixTitle")}
      </h2>
      <div className="rounded-md border border-border bg-surface p-3">
        <QRCodeSVG
          value={pix.qrCodePayload}
          size={176}
          level="M"
          includeMargin={false}
          aria-label={t("qrLabel")}
        />
      </div>
      <span className="inline-flex h-8 items-center gap-1 rounded-sm bg-surface-muted px-2 text-caption text-foreground-secondary tabular-nums">
        <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
        {t("expiresChip", { time: formatCountdown(remaining) })}
      </span>
      <div className="flex w-full gap-2">
        <Input
          readOnly
          aria-label={t("pixCopyPaste")}
          value={pix.qrCodePayload}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 truncate font-mono"
        />
        <Button
          variant="secondary"
          className="shrink-0"
          onClick={() => copy(pix.qrCodePayload)}
          aria-label={t("copyCode")}
        >
          <Copy data-icon="inline-start" strokeWidth={1.75} /> {tc("copy")}
        </Button>
      </div>
    </section>
  );
}

function BoletoCard({ payment }: { payment: PaymentDto }) {
  const t = useTranslations("payment");
  const format = useFormatter();
  const copy = useCopy();
  const boleto = payment.boleto!;
  return (
    <section
      aria-labelledby="boleto-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs"
    >
      <h2 id="boleto-title" className="text-title-3 text-foreground">
        {t("boletoTitle")}
      </h2>
      <div className="flex flex-col gap-1">
        <span className="text-caption text-foreground-secondary">{t("digitableLine")}</span>
        <p className="rounded-md bg-surface-muted p-3 font-mono text-body-sm break-all text-foreground tabular-nums">
          {boleto.digitableLine}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 text-body-sm">
        <span className="text-foreground-secondary">{t("dueDate")}</span>
        <span className="font-medium text-foreground tabular-nums">
          {format.dateTime(new Date(boleto.dueDate), "short")}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" fullWidth onClick={() => copy(boleto.digitableLine)}>
          <Copy data-icon="inline-start" strokeWidth={1.75} /> {t("copyLine")}
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={() => toast(t("downloadBoleto"), { description: boleto.pdfUrl })}
        >
          <Download data-icon="inline-start" strokeWidth={1.75} /> {t("downloadPdf")}
        </Button>
      </div>
    </section>
  );
}
