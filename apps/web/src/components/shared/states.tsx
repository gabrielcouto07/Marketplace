"use client";

import { AlertTriangle, PackageOpen, RefreshCw, SearchX, WifiOff, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { isNetworkError, isNotFoundError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Estado vazio caprichado: ícone em círculo, título, descrição e ação opcional. */
export function EmptyState({ icon: Icon = PackageOpen, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-8" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
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
export function ErrorState({ error, title, description, onRetry, className, compact }: ErrorStateProps) {
  const t = useTranslations("errors");
  const offline = isNetworkError(error) || (typeof navigator !== "undefined" && !navigator.onLine);
  const notFound = isNotFoundError(error);
  const Icon = offline ? WifiOff : notFound ? SearchX : AlertTriangle;
  const heading = title ?? (offline ? t("offlineTitle") : notFound ? t("notFoundTitle") : t("genericTitle"));
  const text = description ?? (offline ? t("offlineDescription") : notFound ? t("notFoundDescription") : t("genericDescription"));

  if (compact) {
    return (
      <div role="alert" className={cn("flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm", className)}>
        <Icon className="size-5 shrink-0 text-destructive" aria-hidden />
        <span className="flex-1">{heading}</span>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" /> {t("retry")}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Icon className="size-8" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold">{heading}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {onRetry ? (
        <Button className="mt-5" onClick={onRetry}>
          <RefreshCw data-icon="inline-start" /> {t("retry")}
        </Button>
      ) : null}
    </div>
  );
}

/** Cabeçalho de seção com link "ver tudo". */
export function SectionHeader({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

/** Carrossel horizontal com snap, sem scrollbar visível. */
export function HorizontalScroller({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-none [&>*]:snap-start", className)}>
      {children}
    </div>
  );
}
