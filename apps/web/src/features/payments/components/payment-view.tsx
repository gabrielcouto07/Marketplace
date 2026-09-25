"use client";

import type { PaymentDto } from "@marketplace/contracts";
import { Barcode, CheckCircle2, Clock, Copy, CreditCard, Download, Loader2, QrCode, RotateCcw, XCircle } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePayment, useSimulatePaymentApproval } from "@/features/orders/api";
import { formatCountdown, useCountdown } from "@/hooks/use-countdown";
import { Link, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function PaymentView({ paymentId }: { paymentId: string }) {
  const t = useTranslations("payment");
  const tOrders = useTranslations("orders");
  const router = useRouter();
  const { data: payment, isPending, isError, error, refetch } = usePayment(paymentId);
  const simulate = useSimulatePaymentApproval(paymentId);
  const redirected = useRef(false);

  const confirmationHref = payment ? `/pedido/confirmado?purchase=${payment.purchaseId}` : "/conta/pedidos";

  // Pix/boleto aprovados: avisa e redireciona para a confirmação após 2 s.
  useEffect(() => {
    if (!payment || payment.status !== "Aprovado" || payment.method === "Cartao" || redirected.current) return;
    redirected.current = true;
    toast.success(t("approved"));
    const timer = window.setTimeout(() => router.replace(confirmationHref), 2000);
    return () => window.clearTimeout(timer);
  }, [payment, confirmationHref, router, t]);

  if (isPending) {
    return (
      <PageContainer className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="mx-auto size-56 rounded-xl" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState error={error} onRetry={() => refetch()} className="min-h-[60vh]" />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-4 pt-4 pb-8 sm:max-w-lg">
      <StatusBanner payment={payment} />

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <span className="text-sm text-muted-foreground">{t("amount")}</span>
        <span className="text-xl font-bold">{formatMoney(payment.amount)}</span>
      </div>

      {payment.method === "Pix" && payment.pix ? <PixPanel payment={payment} /> : null}
      {payment.method === "Boleto" && payment.boleto ? <BoletoPanel payment={payment} /> : null}
      {payment.method === "Cartao" && payment.card ? (
        <section className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <CreditCard className="size-8 text-primary" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">{t("cardTitle")}</p>
            <p className="text-muted-foreground">
              {payment.status === "Aprovado" ? t("cardApproved", { last4: payment.card.last4 }) : t("declined")} · {payment.card.brand} ·{" "}
              {payment.card.installments}x {formatMoney(payment.card.installmentAmount)}
            </p>
          </div>
        </section>
      ) : null}

      {payment.status === "Pendente" ? (
        <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          <p className="mb-2">{t("simulateHint")}</p>
          <Button variant="outline" size="sm" disabled={simulate.isPending} onClick={() => simulate.mutate()}>
            {simulate.isPending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}
            {t("simulateApproval")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {payment.status === "Aprovado" ? (
          <Button variant="cta" size="lg" className="flex-1" render={<Link href={confirmationHref} />}>
            {t("goToConfirmation")}
          </Button>
        ) : null}
        <Button variant="outline" size="lg" className="flex-1" render={<Link href="/conta/pedidos" />}>
          {t("goToOrders")}
        </Button>
      </div>
      <p className="sr-only">{tOrders("paymentInfo")}</p>
    </PageContainer>
  );
}

function StatusBanner({ payment }: { payment: PaymentDto }) {
  const t = useTranslations("payment");
  const expires = payment.pix?.expiresAt ?? null;
  const remaining = useCountdown(payment.status === "Pendente" ? expires : null);
  const pixExpired = payment.method === "Pix" && payment.status === "Pendente" && expires !== null && remaining <= 0;

  const meta = pixExpired
    ? { icon: XCircle, tone: "bg-destructive/10 text-destructive", label: t("expired") }
    : payment.status === "Aprovado"
      ? { icon: CheckCircle2, tone: "bg-success-soft text-success", label: t("approved") }
      : payment.status === "Pendente"
        ? { icon: Clock, tone: "bg-warning-soft text-warning", label: t("waiting") }
        : payment.status === "Estornado"
          ? { icon: RotateCcw, tone: "bg-neutral-100 text-neutral-700", label: t("refunded") }
          : { icon: XCircle, tone: "bg-destructive/10 text-destructive", label: payment.status === "Expirado" ? t("expired") : t("declined") };
  const Icon = meta.icon;

  return (
    <div role="status" aria-live="polite" className={cn("flex items-center gap-3 rounded-xl px-4 py-3", meta.tone)}>
      <Icon className={cn("size-6 shrink-0", payment.status === "Pendente" && !pixExpired && "animate-pulse")} aria-hidden />
      <div className="flex flex-col">
        <span className="font-semibold">{meta.label}</span>
        {payment.status === "Pendente" && expires && !pixExpired ? (
          <span className="text-xs">{t("expiresIn", { time: formatCountdown(remaining) })}</span>
        ) : null}
        <span className="sr-only">{t("status")}</span>
      </div>
    </div>
  );
}

function CopyField({ label, value, buttonLabel }: { label: string; value: string; buttonLabel: string }) {
  const tc = useTranslations("common");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(tc("copied"));
    } catch {
      toast.error(tc("copy"));
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        <input
          readOnly
          aria-label={label}
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-surface px-3 font-mono text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button variant="outline" onClick={copy} aria-label={buttonLabel}>
          <Copy data-icon="inline-start" /> <span className="hidden sm:inline">{buttonLabel}</span>
        </Button>
      </div>
    </div>
  );
}

function PixPanel({ payment }: { payment: PaymentDto }) {
  const t = useTranslations("payment");
  const pix = payment.pix!;
  return (
    <section aria-labelledby="pix-title" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <h2 id="pix-title" className="flex items-center gap-2 text-base font-bold">
        <QrCode className="size-5 text-primary" aria-hidden /> {t("pixTitle")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("pixInstructions")}</p>
      <div className="mx-auto rounded-xl border-4 border-surface bg-white p-3">
        <QRCodeSVG value={pix.qrCodePayload} size={208} level="M" includeMargin={false} aria-label={t("pixCopyPaste")} />
      </div>
      <CopyField label={t("pixCopyPaste")} value={pix.qrCodePayload} buttonLabel={t("copyCode")} />
    </section>
  );
}

function BoletoPanel({ payment }: { payment: PaymentDto }) {
  const t = useTranslations("payment");
  const format = useFormatter();
  const boleto = payment.boleto!;
  const bars = boleto.barcode.split("").map((c) => Number(c));
  return (
    <section aria-labelledby="boleto-title" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <h2 id="boleto-title" className="flex items-center gap-2 text-base font-bold">
        <Barcode className="size-5 text-primary" aria-hidden /> {t("boletoTitle")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("boletoInstructions")}</p>
      <div className="flex h-16 items-stretch gap-px overflow-hidden rounded-md bg-white px-2 py-1" aria-hidden>
        {bars.map((n, i) => (
          <span key={i} className={cn("bg-neutral-900", n % 2 === 0 ? "w-[2px]" : "w-1", n > 6 ? "mx-px" : "")} />
        ))}
      </div>
      <CopyField label={t("digitableLine")} value={boleto.digitableLine} buttonLabel={t("copyCode")} />
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("dueDate")}</span>
        <span className="font-semibold">{format.dateTime(new Date(boleto.dueDate), "short")}</span>
      </div>
      <Button variant="outline" onClick={() => toast(t("downloadBoleto"), { description: boleto.pdfUrl })}>
        <Download data-icon="inline-start" /> {t("downloadBoleto")}
      </Button>
    </section>
  );
}
