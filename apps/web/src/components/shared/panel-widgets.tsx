"use client";

import { ArrowDownRight, ArrowUpRight, Search, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* KPIs                                                                 */
/* ------------------------------------------------------------------ */

export interface KpiDelta {
  /** Texto já formatado (ex.: "+12 %", "−2"). */
  value: string;
  /** `success` quando a variação é boa para o negócio, `danger` quando não. */
  tone: "success" | "danger";
  /** Sentido da seta (subiu/caiu), independente do tom. */
  direction: "up" | "down";
}

interface KpiCardProps {
  label: string;
  value: string;
  delta?: KpiDelta;
  /** Legenda da comparação (ex.: "vs. 30 dias anteriores"). */
  compare?: string;
  icon?: LucideIcon;
}

/** Card de indicador: rótulo em caption, valor em title-1 tabular, variação em badge com seta. */
export function KpiCard({ label, value, delta, compare, icon: Icon }: KpiCardProps) {
  const Arrow = delta?.direction === "down" ? ArrowDownRight : ArrowUpRight;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="text-caption text-foreground-secondary">{label}</p>
        {Icon ? (
          <Icon className="size-5 shrink-0 text-foreground-muted" strokeWidth={1.75} aria-hidden />
        ) : null}
      </div>
      <p className="text-title-1 text-foreground tabular-nums">{value}</p>
      {delta ? (
        <div className="flex flex-col items-start gap-1">
          <Badge variant={delta.tone} className="tabular-nums">
            <Arrow strokeWidth={2} aria-hidden />
            {delta.value}
          </Badge>
          {compare ? <span className="text-caption text-foreground-muted">{compare}</span> : null}
        </div>
      ) : null}
    </li>
  );
}

export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("grid grid-cols-2 gap-4 lg:grid-cols-4", className)}>{children}</ul>;
}

/* ------------------------------------------------------------------ */
/* Ferramentas de lista                                                 */
/* ------------------------------------------------------------------ */

interface SearchInputProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Input de busca com ícone à esquerda (label só para leitores de tela). */
export function SearchInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-foreground-secondary"
        strokeWidth={1.75}
        aria-hidden
      />
      <Input
        id={id}
        type="search"
        placeholder={placeholder ?? label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-12"
        autoComplete="off"
      />
    </div>
  );
}

interface FilterSelectProps<T extends string> {
  id: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: Record<T, string>;
  className?: string;
}

/** Select de filtro (48 px) com rótulo só para leitores de tela. */
export function FilterSelect<T extends string>({
  id,
  label,
  value,
  onChange,
  items,
  className,
}: FilterSelectProps<T>) {
  return (
    <div className={cn("flex flex-col", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select value={value} onValueChange={(v) => onChange(v as T)} items={items}>
        <SelectTrigger id={id} className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(items) as Array<[T, string]>).map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Barra de ferramentas da lista: busca (cresce), filtros e ação principal à direita.
 * Empilha no mobile; em `sm+` vira uma linha.
 */
export function PanelToolbar({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      {children}
      {action ? (
        <div className="flex sm:ml-auto [&>*]:flex-1 sm:[&>*]:flex-none">{action}</div>
      ) : null}
    </div>
  );
}

/** Card sem padding para envolver tabelas e listas `divide-y`. */
export function PanelCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface shadow-xs",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Filtra registros por texto em qualquer um dos campos informados (case/acento-insensível). */
export function matchesQuery(query: string, ...fields: Array<string | number>): boolean {
  const q = normalize(query);
  if (!q) return true;
  return fields.some((f) => normalize(String(f)).includes(q));
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
