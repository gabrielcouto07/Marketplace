"use client";

import type {
  PaymentStatus,
  PayoutStatus,
  ProductStatus,
  SellerStatus,
} from "@marketplace/contracts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/errors";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const brl = (amount: number) => formatMoney({ amount, currency: "BRL" });

/** Mostra a mensagem da API (ou genérica) em toast. */
export function useAdminErrorToast() {
  const tErrors = useTranslations("errors");
  return (error: unknown) =>
    toast.error(isApiError(error) ? error.message : tErrors("genericTitle"));
}

/** Painel lateral/inferior de detalhe usado por todas as áreas do admin. */
export function DetailSheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <BottomSheet open={open} onOpenChange={(next) => !next && onClose()}>
      <BottomSheetContent className="max-h-[92dvh]">
        <BottomSheetHeader>
          <BottomSheetTitle>{title}</BottomSheetTitle>
          {description ? <BottomSheetDescription>{description}</BottomSheetDescription> : null}
        </BottomSheetHeader>
        <BottomSheetBody className="flex flex-col gap-6 overflow-y-auto">
          {children}
        </BottomSheetBody>
      </BottomSheetContent>
    </BottomSheet>
  );
}

/** Lista chave → valor (dados do registro). */
export function KeyValueList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-foreground-secondary">{item.label}</dt>
          <dd className="min-w-0 truncate text-foreground tabular-nums">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SheetSection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-title-3 text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}

/** Paginação simples (anterior / próxima) para tabelas do admin. */
export function Pager({
  page,
  pageSize,
  totalCount,
  onChange,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  onChange: (page: number) => void;
}) {
  const t = useTranslations("admin");
  const pages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-4 text-body-sm text-foreground-secondary">
      <span className="tabular-nums">{t("pager", { page, pages, total: totalCount })}</span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={t("pagerPrev")}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft strokeWidth={1.75} />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={t("pagerNext")}
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight strokeWidth={1.75} />
        </Button>
      </div>
    </div>
  );
}

const SELLER_BADGE: Record<SellerStatus, "success" | "warning" | "danger"> = {
  Aprovado: "success",
  Pendente: "warning",
  Suspenso: "danger",
};
const PAYMENT_BADGE: Record<PaymentStatus, "warning" | "success" | "danger" | "neutral"> = {
  Pendente: "warning",
  Aprovado: "success",
  Recusado: "danger",
  Expirado: "danger",
  Estornado: "neutral",
};
const PAYOUT_BADGE: Record<PayoutStatus, "neutral" | "soft" | "success" | "danger"> = {
  Agendado: "neutral",
  Processando: "soft",
  Pago: "success",
  Falhou: "danger",
};
const PRODUCT_BADGE: Record<ProductStatus, "success" | "neutral" | "warning" | "danger"> = {
  Ativo: "success",
  Rascunho: "neutral",
  Arquivado: "warning",
  EmAnalise: "warning",
  Bloqueado: "danger",
};

export function SellerStatusBadge({ status }: { status: SellerStatus }) {
  const t = useTranslations("admin");
  return <Badge variant={SELLER_BADGE[status]}>{t(`sellerStatus.${status}`)}</Badge>;
}
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations("admin");
  return <Badge variant={PAYMENT_BADGE[status]}>{t(`paymentStatus.${status}`)}</Badge>;
}
export function PayoutStatusBadge({ status }: { status: PayoutStatus }) {
  const t = useTranslations("admin");
  return <Badge variant={PAYOUT_BADGE[status]}>{t(`payoutStatus.${status}`)}</Badge>;
}
export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const t = useTranslations("admin");
  return <Badge variant={PRODUCT_BADGE[status]}>{t(`productStatus.${status}`)}</Badge>;
}

/** Linha de tabela clicável (abre o detalhe). */
export function rowButtonClass(extra?: string) {
  return cn(
    "cursor-pointer transition-colors hover:bg-surface-muted focus-within:bg-surface-muted",
    extra,
  );
}
