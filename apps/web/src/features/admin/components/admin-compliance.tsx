"use client";

import type {
  AdminProductListItemDto,
  AdminSellerDetailDto,
  AdminShipmentListItemDto,
  ComplianceBand,
  ComplianceIndicator,
  ComplianceOccurrenceDto,
  IntegrationStatusDto,
  OccurrenceSource,
  OccurrenceStatus,
  ProductReportDto,
  ProductReportStatus,
  ShipmentStatus,
} from "@marketplace/contracts";
import {
  BadgeCheck,
  Building2,
  Clock,
  Coins,
  ExternalLink,
  FileDown,
  FileSearch,
  Flag,
  KeyRound,
  Landmark,
  PackageSearch,
  Plus,
  RotateCw,
  ShieldAlert,
  Store,
  Truck,
  UserCheck,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { FormField } from "@/components/shared/form-field";
import { FilterSelect, PanelCard, PanelToolbar, SearchInput } from "@/components/shared/panel-widgets";
import { EmptyState, ErrorState, SectionHeader } from "@/components/shared/states";
import { ComplianceMedal, RemessaConformeEmblem } from "@/components/shared/trust-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { Link } from "@/i18n/navigation";
import { downloadAuthenticated } from "@/lib/api/download";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

import { moderationKey } from "../../seller-panel/moderation";
import { useAdminSellers } from "../api";
import {
  useComplianceDashboard,
  useComplianceMutations,
  useIntegrations,
  useOccurrences,
  useReports,
  useShipments,
} from "../api/compliance";
import { DetailSheet, KeyValueList, Pager, SheetSection, brl, useAdminErrorToast } from "./admin-widgets";

const INDICATORS: ComplianceIndicator[] = ["Contrafacao", "Subvaloracao", "QualidadeDeclaracao"];
const SOURCES: OccurrenceSource[] = ["Despacho", "Siscomex", "Ouvidoria", "Denuncia", "Interna"];

/** "julho de 2026" → "Julho de 2026" (o `capitalize` do CSS poria "De" em maiúscula). */
const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Percentual com duas casas a partir de centésimos de % (9970 → 99,70%). */
function usePermyriad() {
  const format = useFormatter();
  return (permyriad: number) =>
    format.number(permyriad / 10_000, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Faixa do indicador: medalha para Ouro/Prata/Bronze, alerta para advertência e exclusão. */
export function BandBadge({ band }: { band: ComplianceBand }) {
  const t = useTranslations("admin");
  if (band === "Ouro" || band === "Prata" || band === "Bronze")
    return (
      <span className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-foreground">
        <ComplianceMedal tier={band.toLowerCase() as "ouro" | "prata" | "bronze"} className="h-6 w-5" />
        {t(`band.${band}`)}
      </span>
    );
  return <Badge variant={band === "Advertencia" ? "warning" : "danger"}>{t(`band.${band}`)}</Badge>;
}

const BAND_DOT: Record<ComplianceBand, string> = {
  Ouro: "bg-selo-ouro",
  Prata: "bg-selo-prata",
  Bronze: "bg-selo-bronze",
  Advertencia: "bg-warning",
  Exclusao: "bg-danger",
};

/* ------------------------------------------------------------------ */
/* Conformidade: indicadores, ocorrências e reincidência                */
/* ------------------------------------------------------------------ */

export function AdminCompliance() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const pct = usePermyriad();
  const now = new Date();
  const currentCycle = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const [cycle, setCycle] = useState(String(currentCycle));
  const dashboard = useComplianceDashboard(Number(cycle));
  const d = dashboard.data;
  const cycles = Object.fromEntries(
    [currentCycle, currentCycle - 1].map((y) => [String(y), t("cycleLabel", { start: y, end: y + 1 })]),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PanelTitle>{t("compliance")}</PanelTitle>
        <p className="-mt-2 max-w-3xl text-body-sm text-foreground-secondary">{t("complianceIntro")}</p>
      </div>

      <PanelToolbar>
        <FilterSelect id="compliance-cycle" label={t("cycle")} value={cycle} onChange={setCycle} items={cycles} className="sm:w-80" />
      </PanelToolbar>

      {dashboard.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
      ) : d ? (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            {d.cycleIndicators.map((i) => (
              <div key={i.indicator} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-body-sm font-medium text-foreground-secondary">{t(`indicator.${i.indicator}`)}</span>
                    <span className="text-caption text-foreground-muted">{t(`indicatorHint.${i.indicator}`)}</span>
                  </div>
                  <BandBadge band={i.band} />
                </div>
                <span className="text-display text-foreground tabular-nums">{pct(i.compliancePermyriad)}</span>
                <span className="text-caption text-foreground-secondary tabular-nums">
                  {t("indicatorCount", { occurrences: i.occurrences, shipments: format.number(d.cycleShipments) })}
                </span>
                <p className="border-t border-border pt-3 text-body-sm text-foreground">{i.consequence}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs">
              <div className="flex items-center gap-3">
                <RemessaConformeEmblem className="size-10" />
                <div className="flex flex-col">
                  <span className="text-body font-semibold text-foreground">{t("sealEligibilityTitle")}</span>
                  <span className="text-caption text-foreground-secondary">{t("sealEligibilityHint")}</span>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-brand-verde"
                  style={{ width: `${Math.min(100, (d.cycleShipments / d.sealMinimumShipments) * 100)}%` }}
                />
              </div>
              <span className="text-body-sm text-foreground tabular-nums">
                {t("sealEligibilityCount", { count: format.number(d.cycleShipments), min: format.number(d.sealMinimumShipments) })}
              </span>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-5 shadow-xs">
              <QueueLink href="/admin/denuncias" icon={Flag} label={t("queueReports")} count={d.openReports} />
              <QueueLink href="/admin/produtos" icon={PackageSearch} label={t("queueProducts")} count={d.productsInReview} />
              <QueueLink href="/admin/vendedores" icon={UserCheck} label={t("queueSellers")} count={d.pendingSellerVerifications} />
            </div>
          </section>

          <section>
            <SectionHeader title={t("monthlyTitle")} />
            <PanelCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colMonth")}</TableHead>
                    <TableHead className="text-right">{t("colShipments")}</TableHead>
                    {INDICATORS.map((i) => (
                      <TableHead key={i} className="text-right">
                        {t(`indicator.${i}`)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.months.map((m) => (
                    <TableRow key={`${m.year}-${m.month}`}>
                      <TableCell className="font-medium">
                        {upperFirst(format.dateTime(new Date(Date.UTC(m.year, m.month - 1, 15)), { month: "long", year: "numeric" }))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{format.number(m.shipments)}</TableCell>
                      {m.indicators.map((i) => (
                        <TableCell key={i.indicator} className="text-right tabular-nums">
                          <span className="inline-flex items-center gap-2">
                            {i.occurrences > 0 ? <span className="text-caption text-foreground-muted">({i.occurrences})</span> : null}
                            {pct(i.compliancePermyriad)}
                            <span aria-hidden className={cn("size-2.5 rounded-full", BAND_DOT[i.band])} />
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </PanelCard>
            <p className="mt-2 text-caption text-foreground-muted">{t("monthlyHint")}</p>
          </section>

          <section>
            <SectionHeader title={t("sellersAtRisk")} />
            <p className="-mt-2 mb-3 text-body-sm text-foreground-secondary">
              {t("strikeRule", { limit: d.strikeLimit, days: d.strikeWindowDays })}
            </p>
            {d.sellersAtRisk.length === 0 ? (
              <p className="text-body-sm text-foreground-secondary">{t("noSellersAtRisk")}</p>
            ) : (
              <PanelCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("colSeller")}</TableHead>
                      <TableHead className="text-right">{t("colOccurrences")}</TableHead>
                      <TableHead className="text-right">{t("colOpenReports")}</TableHead>
                      <TableHead>{t("colStatus")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.sellersAtRisk.map((s) => (
                      <TableRow key={s.sellerId}>
                        <TableCell className="font-medium">
                          <Link className="text-primary" href={`/admin/vendedores?q=${encodeURIComponent(s.sellerName)}`}>
                            {s.sellerName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.occurrences} / {d.strikeLimit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{s.openReports}</TableCell>
                        <TableCell>
                          <Badge variant={s.status === "Suspenso" ? "danger" : s.status === "Pendente" ? "warning" : "success"}>
                            {t(`sellerStatus.${s.status}`)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </PanelCard>
            )}
          </section>
        </>
      ) : null}

      <OccurrencesSection />
    </div>
  );
}

function QueueLink({ href, icon: Icon, label, count }: { href: string; icon: typeof Flag; label: string; count: number }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface-muted focus-ring">
      <span className="flex items-center gap-2 text-body-sm text-foreground">
        <Icon className="size-4 text-foreground-secondary" strokeWidth={1.75} aria-hidden />
        {label}
      </span>
      <Badge variant={count > 0 ? "warning" : "neutral"}>{count}</Badge>
    </Link>
  );
}

function OccurrencesSection() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const [indicator, setIndicator] = useState<"all" | ComplianceIndicator>("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ComplianceOccurrenceDto | null>(null);
  const list = useOccurrences({ indicator: indicator === "all" ? undefined : indicator, page, pageSize: 20 });
  const items = { all: t("allIndicators"), ...Object.fromEntries(INDICATORS.map((i) => [i, t(`indicator.${i}`)])) } as Record<
    "all" | ComplianceIndicator,
    string
  >;

  return (
    <section>
      <SectionHeader title={t("occurrences")} />
      <PanelToolbar
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" strokeWidth={1.75} /> {t("registerOccurrence")}
          </Button>
        }
      >
        <FilterSelect
          id="occurrences-indicator"
          label={t("indicatorFilter")}
          value={indicator}
          onChange={(v) => {
            setIndicator(v);
            setPage(1);
          }}
          items={items}
          className="sm:w-72"
        />
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState illustration="box" title={t("noOccurrences")} description={t("noOccurrencesHint")} />
      ) : (
        <>
          <PanelCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDate")}</TableHead>
                  <TableHead>{t("colIndicator")}</TableHead>
                  <TableHead>{t("colDescription")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colSeller")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("colSource")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-foreground-secondary tabular-nums">
                      {format.dateTime(new Date(o.occurredAt), "short")}
                    </TableCell>
                    <TableCell>{t(`indicator.${o.indicator}`)}</TableCell>
                    <TableCell>
                      <span className="block text-caption font-medium text-foreground-secondary">{o.code}</span>
                      <span className="line-clamp-2 max-w-md text-body-sm">{o.description}</span>
                      {o.orderNumber ? <span className="block text-caption text-foreground-muted">{o.orderNumber}</span> : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{o.sellerName ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{t(`source.${o.source}`)}</TableCell>
                    <TableCell>
                      <Badge variant={o.status === "Confirmada" ? "danger" : o.status === "Contestada" ? "warning" : "neutral"}>
                        {t(`occurrenceStatus.${o.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(o)}>
                        {t("changeStatus")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelCard>
          <Pager page={list.data.page} pageSize={list.data.pageSize} totalCount={list.data.totalCount} onChange={setPage} />
        </>
      )}
      <RegisterOccurrenceSheet open={creating} onClose={() => setCreating(false)} />
      <OccurrenceStatusSheet key={editing?.id ?? "none"} occurrence={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

function RegisterOccurrenceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("admin");
  const { createOccurrence } = useComplianceMutations();
  const onError = useAdminErrorToast();
  const sellers = useAdminSellers({ pageSize: 100 });
  const [indicator, setIndicator] = useState<ComplianceIndicator>("QualidadeDeclaracao");
  const [source, setSource] = useState<OccurrenceSource>("Interna");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const sellerItems = {
    "": t("sellerFromOrder"),
    ...Object.fromEntries((sellers.data?.items ?? []).map((s) => [s.id, s.name])),
  };

  return (
    <DetailSheet open={open} onClose={onClose} title={t("registerOccurrence")} description={t("registerOccurrenceHint")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="occ-indicator" label={t("colIndicator")}>
          <SimpleSelect id="occ-indicator" value={indicator} onChange={(v) => setIndicator(v as ComplianceIndicator)}
            items={Object.fromEntries(INDICATORS.map((i) => [i, t(`indicator.${i}`)]))} />
        </FormField>
        <FormField id="occ-source" label={t("colSource")}>
          <SimpleSelect id="occ-source" value={source} onChange={(v) => setSource(v as OccurrenceSource)}
            items={Object.fromEntries(SOURCES.map((s) => [s, t(`source.${s}`)]))} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="occ-code" label={t("occurrenceCode")} hint={t("occurrenceCodeHint")}>
          <Input id="occ-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CPF_DESTINATARIO" />
        </FormField>
        <FormField id="occ-date" label={t("occurrenceDate")}>
          <Input id="occ-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
      </div>
      <FormField id="occ-desc" label={t("colDescription")}>
        <Textarea id="occ-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="occ-order" label={t("occurrenceOrder")} optional>
          <Input id="occ-order" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="PY-2026-000123" />
        </FormField>
        <FormField id="occ-seller" label={t("colSeller")} optional>
          <SimpleSelect id="occ-seller" value={sellerId} onChange={setSellerId} items={sellerItems} />
        </FormField>
      </div>
      <Button
        variant="primary"
        loading={createOccurrence.isPending}
        onClick={() =>
          createOccurrence.mutate(
            {
              indicator,
              source,
              code,
              description,
              orderNumber: orderNumber || null,
              sellerId: sellerId || null,
              occurredAt: date ? new Date(`${date}T12:00:00Z`).toISOString() : null,
            },
            {
              onSuccess: () => {
                toast.success(t("occurrenceSaved"));
                setCode("");
                setDescription("");
                setOrderNumber("");
                onClose();
              },
              onError,
            },
          )
        }
      >
        {t("registerOccurrence")}
      </Button>
    </DetailSheet>
  );
}

function OccurrenceStatusSheet({ occurrence, onClose }: { occurrence: ComplianceOccurrenceDto | null; onClose: () => void }) {
  const t = useTranslations("admin");
  const { setOccurrenceStatus } = useComplianceMutations();
  const onError = useAdminErrorToast();
  const [status, setStatus] = useState<OccurrenceStatus>(occurrence?.status === "Confirmada" ? "Contestada" : "Confirmada");
  const [reason, setReason] = useState("");
  const statuses: OccurrenceStatus[] = ["Confirmada", "Contestada", "Anulada"];

  return (
    <DetailSheet open={Boolean(occurrence)} onClose={onClose} title={t("changeStatus")} description={occurrence?.description}>
      {occurrence ? (
        <>
          <KeyValueList
            items={[
              { label: t("colIndicator"), value: t(`indicator.${occurrence.indicator}`) },
              { label: t("colSource"), value: t(`source.${occurrence.source}`) },
              { label: t("colSeller"), value: occurrence.sellerName ?? "—" },
              { label: t("colStatus"), value: t(`occurrenceStatus.${occurrence.status}`) },
            ]}
          />
          <p className="rounded-md bg-surface-muted p-3 text-caption text-foreground-secondary">{t("contestRule")}</p>
          <FormField id="occ-status" label={t("colStatus")}>
            <SimpleSelect id="occ-status" value={status} onChange={(v) => setStatus(v as OccurrenceStatus)}
              items={Object.fromEntries(statuses.map((s) => [s, t(`occurrenceStatus.${s}`)]))} />
          </FormField>
          <FormField id="occ-reason" label={t("statusReason")} optional={status === "Confirmada"}>
            <Textarea id="occ-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <Button
            variant="primary"
            loading={setOccurrenceStatus.isPending}
            onClick={() =>
              setOccurrenceStatus.mutate(
                { id: occurrence.id, body: { status, reason: reason || null } },
                { onSuccess: () => { toast.success(t("saved")); onClose(); }, onError },
              )
            }
          >
            {t("saveStatus")}
          </Button>
        </>
      ) : null}
    </DetailSheet>
  );
}

/** Select simples (opções fixas) usado nos formulários das telas de conformidade. */
function SimpleSelect({ id, value, onChange, items }: { id: string; value: string; onChange: (v: string) => void; items: Record<string, string> }) {
  return (
    <Select value={value} onValueChange={(v) => onChange((v as string) ?? "")} items={items}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([key, label]) => (
          <SelectItem key={key || "empty"} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------------------------------------------ */
/* Denúncias                                                            */
/* ------------------------------------------------------------------ */

export function AdminReports() {
  const t = useTranslations("admin");
  const tr = useTranslations("report");
  const format = useFormatter();
  const [status, setStatus] = useState<"all" | ProductReportStatus>("Aberta");
  const [page, setPage] = useState(1);
  const [judging, setJudging] = useState<ProductReportDto | null>(null);
  const list = useReports({ status: status === "all" ? undefined : status, page, pageSize: 20 });
  const statuses: ProductReportStatus[] = ["Aberta", "Procedente", "Improcedente"];
  const items = { all: t("filterAllStatus"), ...Object.fromEntries(statuses.map((s) => [s, t(`reportStatus.${s}`)])) } as Record<
    "all" | ProductReportStatus,
    string
  >;

  return (
    <div>
      <PanelTitle>{t("reports")}</PanelTitle>
      <p className="-mt-2 mb-4 max-w-3xl text-body-sm text-foreground-secondary">{t("reportsIntro")}</p>
      <PanelToolbar>
        <FilterSelect
          id="reports-status"
          label={t("filterStatus")}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          items={items}
          className="sm:w-56"
        />
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState illustration="box" title={t("noReports")} description={t("noReportsHint")} />
      ) : (
        <>
          <PanelCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDate")}</TableHead>
                  <TableHead>{t("colProduct")}</TableHead>
                  <TableHead>{t("colReason")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("colDetails")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-foreground-secondary tabular-nums">{format.dateTime(new Date(r.createdAt), "short")}</TableCell>
                    <TableCell>
                      <span className="block max-w-[260px] truncate font-medium">{r.productName}</span>
                      <span className="block text-caption text-foreground-secondary">{r.sellerName}</span>
                    </TableCell>
                    <TableCell>{tr(`reason.${r.reason}`)}</TableCell>
                    <TableCell className="hidden max-w-sm lg:table-cell">
                      <span className="line-clamp-2 text-body-sm text-foreground-secondary">{r.details || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "Aberta" ? "warning" : r.status === "Procedente" ? "danger" : "neutral"}>
                        {t(`reportStatus.${r.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "Aberta" ? (
                        <Button variant="primary" size="sm" onClick={() => setJudging(r)}>
                          {t("judge")}
                        </Button>
                      ) : (
                        <span className="text-caption text-foreground-muted">{r.resolutionNote ?? ""}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelCard>
          <Pager page={list.data.page} pageSize={list.data.pageSize} totalCount={list.data.totalCount} onChange={setPage} />
        </>
      )}
      <ResolveReportSheet key={judging?.id ?? "none"} report={judging} onClose={() => setJudging(null)} />
    </div>
  );
}

const DEFAULT_INDICATOR: Record<ProductReportDto["reason"], ComplianceIndicator> = {
  Falsificado: "Contrafacao",
  PrecoSuspeito: "Subvaloracao",
  DescricaoIncorreta: "QualidadeDeclaracao",
  ProdutoProibido: "QualidadeDeclaracao",
  Outro: "QualidadeDeclaracao",
};

function ResolveReportSheet({ report, onClose }: { report: ProductReportDto | null; onClose: () => void }) {
  const t = useTranslations("admin");
  const tr = useTranslations("report");
  const { resolveReport } = useComplianceMutations();
  const onError = useAdminErrorToast();
  const [indicator, setIndicator] = useState<ComplianceIndicator>(report ? DEFAULT_INDICATOR[report.reason] : "Contrafacao");
  const [block, setBlock] = useState(report?.reason === "Falsificado" || report?.reason === "ProdutoProibido");
  const [note, setNote] = useState("");

  const resolve = (upheld: boolean) =>
    report &&
    resolveReport.mutate(
      { id: report.id, body: { upheld, indicator: upheld ? indicator : null, blockProduct: upheld && block, note: note || null } },
      { onSuccess: () => { toast.success(upheld ? t("reportUpheld") : t("reportDismissed")); onClose(); }, onError },
    );

  return (
    <DetailSheet open={Boolean(report)} onClose={onClose} title={t("judgeTitle")} description={report?.productName}>
      {report ? (
        <>
          <KeyValueList
            items={[
              { label: t("colSeller"), value: report.sellerName },
              { label: t("colReason"), value: tr(`reason.${report.reason}`) },
              { label: t("reporter"), value: report.reporterEmail ?? "—" },
              {
                label: t("colProduct"),
                value: (
                  <Link className="inline-flex items-center gap-1 text-primary" href={`/produto/${report.productSlug}`} target="_blank">
                    {t("viewInStore")} <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                ),
              },
            ]}
          />
          {report.details ? <p className="rounded-md bg-surface-muted p-3 text-body-sm text-foreground">{report.details}</p> : null}
          <SheetSection title={t("ifUpheld")}>
            <FormField id="report-indicator" label={t("colIndicator")} hint={t("reportIndicatorHint")}>
              <SimpleSelect id="report-indicator" value={indicator} onChange={(v) => setIndicator(v as ComplianceIndicator)}
                items={Object.fromEntries(INDICATORS.map((i) => [i, t(`indicator.${i}`)]))} />
            </FormField>
            <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 text-body-sm">
              <span>{t("blockProduct")}</span>
              <Switch checked={block} onCheckedChange={setBlock} />
            </label>
          </SheetSection>
          <FormField id="report-note" label={t("resolutionNote")} optional>
            <Textarea id="report-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" className="flex-1" loading={resolveReport.isPending} onClick={() => resolve(true)}>
              <ShieldAlert data-icon="inline-start" strokeWidth={1.75} /> {t("uphold")}
            </Button>
            <Button variant="secondary" className="flex-1" disabled={resolveReport.isPending} onClick={() => resolve(false)}>
              {t("dismiss")}
            </Button>
          </div>
        </>
      ) : null}
    </DetailSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Remessas (declaração + etiqueta + repasse)                           */
/* ------------------------------------------------------------------ */

const SHIPMENT_BADGE: Record<ShipmentStatus, "neutral" | "soft" | "success" | "warning" | "danger"> = {
  Pendente: "neutral",
  EtiquetaEmitida: "soft",
  Postada: "success",
  Cancelada: "warning",
  Falhou: "danger",
};

export function AdminShipments() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const onError = useAdminErrorToast();
  const [status, setStatus] = useState<"all" | ShipmentStatus>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(query, 300);
  const list = useShipments({ status: status === "all" ? undefined : status, q: debounced || undefined, page, pageSize: 25 });
  const { retryShipment } = useComplianceMutations();
  const statuses: ShipmentStatus[] = ["EtiquetaEmitida", "Postada", "Falhou", "Cancelada"];
  const items = { all: t("filterAllStatus"), ...Object.fromEntries(statuses.map((s) => [s, t(`shipmentStatus.${s}`)])) } as Record<
    "all" | ShipmentStatus,
    string
  >;

  return (
    <div>
      <PanelTitle>{t("shipments")}</PanelTitle>
      <p className="-mt-2 mb-4 max-w-3xl text-body-sm text-foreground-secondary">{t("shipmentsIntro")}</p>
      <PanelToolbar>
        <SearchInput id="shipments-search" label={t("searchShipments")} value={query} onChange={(v) => { setQuery(v); setPage(1); }} className="sm:w-80" />
        <FilterSelect id="shipments-status" label={t("filterStatus")} value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={items} className="sm:w-56" />
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState illustration="box" title={t("noShipments")} description={t("noShipmentsHint")} />
      ) : (
        <>
          <PanelCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colOrder")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead>{t("colTracking")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colDeclaration")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("colCustoms")}</TableHead>
                  <TableHead className="text-right">{t("colTaxes")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((s) => (
                  <ShipmentRow key={s.id} s={s} format={format} retrying={retryShipment.isPending && retryShipment.variables === s.id}
                    onRetry={() => retryShipment.mutate(s.id, { onSuccess: () => toast.success(t("shipmentRetried")), onError })} />
                ))}
              </TableBody>
            </Table>
          </PanelCard>
          <Pager page={list.data.page} pageSize={list.data.pageSize} totalCount={list.data.totalCount} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function ShipmentRow({
  s,
  format,
  retrying,
  onRetry,
}: {
  s: AdminShipmentListItemDto;
  format: ReturnType<typeof useFormatter>;
  retrying: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("admin");
  const onError = useAdminErrorToast();
  const [downloading, setDownloading] = useState(false);
  return (
    <TableRow>
      <TableCell>
        <span className="block font-medium tabular-nums">{s.orderNumber}</span>
        <span className="block text-caption text-foreground-secondary">
          {s.sellerName} · {format.dateTime(new Date(s.createdAt), "short")}
        </span>
      </TableCell>
      <TableCell>
        <span className="flex flex-col items-start gap-1">
          <Badge variant={SHIPMENT_BADGE[s.status]}>{t(`shipmentStatus.${s.status}`)}</Badge>
          {s.sandbox ? <Badge variant="warning">{t("sandbox")}</Badge> : null}
        </span>
      </TableCell>
      <TableCell className="tabular-nums">{s.trackingCode ?? "—"}</TableCell>
      <TableCell className="hidden md:table-cell">
        <span className="block text-caption text-foreground-secondary tabular-nums">{s.declarationNumber ?? "—"}</span>
        {s.dirNumber ? <span className="block text-caption tabular-nums">DIR {s.dirNumber}</span> : null}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <span className="block text-body-sm">{s.customsStatus ?? t("customsWaiting")}</span>
        {s.remittanceStatus ? (
          <span className="block text-caption text-foreground-secondary">{t("remittance", { status: t(`remittanceStatus.${s.remittanceStatus}`) })}</span>
        ) : null}
      </TableCell>
      <TableCell className="text-right tabular-nums">{brl(s.taxes.amount)}</TableCell>
      <TableCell className="text-right whitespace-nowrap">
        {s.status === "Falhou" ? (
          <Button variant="secondary" size="sm" loading={retrying} onClick={onRetry}>
            <RotateCw data-icon="inline-start" strokeWidth={1.75} /> {t("retry")}
          </Button>
        ) : s.status === "EtiquetaEmitida" || s.status === "Postada" ? (
          <Button
            variant="ghost"
            size="sm"
            loading={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadAuthenticated(`/api/admin/shipments/${s.id}/label`, `etiqueta-${s.orderNumber}.pdf`);
              } catch (e) {
                onError(e);
              } finally {
                setDownloading(false);
              }
            }}
          >
            <FileDown data-icon="inline-start" strokeWidth={1.75} /> {t("label")}
          </Button>
        ) : null}
        {s.lastError ? <span className="mt-1 block max-w-[220px] truncate text-caption text-danger">{s.lastError}</span> : null}
      </TableCell>
    </TableRow>
  );
}

/* ------------------------------------------------------------------ */
/* Integrações (governo e operador)                                     */
/* ------------------------------------------------------------------ */

const INTEGRATION_ICON: Record<IntegrationStatusDto["key"], typeof Landmark> = {
  platform: Building2,
  carrier: Truck,
  siscomex: Landmark,
  serpro: UserCheck,
  ncm: FileSearch,
  ptax: Coins,
};

function modeVariant(i: IntegrationStatusDto): "success" | "soft" | "warning" | "danger" | "neutral" {
  if (i.configured && !i.missing.length) return i.mode === "Validação" ? "soft" : "success";
  if (i.mode === "Sandbox" || i.mode === "Incompleto" || i.mode === "Só dígito verificador" || i.mode === "Carregando") return "warning";
  return "neutral";
}

export function AdminIntegrations() {
  const t = useTranslations("admin");
  const list = useIntegrations();
  const sealMode = env.remessaConformeMode;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PanelTitle>{t("integrations")}</PanelTitle>
        <p className="-mt-2 max-w-3xl text-body-sm text-foreground-secondary">{t("integrationsIntro")}</p>
      </div>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.data.map((i) => {
            const Icon = INTEGRATION_ICON[i.key] ?? KeyRound;
            return (
              <article key={i.key} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h2 className="text-body font-semibold text-foreground">{i.name}</h2>
                    <p className="text-caption text-foreground-secondary">{i.purpose}</p>
                  </div>
                  <Badge variant={modeVariant(i)}>{i.mode}</Badge>
                </div>
                <p className="flex items-center gap-1.5 text-caption text-foreground-secondary">
                  <KeyRound className="size-3.5" aria-hidden />
                  {i.requiresCredential ? t("requiresCredential") : t("publicApi")}
                </p>
                {i.detail ? <p className="text-body-sm text-foreground">{i.detail}</p> : null}
                {i.missing.length ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-caption font-semibold text-foreground-secondary uppercase">{t("missingConfig")}</span>
                    <ul className="flex flex-wrap gap-1.5">
                      {i.missing.map((m) => (
                        <li key={m}>
                          <code className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-caption text-foreground">{m}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-body-sm font-medium text-success">
                    <BadgeCheck className="size-4" strokeWidth={2} aria-hidden /> {t("nothingMissing")}
                  </p>
                )}
              </article>
            );
          })}
          <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <RemessaConformeEmblem className="size-10" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 className="text-body font-semibold text-foreground">{t("sealIntegration")}</h2>
                <p className="text-caption text-foreground-secondary">{t("sealIntegrationHint")}</p>
              </div>
              <Badge variant={sealMode === "certificado" ? "success" : sealMode === "simulacao" ? "warning" : "neutral"}>
                {t(`sealMode.${sealMode}`)}
              </Badge>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {[
                "NEXT_PUBLIC_REMESSA_CONFORME",
                "NEXT_PUBLIC_REMESSA_CONFORME_ADE",
                "NEXT_PUBLIC_REMESSA_CONFORME_SELO",
                "NEXT_PUBLIC_REMESSA_CONFORME_CICLO",
              ].map((m) => (
                <li key={m}>
                  <code className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-caption text-foreground">{m}</code>
                </li>
              ))}
            </ul>
          </article>
        </div>
      )}
      <p className="text-caption text-foreground-muted">{t("integrationsDocs")}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Seções reaproveitadas nas fichas de produto e de loja                 */
/* ------------------------------------------------------------------ */

const BLOCK_REASONS = ["CONTRAFACAO", "PRODUTO_PROIBIDO", "DENUNCIA", "DESCRICAO_ENGANOSA"] as const;

/** Conformidade na ficha do produto: NCM, motivo e as ações aprovar / bloquear / pôr em análise. */
export function ModerationSection({ product, onDone }: { product: AdminProductListItemDto; onDone: () => void }) {
  const t = useTranslations("admin");
  const { moderateProduct } = useComplianceMutations();
  const onError = useAdminErrorToast();
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState<string>(BLOCK_REASONS[0]);
  const [note, setNote] = useState("");
  const run = (action: "aprovar" | "bloquear" | "analisar") =>
    moderateProduct.mutate(
      { id: product.id, body: { action, reason: action === "bloquear" ? reason : null, note: note || null } },
      { onSuccess: () => { toast.success(t(`moderated.${action}`)); onDone(); }, onError },
    );
  const ncm = product.hsCode;

  return (
    <SheetSection title={t("complianceSection")}>
      <KeyValueList
        items={[
          { label: "NCM", value: ncm ? `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6)}` : t("noNcm") },
          { label: t("moderationReasonLabel"), value: product.moderationReason ? t(`moderation.${moderationKey(product.moderationReason)}`) : "—" },
          { label: t("colOpenReports"), value: String(product.openReports ?? 0) },
        ]}
      />
      {blocking ? (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          <FormField id="block-reason" label={t("blockReason")}>
            <SimpleSelect id="block-reason" value={reason} onChange={setReason}
              items={Object.fromEntries(BLOCK_REASONS.map((r) => [r, t(`blockReasons.${r}`)]))} />
          </FormField>
          <FormField id="block-note" label={t("resolutionNote")} optional>
            <Textarea id="block-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" loading={moderateProduct.isPending} onClick={() => run("bloquear")}>
              {t("confirmBlock")}
            </Button>
            <Button variant="secondary" onClick={() => setBlocking(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {product.status === "EmAnalise" || product.status === "Bloqueado" ? (
            <Button variant="primary" size="sm" loading={moderateProduct.isPending} onClick={() => run("aprovar")}>
              <BadgeCheck data-icon="inline-start" strokeWidth={1.75} /> {t("approvePublish")}
            </Button>
          ) : null}
          {product.status !== "Bloqueado" ? (
            <Button variant="secondary" size="sm" className="text-danger" onClick={() => setBlocking(true)}>
              <ShieldAlert data-icon="inline-start" strokeWidth={1.75} /> {t("block")}
            </Button>
          ) : null}
          {product.status === "Ativo" ? (
            <Button variant="ghost" size="sm" disabled={moderateProduct.isPending} onClick={() => run("analisar")}>
              <Clock data-icon="inline-start" strokeWidth={1.75} /> {t("sendToReview")}
            </Button>
          ) : null}
        </div>
      )}
    </SheetSection>
  );
}

/** Verificação de documentos e ocorrências na ficha da loja (política de admissão e de monitoramento). */
export function SellerVerificationSection({ detail }: { detail: AdminSellerDetailDto }) {
  const t = useTranslations("admin");
  const ts = useTranslations("sellerPanel");
  const format = useFormatter();
  const { verifySeller } = useComplianceMutations();
  const onError = useAdminErrorToast();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const v = detail.verification;
  const docType = v?.responsibleDocumentType
    ? { CedulaPy: ts("docCedulaPy"), Cpf: ts("docCpf"), Passaporte: ts("docPassport") }[v.responsibleDocumentType]
    : null;
  const doc = (url: string | null | undefined, label: string): ReactNode =>
    url ? (
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
        {label} <ExternalLink className="size-3.5" aria-hidden />
      </a>
    ) : (
      <span className="text-danger">{t("missingDoc")}</span>
    );

  return (
    <>
      <SheetSection
        title={t("verification")}
        action={
          v?.verifiedAt ? (
            <Badge variant="success">{t("verifiedOn", { date: format.dateTime(new Date(v.verifiedAt), "short") })}</Badge>
          ) : (
            <Badge variant={v?.complete ? "warning" : "danger"}>{v?.complete ? t("verificationWaiting") : t("verificationIncomplete")}</Badge>
          )
        }
      >
        <KeyValueList
          items={[
            { label: t("responsible"), value: v?.responsibleName ?? "—" },
            { label: t("document"), value: v?.responsibleDocumentMasked ? `${docType ?? ""} ${v.responsibleDocumentMasked}` : "—" },
            { label: t("originAddress"), value: v?.legalAddress ?? "—" },
            { label: ts("identityDocument"), value: doc(v?.identityDocumentUrl, t("openFile")) },
            { label: ts("rucCertificate"), value: doc(v?.rucCertificateUrl, t("openFile")) },
          ]}
        />
        {v?.suspensionReason ? (
          <p className="rounded-md bg-danger-soft p-3 text-body-sm text-danger">{v.suspensionReason}</p>
        ) : null}
        {rejecting ? (
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <FormField id="reject-note" label={t("rejectReason")} hint={t("rejectReasonHint")}>
              <Textarea id="reject-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </FormField>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" loading={verifySeller.isPending}
                onClick={() => verifySeller.mutate({ id: detail.summary.id, body: { approve: false, note } }, { onSuccess: () => { toast.success(t("sellerRejected")); setRejecting(false); }, onError })}>
                {t("confirmReject")}
              </Button>
              <Button variant="secondary" onClick={() => setRejecting(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {!v?.verifiedAt ? (
              <Button variant="primary" size="sm" loading={verifySeller.isPending} disabled={!v?.complete}
                onClick={() => verifySeller.mutate({ id: detail.summary.id, body: { approve: true } }, { onSuccess: () => toast.success(t("sellerVerified")), onError })}>
                <BadgeCheck data-icon="inline-start" strokeWidth={1.75} /> {t("approveDocuments")}
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" className="text-danger" onClick={() => setRejecting(true)}>
              {t("rejectDocuments")}
            </Button>
          </div>
        )}
      </SheetSection>

      <SheetSection title={t("occurrences")}>
        {detail.occurrences?.length ? (
          <ul className="divide-y divide-border rounded-md border border-border text-body-sm">
            {detail.occurrences.map((o) => (
              <li key={o.id} className="flex flex-col gap-0.5 px-3 py-2">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t(`indicator.${o.indicator}`)}</span>
                  <span className="text-caption text-foreground-secondary tabular-nums">{format.dateTime(new Date(o.occurredAt), "short")}</span>
                </span>
                <span className="text-caption text-foreground-secondary">{o.description}</span>
                {o.status !== "Confirmada" ? <span className="text-caption text-warning">{t(`occurrenceStatus.${o.status}`)}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-1.5 text-body-sm text-foreground-secondary">
            <Store className="size-4" aria-hidden /> {t("noSellerOccurrences")}
          </p>
        )}
      </SheetSection>
    </>
  );
}
