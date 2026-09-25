"use client";

import {
  AlertTriangle,
  PackageOpen,
  RefreshCw,
  SearchX,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { isNetworkError, isNotFoundError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const ICON_TONES = {
  blue: "bg-accent text-primary",
  red: "bg-destructive-soft text-cta",
  green: "bg-success-soft text-success",
} as const;

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: keyof typeof ICON_TONES;
  className?: string;
}

/** Estado vazio: card branco com ícone em quadrado arredondado colorido, título, texto e ação. */
export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  action,
  tone = "blue",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl bg-card px-6 py-10 text-center shadow-card",
        className,
      )}
    >
      <span
        className={cn(
          "mb-3 flex size-[72px] items-center justify-center rounded-3xl",
          ICON_TONES[tone],
        )}
      >
        <Icon className="size-8" strokeWidth={1.8} aria-hidden />
      </span>
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-1.5 max-w-[260px] text-[13.5px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
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

/** Estado de erro que diferencia offline / não encontrado / erro genérico. */
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
  const Icon = offline ? WifiOff : notFound ? SearchX : AlertTriangle;
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
          "flex items-center gap-3 rounded-xl bg-destructive-soft p-3 text-sm font-medium text-destructive",
          className,
        )}
      >
        <Icon className="size-5 shrink-0" aria-hidden />
        <span className="flex-1">{heading}</span>
        {onRetry ? (
          <Button size="sm" variant="white" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" /> {t("retry")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl bg-card px-6 py-10 text-center shadow-card",
        className,
      )}
    >
      <span
        className={cn(
          "mb-3 flex size-[72px] items-center justify-center rounded-3xl",
          offline ? ICON_TONES.blue : ICON_TONES.red,
        )}
      >
        <Icon className="size-8" strokeWidth={1.8} aria-hidden />
      </span>
      <h2 className="text-lg font-extrabold tracking-tight">{heading}</h2>
      <p className="mt-1.5 max-w-[260px] text-[13.5px] leading-relaxed text-muted-foreground">
        {text}
      </p>
      {onRetry ? (
        <Button className="mt-5" onClick={onRetry}>
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
  /** Ícone em quadrado colorido antes do título (ex.: raio das ofertas). */
  icon?: LucideIcon;
  iconTone?: "red" | "blue";
  /** Chip logo após o título (ex.: contagem regressiva). */
  meta?: ReactNode;
  as?: "h1" | "h2";
  className?: string;
}

/** Título de seção em 18 px / 800 com ícone e chip opcionais. */
export function SectionHeader({
  title,
  action,
  icon: Icon,
  iconTone = "red",
  meta,
  as: Tag = "h2",
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-3.5 flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {Icon ? (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-[9px]",
              iconTone === "red"
                ? "bg-cta text-cta-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            <Icon className="size-4 fill-current" aria-hidden />
          </span>
        ) : null}
        <Tag className="truncate text-lg font-extrabold tracking-tight">{title}</Tag>
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
        "-mx-4 scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pt-1 pb-2 [&>*]:snap-start",
        className,
      )}
    >
      {children}
    </div>
  );
}
