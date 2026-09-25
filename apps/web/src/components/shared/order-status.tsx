import type { OrderStatus, OrderTimelineEventDto } from "@marketplace/contracts";
import { ORDER_HAPPY_PATH } from "@marketplace/contracts";
import {
  AlertOctagon,
  Ban,
  Check,
  CircleDollarSign,
  Clock,
  Globe2,
  PackageCheck,
  PackageOpen,
  RotateCcw,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export const ORDER_STATUS_META: Record<OrderStatus, { icon: LucideIcon; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  AguardandoPagamento: { icon: Clock, tone: "warning" },
  Pago: { icon: CircleDollarSign, tone: "info" },
  EmPreparacao: { icon: PackageOpen, tone: "info" },
  Enviado: { icon: Truck, tone: "info" },
  EmTransitoInternacional: { icon: Globe2, tone: "info" },
  Entregue: { icon: PackageCheck, tone: "success" },
  Concluido: { icon: Check, tone: "success" },
  Cancelado: { icon: Ban, tone: "neutral" },
  EmDisputa: { icon: AlertOctagon, tone: "danger" },
  Devolvido: { icon: Undo2, tone: "neutral" },
  Reembolsado: { icon: RotateCcw, tone: "success" },
};

const TONE_CLASSES = {
  neutral: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
  info: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive/10 text-destructive",
} as const;

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const t = useTranslations("orders.status");
  const meta = ORDER_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", TONE_CLASSES[meta.tone], className)}>
      <Icon className="size-3.5" aria-hidden />
      {t(status)}
    </span>
  );
}

interface OrderTimelineProps {
  status: OrderStatus;
  events: OrderTimelineEventDto[];
  className?: string;
}

/**
 * Timeline vertical: mostra o caminho feliz completo (com etapas futuras esmaecidas)
 * e insere as ramificações (Cancelado / EmDisputa → Devolvido / Reembolsado) quando ocorrem.
 */
export function OrderTimeline({ status, events, className }: OrderTimelineProps) {
  const t = useTranslations("orders");
  const format = useFormatter();
  const byStatus = new Map(events.map((e) => [e.status, e]));
  const happyIndex = ORDER_HAPPY_PATH.indexOf(status);
  const branch = events.filter((e) => !ORDER_HAPPY_PATH.includes(e.status)).map((e) => e.status);

  // Etapas do caminho feliz até onde o pedido chegou; se houve ramificação, corta após o último passo feliz atingido.
  const lastHappyReached = Math.max(...events.map((e) => ORDER_HAPPY_PATH.indexOf(e.status)), 0);
  const steps: OrderStatus[] =
    branch.length > 0 ? [...ORDER_HAPPY_PATH.slice(0, lastHappyReached + 1), ...branch] : [...ORDER_HAPPY_PATH];

  return (
    <ol className={cn("relative ml-3 border-l-2 border-border", className)} aria-label={t("timelineLabel")}>
      {steps.map((step, i) => {
        const event = byStatus.get(step);
        const done = Boolean(event);
        const current = step === status;
        const isBranch = !ORDER_HAPPY_PATH.includes(step);
        const meta = ORDER_STATUS_META[step];
        const Icon = meta.icon;
        const future = !done && happyIndex >= 0 && i > happyIndex;
        return (
          <li key={step} className="relative pb-6 pl-6 last:pb-0">
            <span
              className={cn(
                "absolute top-0 -left-[13px] flex size-6 items-center justify-center rounded-full ring-4 ring-background",
                done ? (isBranch ? TONE_CLASSES[meta.tone] : "bg-primary text-primary-foreground") : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700",
                current && "ring-primary/30",
              )}
              aria-hidden
            >
              <Icon className="size-3.5" />
            </span>
            <div className={cn(future && "opacity-50")}>
              <p className={cn("text-sm font-semibold", current && "text-primary")}>
                {t(`status.${step}`)}
                {current ? <span className="sr-only"> ({t("currentStep")})</span> : null}
              </p>
              {event ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(event.occurredAt), "dateTime")}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                  {event.description ? <p className="mt-0.5 text-xs text-muted-foreground">{event.description}</p> : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t("pendingStep")}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
