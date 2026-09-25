"use client";

import { AlertCircle, RefreshCw, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Illustration, type IllustrationName } from "@/components/shared/illustrations";
import { Button } from "@/components/ui/button";
import { isNetworkError, isNotFoundError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Ilustração linear (DESIGN.md › Iconografia). Padrão: "box". */
  illustration?: IllustrationName;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Estado vazio: ilustração + frase curta + uma ação. Sem card dentro de card: fica direto na página. */
export function EmptyState({
  illustration = "box",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}
    >
      <Illustration name={illustration} className="mb-4" />
      <h2 className="text-title-3 text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-[280px] text-body-sm text-foreground-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  error?: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/** Estado de erro que diferencia offline / não encontrado / erro genérico. Sempre ícone + texto. */
export function ErrorState({
  error,
  title,
  description,
  onRetry,
  className,
  compact,
}: ErrorStateProps) {
  const t = useTranslations("errors");
  const offline = isNetworkError(error) || (typeof navigator !== "undefined" && !navigator.onLine);
  const notFound = isNotFoundError(error);
  const illustration: IllustrationName = offline ? "wifi" : notFound ? "search" : "alert";
  const heading =
    title ?? (offline ? t("offlineTitle") : notFound ? t("notFoundTitle") : t("genericTitle"));
  const text =
    description ??
    (offline
      ? t("offlineDescription")
      : notFound
        ? t("notFoundDescription")
        : t("genericDescription"));

  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          "flex items-center gap-3 rounded-md bg-danger-soft p-3 text-body-sm text-danger",
          className,
        )}
      >
        <AlertCircle className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="flex-1 font-medium">{heading}</span>
        {onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" /> {t("retry")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}
    >
      <Illustration name={illustration} className="mb-4" />
      <h2 className="text-title-3 text-foreground">{heading}</h2>
      <p className="mt-1 max-w-[280px] text-body-sm text-foreground-secondary">{text}</p>
      {onRetry ? (
        <Button className="mt-6" variant="secondary" onClick={onRetry}>
          <RefreshCw data-icon="inline-start" /> {t("retry")}
        </Button>
      ) : null}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  /** Link "Ver tudo" ou outra ação à direita. */
  action?: ReactNode;
  /** Ícone discreto antes do título (ex.: raio das ofertas), em primary. */
  icon?: LucideIcon;
  /** Chip logo após o título (ex.: contagem regressiva). */
  meta?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}

/** Título de seção em title-2 com ícone e chip opcionais; ação à direita. */
export function SectionHeader({
  title,
  action,
  icon: Icon,
  meta,
  as: Tag = "h2",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {Icon ? (
          <Icon className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
        ) : null}
        <Tag className="truncate text-title-2 text-foreground">{title}</Tag>
        {meta}
      </div>
      {action}
    </div>
  );
}

/** Carrossel horizontal com snap, sem scrollbar visível; sangra até a borda da tela no mobile. */
export function HorizontalScroller({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-2 [&>*]:snap-start",
        className,
      )}
    >
      {children}
    </div>
  );
}
