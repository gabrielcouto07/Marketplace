"use client";

import type { PaymentDto } from "@marketplace/contracts";
import { CheckCircle2, Copy, CreditCard, Download, Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { usePayment, usePurchaseOrders, useSimulatePaymentApproval } from "@/features/orders/api";
import {
  DoneHeader,
  DoneSkeleton,
  OrdersListCard,
} from "@/features/orders/components/confirmation-view";
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

  if (isPending) return <DoneSkeleton />;

  if (isError) {
    return (
      <PageContainer className="pt-6">
        <ErrorState error={error} onRetry={() => refetch()} />
      </PageContainer>
    );
  }

  const pixExpired =
    payment.method === "Pix" && payment.status === "Pendente" && expires !== null && remaining <= 0;
  const approved = payment.status === "Aprovado";
  const pendingActive = payment.status === "Pendente" && !pixExpired;

  const heading = pixExpired
    ? { tone: "error" as const, title: t("expired"), subtitle: undefined }
    : approved
      ? {
          tone: "approved" as const,
          title: t("approved"),
          subtitle:
            payment.method === "Cartao" && payment.card
              ? t("cardApproved", { last4: payment.card.last4 })
              : undefined,
        }
      : pendingActive
        ? {
            tone: "pending" as const,
            title: t("pendingTitle"),
            subtitle:
              payment.method === "Pix"
                ? t("pixInstructions")
                : payment.method === "Boleto"
                  ? t("boletoInstructions")
                  : t("waiting"),
          }
        : {
            tone: "error" as const,
            title:
              payment.status === "Estornado"
                ? t("refunded")
                : payment.status === "Expirado"
                  ? t("expired")
                  : t("declined"),
            subtitle: undefined,
          };

  return (
    <PageContainer className="flex flex-col gap-3 pt-7 pb-6 sm:max-w-lg">
      <div role="status" aria-live="polite">
        <DoneHeader tone={heading.tone} title={heading.title} subtitle={heading.subtitle} />
        <span className="sr-only">{t("status")}</span>
      </div>

      {payment.method === "Pix" && payment.pix && pendingActive ? (
        <PixCard payment={payment} remaining={remaining} />
      ) : null}
      {payment.method === "Boleto" && payment.boleto && pendingActive ? (
        <BoletoCard payment={payment} />
      ) : null}
      {payment.method === "Cartao" && payment.card ? (
        <section
          className="flex animate-rise items-center gap-3 rounded-3xl bg-card p-4 shadow-card"
          style={{ animationDelay: "40ms" }}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 text-[13.5px]">
            <p className="font-bold">{t("cardTitle")}</p>
            <p className="text-muted-foreground">
              {payment.card.brand} · {payment.card.installments}x{" "}
              {formatMoney(payment.card.installmentAmount)}
            </p>
          </div>
          <span className="ml-auto shrink-0 font-extrabold tabular-nums">
            {formatMoney(payment.amount)}
          </span>
        </section>
      ) : null}

      {orders.data && orders.data.length > 0 ? (
        <OrdersListCard orders={orders.data} pending={!approved} index={2} />
      ) : (
        <section
          className="flex animate-rise items-center justify-between rounded-3xl bg-card p-4 text-[13.5px] shadow-card"
          style={{ animationDelay: "80ms" }}
        >
          <span className="font-extrabold">
            {approved ? tOrders("totalPaid") : tOrders("totalDue")}
          </span>
          <span className="font-extrabold tabular-nums">{formatMoney(payment.amount)}</span>
        </section>
      )}

      {payment.status === "Pendente" ? (
        <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-dashed border-line-300 p-3 text-xs text-muted-foreground">
          <p>{t("simulateHint")}</p>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={simulate.isPending}
            onClick={() => simulate.mutate()}
          >
            {simulate.isPending ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <CheckCircle2 data-icon="inline-start" />
            )}
            {t("simulateApproval")}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="outline"
          size="lg"
          className="font-extrabold"
          render={<Link href="/conta/pedidos" />}
        >
          {tOrders("title")}
        </Button>
        {approved ? (
          <Button size="lg" className="font-extrabold" render={<Link href={confirmationHref} />}>
            {t("goToConfirmation")}
          </Button>
        ) : (
          <Button size="lg" className="font-extrabold" render={<Link href="/" />}>
            {tCart("continueShopping")}
          </Button>
        )}
      </div>
      <p className="sr-only">{tOrders("paymentInfo")}</p>
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------

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
      className="flex animate-rise flex-col items-center gap-3.5 rounded-3xl bg-card p-[18px] shadow-card"
      style={{ animationDelay: "40ms" }}
    >
      <h2 id="pix-title" className="sr-only">
        {t("pixTitle")}
      </h2>
      <div className="flex size-[200px] items-center justify-center rounded-2xl bg-white p-3 ring-4 ring-surface">
        <QRCodeSVG
          value={pix.qrCodePayload}
          size={176}
          level="M"
          includeMargin={false}
          aria-label={t("qrLabel")}
        />
      </div>
      <p className="text-[13px] text-muted-foreground">
        {t("expiresInLabel")}{" "}
        <b className="font-bold text-foreground tabular-nums">{formatCountdown(remaining)}</b>
      </p>
      <div className="flex w-full items-center gap-2 rounded-lg bg-surface py-1.5 pr-1.5 pl-3">
        <input
          readOnly
          aria-label={t("pixCopyPaste")}
          value={pix.qrCodePayload}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 truncate bg-transparent font-mono text-xs text-body outline-none"
        />
        <Button
          size="sm"
          className="shrink-0 rounded-[11px]"
          onClick={() => copy(pix.qrCodePayload)}
          aria-label={t("copyCode")}
        >
          <Copy data-icon="inline-start" /> {tc("copy")}
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
  const bars = boleto.barcode.split("").map((c) => Number(c));
  return (
    <section
      aria-labelledby="boleto-title"
      className="flex animate-rise flex-col gap-3 rounded-3xl bg-card p-[18px] shadow-card"
      style={{ animationDelay: "40ms" }}
    >
      <h2 id="boleto-title" className="sr-only">
        {t("boletoTitle")}
      </h2>
      <div
        className="flex h-16 items-stretch gap-px overflow-hidden rounded-sm bg-white px-2 py-1"
        aria-hidden
      >
        {bars.map((n, i) => (
          <span
            key={i}
            className={`bg-ink ${n % 2 === 0 ? "w-[2px]" : "w-1"} ${n > 6 ? "mx-px" : ""}`}
          />
        ))}
      </div>
      <p className="text-center font-mono text-[12.5px] text-body tabular-nums">
        {boleto.digitableLine}
      </p>
      <Button className="w-full" onClick={() => copy(boleto.digitableLine)}>
        <Copy data-icon="inline-start" /> {t("copyDigitableLine")}
      </Button>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-muted-foreground">{t("dueDate")}</span>
        <span className="font-bold">{format.dateTime(new Date(boleto.dueDate), "short")}</span>
      </div>
      <Button
        variant="soft"
        onClick={() => toast(t("downloadBoleto"), { description: boleto.pdfUrl })}
      >
        <Download data-icon="inline-start" /> {t("downloadBoleto")}
      </Button>
    </section>
  );
}
