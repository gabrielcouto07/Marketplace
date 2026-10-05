"use client";

import type { ImportTaxMode, PlatformSettingsDto } from "@marketplace/contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { FormField } from "@/components/shared/form-field";
import { ErrorState } from "@/components/shared/states";
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
import { Textarea } from "@/components/ui/textarea";
import { isApiError } from "@/lib/api/errors";
import { formatMoney } from "@/lib/money";

import { useAdminSettings, useAdminSettingsUpdate } from "../api";
import { useAdminErrorToast } from "./admin-widgets";

type NumericKey = Exclude<
  keyof PlatformSettingsDto,
  | "importTaxMode"
  | "termsVersion"
  | "privacyPolicyVersion"
  | "updatedAt"
  | "icmsStateOverrides"
  | "protectedBrands"
  | "requirePlatformLabel"
>;

const PERCENT_KEYS = [
  "importTaxBasisPoints",
  "icmsBasisPoints",
  "platformFeeBasisPoints",
  "paymentFeeBasisPoints",
] as const;
/** Tributos da reforma (LC 214/2025) e seguro: em pontos-base, exibidos em %. */
const RC_PERCENT_KEYS = [
  "ibsStateBasisPoints",
  "ibsMunicipalBasisPoints",
  "cbsBasisPoints",
  "insuranceBasisPoints",
] as const;
const COMPLIANCE_INT_KEYS: NumericKey[] = ["sellerStrikeLimit", "strikeWindowDays", "priceFloorPercent"];
type PercentKey = (typeof PERCENT_KEYS)[number] | (typeof RC_PERCENT_KEYS)[number];
const DAY_KEYS: NumericKey[] = [
  "quoteLockMinutes",
  "pixExpirationMinutes",
  "boletoDueDays",
  "payoutHoldDays",
  "autoCompleteDays",
];

/** Parâmetros da plataforma (linha única platform_settings): impostos, taxas, prazos e versões dos termos. */
export function AdminSettings() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const settings = useAdminSettings();
  const update = useAdminSettingsUpdate();
  const onError = useAdminErrorToast();
  // Só as edições ficam em estado; o formulário exibido é dado carregado + edições.
  const [edits, setEdits] = useState<Partial<PlatformSettingsDto>>({});
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const form: PlatformSettingsDto | null = settings.data ? { ...settings.data, ...edits } : null;

  if (settings.isPending || !form) return <Skeleton className="h-96 max-w-3xl rounded-lg" />;
  if (settings.isError)
    return <ErrorState error={settings.error} onRetry={() => settings.refetch()} />;

  const set = <K extends keyof PlatformSettingsDto>(key: K, value: PlatformSettingsDto[K]) =>
    setEdits((e) => ({ ...e, [key]: value }));
  const modeItems: Record<ImportTaxMode, string> = {
    Flat: t("taxModeFlat"),
    RemessaConforme: t("taxModeRemessa"),
  };

  const percentField = (key: PercentKey) => (
    <FormField
      key={key}
      id={`set-${key}`}
      label={t(`settings_${key}`)}
      error={errors[key]?.[0]}
      hint={t(`settings_${key}_hint`)}
    >
      <div className="relative">
        <Input
          id={`set-${key}`}
          inputMode="decimal"
          className="pr-10 tabular-nums"
          value={String(form[key] / 100)}
          onChange={(e) =>
            set(key, Math.round(Number(e.target.value.replace(",", ".")) * 100) || 0)
          }
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-body-sm text-foreground-secondary">
          %
        </span>
      </div>
    </FormField>
  );
  const intField = (key: NumericKey) => (
    <FormField key={key} id={`set-${key}`} label={t(`settings_${key}`)} error={errors[key]?.[0]}>
      <Input
        id={`set-${key}`}
        type="number"
        min={0}
        className="tabular-nums"
        value={form[key]}
        onChange={(e) => set(key, Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
      />
    </FormField>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <PanelTitle>{t("settings")}</PanelTitle>
      <form
        noValidate
        className="flex flex-col gap-8"
        onSubmit={(e) => {
          e.preventDefault();
          setErrors({});
          update.mutate(form, {
            onSuccess: () => {
              toast.success(t("settingsSaved"));
              setEdits({});
            },
            onError: (err) => {
              if (isApiError(err) && err.errors) setErrors(err.errors);
              else onError(err);
            },
          });
        }}
      >
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-title-3 text-foreground">{t("settingsTaxes")}</h2>
            <p className="text-body-sm text-foreground-secondary">{t("settingsTaxesHint")}</p>
          </div>
          <FormField
            id="set-mode"
            label={t("settings_importTaxMode")}
            hint={form.importTaxMode === "Flat" ? t("taxModeFlatHint") : t("taxModeRemessaHint")}
          >
            <Select
              value={form.importTaxMode}
              onValueChange={(v) => set("importTaxMode", (v as ImportTaxMode) ?? "Flat")}
              items={modeItems}
            >
              <SelectTrigger id="set-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(modeItems) as ImportTaxMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {modeItems[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">{PERCENT_KEYS.map(percentField)}</div>
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-title-3 text-foreground">{t("settingsRemessa")}</h2>
            <p className="text-body-sm text-foreground-secondary">{t("settingsRemessaHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">{RC_PERCENT_KEYS.map(percentField)}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="set-icmsStates"
              label={t("settings_icmsStateOverrides")}
              hint={t("settings_icmsStateOverrides_hint")}
              error={errors.icmsStateOverrides?.[0]}
            >
              <Input
                id="set-icmsStates"
                placeholder="SP=2000; RJ=2000"
                value={form.icmsStateOverrides}
                onChange={(e) => set("icmsStateOverrides", e.target.value.toUpperCase())}
              />
            </FormField>
            <FormField
              id="set-otherExpenses"
              label={t("settings_otherExpensesAmount")}
              hint={t("settings_otherExpensesAmount_hint")}
              error={errors.otherExpensesAmount?.[0]}
            >
              <Input
                id="set-otherExpenses"
                inputMode="numeric"
                className="tabular-nums"
                value={formatMoney({ amount: form.otherExpensesAmount, currency: "BRL" })}
                onChange={(e) => set("otherExpensesAmount", Number(e.target.value.replace(/\D/g, "").slice(0, 8) || 0))}
              />
            </FormField>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-title-3 text-foreground">{t("settingsCompliance")}</h2>
            <p className="text-body-sm text-foreground-secondary">{t("settingsComplianceHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">{COMPLIANCE_INT_KEYS.map(intField)}</div>
          <FormField
            id="set-brands"
            label={t("settings_protectedBrands")}
            hint={t("settings_protectedBrands_hint")}
            error={errors.protectedBrands?.[0]}
          >
            <Textarea
              id="set-brands"
              rows={3}
              value={form.protectedBrands}
              onChange={(e) => set("protectedBrands", e.target.value)}
            />
          </FormField>
          <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 text-body-sm">
            <span className="flex flex-col">
              <span className="font-medium text-foreground">{t("settings_requirePlatformLabel")}</span>
              <span className="text-caption text-foreground-secondary">{t("settings_requirePlatformLabel_hint")}</span>
            </span>
            <Switch checked={form.requirePlatformLabel} onCheckedChange={(v) => set("requirePlatformLabel", v)} />
          </label>
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
          <h2 className="text-title-3 text-foreground">{t("settingsRules")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="set-freeShipping"
              label={t("settings_freeShippingThresholdAmount")}
              error={errors.freeShippingThresholdAmount?.[0]}
            >
              <Input
                id="set-freeShipping"
                inputMode="numeric"
                className="tabular-nums"
                value={formatMoney({ amount: form.freeShippingThresholdAmount, currency: "BRL" })}
                onChange={(e) =>
                  set(
                    "freeShippingThresholdAmount",
                    Number(e.target.value.replace(/\D/g, "").slice(0, 10) || 0),
                  )
                }
              />
            </FormField>
            {DAY_KEYS.map(intField)}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-xs sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-title-3 text-foreground">{t("settingsLegal")}</h2>
            <p className="text-body-sm text-foreground-secondary">{t("settingsLegalHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="set-terms"
              label={t("settings_termsVersion")}
              error={errors.termsVersion?.[0]}
            >
              <Input
                id="set-terms"
                value={form.termsVersion}
                onChange={(e) => set("termsVersion", e.target.value)}
              />
            </FormField>
            <FormField id="set-privacy" label={t("settings_privacyPolicyVersion")}>
              <Input
                id="set-privacy"
                value={form.privacyPolicyVersion}
                onChange={(e) => set("privacyPolicyVersion", e.target.value)}
              />
            </FormField>
          </div>
        </section>

        <Button
          type="submit"
          variant="primary"
          loading={update.isPending}
          className="w-full sm:w-auto sm:self-start"
        >
          {tc("save")}
        </Button>
      </form>
    </div>
  );
}
