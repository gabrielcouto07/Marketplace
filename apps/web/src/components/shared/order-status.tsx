import type { OrderStatus, OrderTimelineEventDto } from "@marketplace/contracts";
import { ORDER_HAPPY_PATH } from "@marketplace/contracts";
import {
  AlertOctagon,
  Ban,
  Check,
  CircleDollarSign,
  Clock,
  PackageCheck,
  PackageOpen,
  Plane,
  RotateCcw,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const ORDER_STATUS_META: Record<OrderStatus, { icon: LucideIcon; tone: Tone }> = {
  AguardandoPagamento: { icon: Clock, tone: "warning" },
  Pago: { icon: CircleDollarSign, tone: "info" },
  EmPreparacao: { icon: PackageOpen, tone: "info" },
  Enviado: { icon: Truck, tone: "info" },
  /* Ícone próprio: o trecho Paraguai → Brasil. */
  EmTransitoInternacional: { icon: Plane, tone: "info" },
  Entregue: { icon: PackageCheck, tone: "success" },
  Concluido: { icon: Check, tone: "success" },
  Cancelado: { icon: Ban, tone: "danger" },
  EmDisputa: { icon: AlertOctagon, tone: "danger" },
  Devolvido: { icon: Undo2, tone: "neutral" },
  Reembolsado: { icon: RotateCcw, tone: "success" },
};

const TONE_BADGE: Record<Tone, "neutral" | "soft" | "success" | "warning" | "danger"> = {
  neutral: "neutral",
  info: "soft",
  success: "success",
  warning: "warning",
  danger: "danger",
};

/** Badge de status (ícone + rótulo) no tom do status. */
export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const t = useTranslations("orders.status");
  const meta = ORDER_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant={TONE_BADGE[meta.tone]} className={className}>
      <Icon strokeWidth={1.75} aria-hidden />
      {t(status)}
    </Badge>
  );
}

interface OrderTimelineProps {
  status: OrderStatus;
  events: OrderTimelineEventDto[];
  className?: string;
}

/**
 * Timeline vertical com pontos conectados (DESIGN.md › OrderTimeline): passado em --primary
 * preenchido, atual com anel pulsando, futuro em neutral-300. Mostra o caminho feliz inteiro e
 * insere as ramificações (Cancelado / EmDisputa → Devolvido / Reembolsado) quando ocorrem.
 */
export function OrderTimeline({ status, events, className }: OrderTimelineProps) {
  const t = useTranslations("orders");
  const format = useFormatter();
  const byStatus = new Map(events.map((e) => [e.status, e]));
  const branch = events.filter((e) => !ORDER_HAPPY_PATH.includes(e.status)).map((e) => e.status);
  const lastHappyReached = Math.max(...events.map((e) => ORDER_HAPPY_PATH.indexOf(e.status)), 0);
  const steps: OrderStatus[] =
    branch.length > 0
      ? [...ORDER_HAPPY_PATH.slice(0, lastHappyReached + 1), ...branch]
      : [...ORDER_HAPPY_PATH];
  const currentIndex = steps.indexOf(status);

  return (
    <ol className={cn("flex flex-col", className)} aria-label={t("timelineLabel")}>
      {steps.map((step, i) => {
        const event = byStatus.get(step);
        const current = step === status;
        const past = Boolean(event) && !current && i < currentIndex;
        const done = Boolean(event) && !current;
        const meta = ORDER_STATUS_META[step];
        const Icon = meta.icon;
        const isLast = i === steps.length - 1;
        const branchDanger = done && meta.tone === "danger";
        return (
          <li key={step} className="relative grid grid-cols-[24px_1fr] gap-x-3">
            {/* conector */}
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-6 bottom-0 left-[11px] w-0.5",
                  past || done ? "bg-primary" : "bg-border-strong",
                )}
              />
            ) : null}
            {/* ponto */}
            <span
              aria-hidden
              className={cn(
                "relative z-10 flex size-6 items-center justify-center rounded-full",
                done && !branchDanger && "bg-primary text-primary-foreground",
                branchDanger && "bg-danger text-white",
                current &&
                  "animate-ring-pulse border-2 border-primary bg-surface text-primary motion-reduce:animate-none",
                !done && !current && "border-2 border-border-strong bg-surface",
              )}
            >
              {done ? (
                <Check className="size-3.5" strokeWidth={2.5} />
              ) : current ? (
                <Icon className="size-3.5" strokeWidth={2} />
              ) : null}
            </span>
            <div
              className={cn(
                "flex flex-col pb-6",
                isLast && "pb-0",
                !done && !current && "opacity-60",
              )}
            >
              <p
                className={cn(
                  "text-body-sm leading-6",
                  current ? "font-semibold text-primary" : "font-medium text-foreground",
                )}
              >
                {t(`status.${step}`)}
                {current ? <span className="sr-only"> ({t("currentStep")})</span> : null}
              </p>
              {event ? (
                <>
                  <p className="text-caption text-foreground-muted tabular-nums">
                    {format.dateTime(new Date(event.occurredAt), "dateTime")}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                  {event.description ? (
                    <p className="mt-0.5 text-caption text-foreground-secondary">
                      {event.description}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-caption text-foreground-muted">{t("pendingStep")}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
