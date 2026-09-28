"use client";

import type { CouponDto, CurrencyCode } from "@marketplace/contracts";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { FormField } from "@/components/shared/form-field";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PanelCard, PanelToolbar } from "@/components/shared/panel-widgets";
import { formatMoney } from "@/lib/money";

import {
  useAdminCouponMutations,
  useAdminCoupons,
  useAdminRateCreate,
  useAdminRates,
} from "../api";
import { DetailSheet, brl, useAdminErrorToast } from "./admin-widgets";

/* ------------------------------------------------------------------ */
/* Cupons                                                               */
/* ------------------------------------------------------------------ */

interface CouponForm {
  code: string;
  percent: string;
  minSubtotal: number | null;
  expiresAt: string;
  maxUses: string;
  active: boolean;
}

const EMPTY: CouponForm = {
  code: "",
  percent: "10",
  minSubtotal: null,
  expiresAt: "",
  maxUses: "",
  active: true,
};

function fromDto(c: CouponDto): CouponForm {
  return {
    code: c.code,
    percent: String(c.discountBasisPoints / 100),
    minSubtotal: c.minSubtotalAmount,
    expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
    maxUses: c.maxUses ? String(c.maxUses) : "",
    active: c.active,
  };
}

export function AdminCoupons() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const format = useFormatter();
  const list = useAdminCoupons();
  const { save, remove } = useAdminCouponMutations();
  const onError = useAdminErrorToast();
  const [editing, setEditing] = useState<{ id: string | null; form: CouponForm } | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const submit = () => {
    if (!editing) return;
    const f = editing.form;
    setErrors({});
    save.mutate(
      {
        id: editing.id,
        body: {
          code: f.code,
          discountBasisPoints: Math.round(Number(f.percent.replace(",", ".")) * 100),
          minSubtotalAmount: f.minSubtotal,
          expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59Z`).toISOString() : null,
          maxUses: f.maxUses ? Number(f.maxUses) : null,
          active: f.active,
        },
      },
      {
        onSuccess: () => {
          toast.success(t("saved"));
          setEditing(null);
        },
        onError: (e) => {
          if (typeof e === "object" && e && "errors" in e && e.errors)
            setErrors(e.errors as Record<string, string[]>);
          else onError(e);
        },
      },
    );
  };
  const set = (patch: Partial<CouponForm>) =>
    setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  return (
    <div>
      <PanelTitle>{t("coupons")}</PanelTitle>
      <PanelToolbar
        action={
          <Button variant="primary" onClick={() => setEditing({ id: null, form: EMPTY })}>
            <Plus data-icon="inline-start" strokeWidth={1.75} /> {t("newCoupon")}
          </Button>
        }
      >
        <p className="text-body-sm text-foreground-secondary">{t("couponsHint")}</p>
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState illustration="box" title={t("couponsEmpty")} />
      ) : (
        <PanelCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colCode")}</TableHead>
                <TableHead className="text-right">{t("colDiscount")}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t("colUses")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("colExpires")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead className="text-right">{t("colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium tabular-nums">
                    {c.code}
                    {c.minSubtotalAmount ? (
                      <span className="block text-caption text-foreground-secondary">
                        {t("couponMin", { amount: brl(c.minSubtotalAmount) })}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.discountBasisPoints / 100}%
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {c.usedCount}
                    {c.maxUses ? ` / ${c.maxUses}` : ""}
                  </TableCell>
                  <TableCell className="hidden text-foreground-secondary tabular-nums md:table-cell">
                    {c.expiresAt ? format.dateTime(new Date(c.expiresAt), "short") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.active ? "success" : "neutral"}>
                      {c.active ? t("active") : t("inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={tc("edit")}
                      onClick={() => setEditing({ id: c.id, form: fromDto(c) })}
                    >
                      <Pencil strokeWidth={1.75} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={tc("delete")}
                      className="text-danger"
                      loading={remove.isPending && remove.variables === c.id}
                      onClick={() =>
                        remove.mutate(c.id, {
                          onSuccess: () => toast.success(t("couponDeleted")),
                          onError,
                        })
                      }
                    >
                      <Trash2 strokeWidth={1.75} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelCard>
      )}

      <DetailSheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? t("editCoupon") : t("newCoupon")}
      >
        {editing ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            noValidate
          >
            <FormField id="coupon-code" label={t("colCode")} error={errors.code?.[0]}>
              <Input
                id="coupon-code"
                className="uppercase"
                value={editing.form.code}
                onChange={(e) => set({ code: e.target.value.toUpperCase() })}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                id="coupon-percent"
                label={t("colDiscount")}
                error={errors.discountBasisPoints?.[0]}
              >
                <Input
                  id="coupon-percent"
                  inputMode="decimal"
                  className="tabular-nums"
                  value={editing.form.percent}
                  onChange={(e) => set({ percent: e.target.value })}
                />
              </FormField>
              <FormField id="coupon-max" label={t("colUses")} optional error={errors.maxUses?.[0]}>
                <Input
                  id="coupon-max"
                  type="number"
                  min={1}
                  className="tabular-nums"
                  value={editing.form.maxUses}
                  onChange={(e) => set({ maxUses: e.target.value })}
                />
              </FormField>
              <FormField
                id="coupon-min"
                label={t("couponMinLabel")}
                optional
                error={errors.minSubtotalAmount?.[0]}
              >
                <Input
                  id="coupon-min"
                  inputMode="numeric"
                  className="tabular-nums"
                  value={
                    editing.form.minSubtotal === null
                      ? ""
                      : formatMoney({ amount: editing.form.minSubtotal, currency: "BRL" })
                  }
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "").slice(0, 10);
                    set({ minSubtotal: d ? Number(d) : null });
                  }}
                />
              </FormField>
              <FormField id="coupon-exp" label={t("colExpires")} optional>
                <Input
                  id="coupon-exp"
                  type="date"
                  value={editing.form.expiresAt}
                  onChange={(e) => set({ expiresAt: e.target.value })}
                />
              </FormField>
            </div>
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 text-body-sm">
              <span>{t("active")}</span>
              <Switch checked={editing.form.active} onCheckedChange={(v) => set({ active: v })} />
            </label>
            <Button type="submit" variant="primary" loading={save.isPending}>
              {tc("save")}
            </Button>
          </form>
        ) : null}
      </DetailSheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Câmbio                                                               */
/* ------------------------------------------------------------------ */

const CURRENCIES: CurrencyCode[] = ["BRL", "PYG", "USD"];

export function AdminRates() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const list = useAdminRates();
  const create = useAdminRateCreate();
  const onError = useAdminErrorToast();
  const [from, setFrom] = useState<CurrencyCode>("BRL");
  const [to, setTo] = useState<CurrencyCode>("PYG");
  const [rate, setRate] = useState("1389");
  const currencyItems = Object.fromEntries(CURRENCIES.map((c) => [c, c]));

  const submit = () => {
    const value = Number(rate.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(t("rateInvalid"));
      return;
    }
    // Taxa "1 unidade de origem = X de destino" convertida para fração em unidades mínimas.
    const fromMinor = from === "PYG" ? 1 : 100;
    const toMinor = to === "PYG" ? 1 : 100;
    const denominator = 1_000_000;
    const numerator = Math.round((value * toMinor * denominator) / fromMinor);
    create.mutate(
      { from, to, numerator, denominator },
      { onSuccess: (r) => toast.success(t("rateCreated", { rate: r.displayRate })), onError },
    );
  };

  return (
    <div>
      <PanelTitle>{t("rates")}</PanelTitle>
      <section className="mb-6 flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-title-3 text-foreground">{t("newRate")}</h2>
          <p className="text-body-sm text-foreground-secondary">{t("newRateHint")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[8rem_8rem_1fr_auto] sm:items-end">
          <FormField id="rate-from" label={t("rateFrom")}>
            <Select
              value={from}
              onValueChange={(v) => setFrom((v as CurrencyCode) ?? "BRL")}
              items={currencyItems}
            >
              <SelectTrigger id="rate-from" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="rate-to" label={t("rateTo")}>
            <Select
              value={to}
              onValueChange={(v) => setTo((v as CurrencyCode) ?? "PYG")}
              items={currencyItems}
            >
              <SelectTrigger id="rate-to" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="rate-value" label={t("rateValue", { from, to })}>
            <Input
              id="rate-value"
              inputMode="decimal"
              className="tabular-nums"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </FormField>
          <Button variant="primary" loading={create.isPending} onClick={submit}>
            {t("rateSave")}
          </Button>
        </div>
      </section>
      {list.isPending ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <PanelCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colPair")}</TableHead>
                <TableHead>{t("colRate")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("colQuotedAt")}</TableHead>
                <TableHead>{t("colExpires")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.from} → {r.to}
                  </TableCell>
                  <TableCell className="tabular-nums">{r.displayRate}</TableCell>
                  <TableCell className="hidden text-foreground-secondary tabular-nums sm:table-cell">
                    {format.dateTime(new Date(r.quotedAt), "dateTime")}
                  </TableCell>
                  <TableCell className="text-foreground-secondary tabular-nums">
                    {format.dateTime(new Date(r.expiresAt), "short")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelCard>
      )}
    </div>
  );
}
