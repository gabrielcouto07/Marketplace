"use client";

import type {
  AlertAttribution,
  ComplianceIndicator,
  ContestationReason,
  EnforcementActionKind,
  InfractionSeverity,
  MonitoringAlertDto,
  MonitoringAlertStatus,
  RfInteractionDto,
  RfInteractionStatus,
  RfInteractionType,
  SellerAuditDto,
  SellerAuditOutcome,
  SellerNoticeDto,
  SellerNoticeStatus,
} from "@marketplace/contracts";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Landmark,
  Play,
  Plus,
  Radar,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { DocumentList } from "@/components/shared/document-upload";
import { FormField } from "@/components/shared/form-field";
import { FilterSelect, PanelCard, PanelToolbar } from "@/components/shared/panel-widgets";
import { EmptyState, ErrorState, SectionHeader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Link, usePathname } from "@/i18n/navigation";
import { documentHref } from "@/lib/api/download";
import { cn } from "@/lib/utils";

import {
  uploadAdminDocument,
  useComplianceProgram,
  useEnforcementActions,
  useMonitoringAlerts,
  useOccurrences,
  useProgramMutations,
  useRfInteractions,
  useSellerAudits,
  useSellerNotices,
  useTrainings,
} from "../api/compliance";
import { NoticeBadge, ResolveNoticeSheet } from "./admin-governance";
import { CONTESTATION_REASONS, DetailSheet, KeyValueList, Pager, SheetSection, useAdminErrorToast } from "./admin-widgets";

const INDICATORS: ComplianceIndicator[] = ["Contrafacao", "Subvaloracao", "QualidadeDeclaracao"];
const RF_TYPES: RfInteractionType[] = [
  "ConsultaMensal",
  "PlanoDeAcao",
  "NotificacaoCorretiva",
  "Ouvidoria",
  "Contestacao",
  "ManifestacaoCiclo",
  "ComunicacaoDeFato",
  "Outro",
];
/** Contestação nasce das ocorrências (indicador, remessas e fundamento); as demais são registradas aqui. */
const RF_CREATE_TYPES: RfInteractionType[] = RF_TYPES.filter((t) => t !== "Contestacao");
const ALERT_STATUSES: MonitoringAlertStatus[] = ["Aberto", "Procedente", "Improcedente"];
const ATTRIBUTIONS: AlertAttribution[] = ["Vendedor", "Comprador", "Plataforma"];
const SEVERITIES: InfractionSeverity[] = ["Leve", "Media", "Grave"];
const NOTICE_STATUSES: SellerNoticeStatus[] = ["Aberta", "Respondida", "Encerrada"];
const ACTION_KINDS: EnforcementActionKind[] = [
  "AnuncioEmAnalise",
  "AnuncioRemovido",
  "AnuncioLiberado",
  "AutenticidadeSolicitada",
  "AutenticidadeComprovada",
  "AutenticidadeNaoComprovada",
  "DenunciaRecebida",
  "DenunciaProcedente",
  "DenunciaImprocedente",
  "InfracaoRegistrada",
  "MedidaAplicada",
  "MedidaRevogada",
  "CadastroRecusado",
  "InformacoesAutoridades",
  "AlertaMonitoramento",
];

function Choice({ id, value, onChange, items }: { id: string; value: string; onChange: (v: string) => void; items: Record<string, string> }) {
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

/** "99,70" → 9970 (centésimos de %); vazio → null. */
function parsePercent(value: string): number | null {
  const n = Number(value.replace(",", "."));
  return value.trim() === "" || Number.isNaN(n) ? null : Math.round(n * 100);
}

/* ------------------------------------------------------------------ */
/* Navegação do Programa                                                */
/* ------------------------------------------------------------------ */

/** Abas das telas do Programa de Conformidade (todas em /admin/conformidade). */
export function ComplianceTabs() {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/conformidade", label: t("programTabOverview") },
    { href: "/admin/conformidade/receita", label: t("programTabReceita") },
    { href: "/admin/conformidade/monitoramento", label: t("programTabMonitoring") },
    { href: "/admin/conformidade/comunicacoes", label: t("programTabNotices") },
    { href: "/admin/conformidade/capacitacao", label: t("programTabTraining") },
    { href: "/admin/conformidade/acoes", label: t("programTabActions") },
    { href: "/admin/conformidade/auditorias", label: t("programTabAudits") },
  ];
  return (
    <nav aria-label={t("program")} className="scrollbar-none -mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-2">
        {tabs.map((tab) => {
          const active = tab.href === "/admin/conformidade" ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="shrink-0">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 pressable items-center rounded-full border px-4 text-body-sm font-medium whitespace-nowrap focus-ring transition-colors",
                  active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-foreground-secondary hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Visão geral do Programa                                              */
/* ------------------------------------------------------------------ */

function StatusLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-body-sm">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2} aria-hidden />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={2} aria-hidden />
      )}
      <span className="text-foreground">{children}</span>
    </li>
  );
}

/**
 * Painel do Programa de Conformidade: responsável e aprovações, situação da operação no PRC, consulta mensal dos
 * indicadores (11.2), janela da manifestação anual (11.8), filas com prazo e as pendências com link para resolver.
 */
export function ProgramOverview() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const program = useComplianceProgram();
  const { runMonitor } = useProgramMutations();
  const onError = useAdminErrorToast();
  const p = program.data;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  if (program.isPending) return <Skeleton className="h-64 rounded-lg" />;
  if (program.isError) return <ErrorState error={program.error} onRetry={() => program.refetch()} />;
  if (!p) return null;

  const queues = [
    { label: t("queueReports"), value: p.openReports, alert: p.overdueReports, href: "/admin/denuncias" },
    { label: t("queueAlerts"), value: p.openAlerts, alert: p.heldShipments, href: "/admin/conformidade/monitoramento" },
    { label: t("queueRf"), value: p.pendingRfInteractions, alert: p.overdueRfInteractions, href: "/admin/conformidade/receita" },
    { label: t("queueNotices"), value: p.openSellerNotices, alert: p.overdueSellerNotices, href: "/admin/conformidade/comunicacoes" },
    { label: t("queueConfirmation"), value: p.sellersDataConfirmationDue, alert: 0, href: "/admin/vendedores" },
    { label: t("queueAdmission"), value: p.sellersMissingAdmissionData, alert: 0, href: "/admin/vendedores" },
    { label: t("queuePolicy"), value: p.sellersPolicyPending, alert: 0, href: "/admin/vendedores" },
    { label: t("queueTraining"), value: p.trainingsDue, alert: 0, href: "/admin/conformidade/capacitacao" },
  ];

  return (
    <section className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs">
          <h2 className="flex items-center gap-2 text-title-3 text-foreground">
            <ShieldCheck className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
            {t("programStatus")}
          </h2>
          <ul className="flex flex-col gap-2">
            <StatusLine ok={Boolean(p.ownerName)}>
              {p.ownerName ? t("programOwner", { name: p.ownerName, email: p.ownerEmail ?? "—" }) : t("programOwnerMissing")}
            </StatusLine>
            <StatusLine ok={Boolean(p.programApprovedAt)}>
              {p.programApprovedAt ? t("programApproved", { date: date(p.programApprovedAt) }) : t("programApprovalMissing")}
            </StatusLine>
            <StatusLine ok={Boolean(p.policyApprovedAt)}>
              {p.policyApprovedAt
                ? t("policyApproved", { version: p.policyVersion, date: date(p.policyApprovedAt) })
                : t("policyApprovalMissing", { version: p.policyVersion })}
            </StatusLine>
            <StatusLine ok={p.cpfVerificationActive}>{p.cpfVerificationActive ? t("cpfActive") : t("cpfInactive")}</StatusLine>
            <StatusLine ok={p.operationStarted}>{p.operationStarted ? t("operationStarted") : t("operationNotStarted")}</StatusLine>
          </ul>
          <Button variant="link" size="sm" className="self-start" render={<Link href="/admin/configuracoes" />}>
            {t("programEditSettings")}
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 shadow-xs">
          <h2 className="flex items-center gap-2 text-title-3 text-foreground">
            <Landmark className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
            {t("programReceita")}
          </h2>
          <ul className="flex flex-col gap-2">
            <StatusLine ok={p.currentMonthReview.done}>
              {p.currentMonthReview.done && p.currentMonthReview.doneAt
                ? t("monthlyDone", {
                    month: `${String(p.currentMonthReview.month).padStart(2, "0")}/${p.currentMonthReview.year}`,
                    date: date(p.currentMonthReview.doneAt),
                    by: p.currentMonthReview.doneBy ?? "—",
                  })
                : t("monthlyPending", { month: `${String(p.currentMonthReview.month).padStart(2, "0")}/${p.currentMonthReview.year}` })}
            </StatusLine>
            <StatusLine ok={p.manifestation.submitted || !p.manifestation.windowOpen}>
              {p.manifestation.submitted
                ? t("manifestationDone", { cycle: `${p.manifestation.cycleStartYear}/${p.manifestation.cycleStartYear + 1}` })
                : p.manifestation.windowOpen
                  ? t("manifestationOpen", {
                      cycle: `${p.manifestation.cycleStartYear}/${p.manifestation.cycleStartYear + 1}`,
                      date: date(p.manifestation.windowEnd),
                    })
                  : t("manifestationWindow", { start: date(p.manifestation.windowStart), end: date(p.manifestation.windowEnd) })}
            </StatusLine>
            <StatusLine ok={p.overdueRfInteractions === 0}>
              {t("rfPending", { count: p.pendingRfInteractions, overdue: p.overdueRfInteractions })}
            </StatusLine>
            <StatusLine ok={p.auditsPlanned > 0}>{t("auditsPlannedCount", { count: p.auditsPlanned })}</StatusLine>
          </ul>
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            loading={runMonitor.isPending}
            onClick={() =>
              runMonitor.mutate(undefined, {
                onSuccess: (r) =>
                  toast.success(
                    t("monitorRan", {
                      alerts: r.newAlerts,
                      listings: r.listingsFlagged,
                      notices: r.noticesCreated,
                      suspended: r.sellersSuspended,
                      lifted: r.suspensionsLifted,
                    }),
                  ),
                onError,
              })
            }
          >
            <Play data-icon="inline-start" strokeWidth={1.75} /> {t("runMonitor")}
          </Button>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {queues.map((q) => (
          <li key={q.label}>
            <Link
              href={q.href}
              className="flex h-full pressable flex-col gap-1 rounded-md border border-border bg-surface px-3 py-2 focus-ring"
            >
              <span className="text-caption text-foreground-secondary">{q.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-title-2 text-foreground tabular-nums">{format.number(q.value)}</span>
                {q.alert > 0 ? <Badge variant="danger">{t("queueAlert", { count: q.alert })}</Badge> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div>
        <SectionHeader title={t("programTasks")} />
        {p.tasks.length === 0 ? (
          <p className="flex items-center gap-2 text-body-sm text-success">
            <BadgeCheck className="size-4" strokeWidth={2} aria-hidden /> {t("programNoTasks")}
          </p>
        ) : (
          <PanelCard>
            <ul className="divide-y divide-border">
              {p.tasks.map((task) => (
                <li key={task.key}>
                  <Link href={task.href} className="flex items-start gap-3 p-4 transition-colors hover:bg-surface-muted focus-ring">
                    <CalendarClock
                      className={cn("mt-0.5 size-5 shrink-0", task.overdue ? "text-danger" : "text-primary")}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-body-sm font-medium text-foreground">{task.title}</span>
                      <span className="text-caption text-foreground-secondary">{task.detail}</span>
                    </span>
                    {task.dueAt ? (
                      <Badge variant={task.overdue ? "danger" : "neutral"}>
                        {task.overdue ? t("overdue") : t("dueOn", { date: format.dateTime(new Date(task.dueAt), "short") })}
                      </Badge>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </PanelCard>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Receita Federal                                                      */
/* ------------------------------------------------------------------ */

/**
 * Relacionamento com a Receita Federal (Programa 3, 11 e 12): consulta mensal dos indicadores, plano de ação (30 dias),
 * notificação corretiva (30 dias), ouvidoria (prazo da Receita ou 5 dias úteis), contestação, manifestação anual e
 * comunicação de fatos.
 */
export function AdminReceita() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const [type, setType] = useState<"all" | RfInteractionType>("all");
  const [status, setStatus] = useState<"all" | RfInteractionStatus>("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [contesting, setContesting] = useState(false);
  const [open, setOpen] = useState<RfInteractionDto | null>(null);
  const list = useRfInteractions({
    type: type === "all" ? undefined : type,
    status: status === "all" ? undefined : status,
    page,
    pageSize: 20,
  });
  const typeItems = { all: t("allTypes"), ...Object.fromEntries(RF_TYPES.map((x) => [x, t(`rfType.${x}`)])) } as Record<"all" | RfInteractionType, string>;
  const statusItems = { all: t("filterAllStatus"), Pendente: t("rfStatus.Pendente"), Concluida: t("rfStatus.Concluida") } as Record<
    "all" | RfInteractionStatus,
    string
  >;

  return (
    <div>
      <PanelTitle>{t("compliance")}</PanelTitle>
      <ComplianceTabs />
      <p className="-mt-2 mb-4 max-w-3xl text-body-sm text-foreground-secondary">{t("receitaIntro")}</p>
      <PanelToolbar
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setContesting(true)}>
              {t("contestIndicator")}
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus data-icon="inline-start" strokeWidth={1.75} /> {t("registerRf")}
            </Button>
          </div>
        }
      >
        <FilterSelect id="rf-type" label={t("filterType")} value={type} onChange={(v) => { setType(v); setPage(1); }} items={typeItems} className="sm:w-64" />
        <FilterSelect id="rf-status" label={t("filterStatus")} value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={statusItems} className="sm:w-48" />
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState illustration="box" title={t("noRf")} description={t("noRfHint")} />
      ) : (
        <>
          <PanelCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDate")}</TableHead>
                  <TableHead>{t("colSubject")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colDue")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => setOpen(r)}>
                    <TableCell className="text-foreground-secondary tabular-nums">{format.dateTime(new Date(r.openedAt), "short")}</TableCell>
                    <TableCell>
                      <button type="button" className="block text-left font-medium focus-ring">
                        {r.title}
                      </button>
                      <span className="block text-caption text-foreground-secondary">
                        {t(`rfType.${r.type}`)}
                        {r.reference ? ` · ${r.reference}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="hidden tabular-nums md:table-cell">
                      {r.dueAt ? (
                        <span className={cn(r.overdue && "font-semibold text-danger")}>{format.dateTime(new Date(r.dueAt), "short")}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "Concluida" ? "success" : r.overdue ? "danger" : "warning"}>
                        {r.status === "Pendente" && r.overdue ? t("overdue") : t(`rfStatus.${r.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelCard>
          <Pager page={list.data.page} pageSize={list.data.pageSize} totalCount={list.data.totalCount} onChange={setPage} />
        </>
      )}
      <RfCreateSheet open={creating} onClose={() => setCreating(false)} />
      <ContestSheet open={contesting} onClose={() => setContesting(false)} />
      <RfDetailSheet key={open?.id ?? "none"} interaction={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function RfCreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("admin");
  const onError = useAdminErrorToast();
  const { createRfInteraction } = useProgramMutations();
  const now = new Date();
  const [type, setType] = useState<RfInteractionType>("ConsultaMensal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [openedAt, setOpenedAt] = useState(now.toISOString().slice(0, 10));
  const [dueAt, setDueAt] = useState("");
  const [indicator, setIndicator] = useState<ComplianceIndicator>("QualidadeDeclaracao");
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [counterfeit, setCounterfeit] = useState("");
  const [undervaluation, setUndervaluation] = useState("");
  const [quality, setQuality] = useState("");
  const [files, setFiles] = useState<Array<{ key: string; url: string; name: string }>>([]);
  const [year, mon] = month.split("-").map(Number);

  return (
    <DetailSheet open={open} onClose={onClose} title={t("registerRf")} description={t(`rfTypeHint.${type}`)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="rf-new-type" label={t("colType")}>
          <Choice id="rf-new-type" value={type} onChange={(v) => setType(v as RfInteractionType)}
            items={Object.fromEntries(RF_CREATE_TYPES.map((x) => [x, t(`rfType.${x}`)]))} />
        </FormField>
        <FormField id="rf-new-opened" label={t("rfOpenedAt")}>
          <Input id="rf-new-opened" type="date" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} />
        </FormField>
      </div>
      {type === "ConsultaMensal" ? (
        <>
          <FormField id="rf-new-month" label={t("rfMonth")}>
            <Input id="rf-new-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="rf-off-cf" label={t("indicator.Contrafacao")} optional hint={t("percentHint")}>
              <Input id="rf-off-cf" inputMode="decimal" value={counterfeit} onChange={(e) => setCounterfeit(e.target.value)} placeholder="99,80" />
            </FormField>
            <FormField id="rf-off-sv" label={t("indicator.Subvaloracao")} optional hint={t("percentHint")}>
              <Input id="rf-off-sv" inputMode="decimal" value={undervaluation} onChange={(e) => setUndervaluation(e.target.value)} placeholder="99,70" />
            </FormField>
            <FormField id="rf-off-qd" label={t("indicator.QualidadeDeclaracao")} optional hint={t("percentHint")}>
              <Input id="rf-off-qd" inputMode="decimal" value={quality} onChange={(e) => setQuality(e.target.value)} placeholder="99,50" />
            </FormField>
          </div>
        </>
      ) : null}
      {type === "PlanoDeAcao" ? (
        <FormField id="rf-new-indicator" label={t("colIndicator")}>
          <Choice id="rf-new-indicator" value={indicator} onChange={(v) => setIndicator(v as ComplianceIndicator)}
            items={Object.fromEntries(INDICATORS.map((i) => [i, t(`indicator.${i}`)]))} />
        </FormField>
      ) : null}
      {type === "Outro" ? (
        <FormField id="rf-new-title" label={t("colSubject")}>
          <Input id="rf-new-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
      ) : null}
      {type === "Ouvidoria" || type === "Outro" ? (
        <FormField id="rf-new-due" label={t("colDue")} optional hint={type === "Ouvidoria" ? t("ombudsmanDueHint") : undefined}>
          <Input id="rf-new-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </FormField>
      ) : null}
      <FormField id="rf-new-description" label={t("colDescription")} optional={type === "ConsultaMensal" || type === "PlanoDeAcao" || type === "ManifestacaoCiclo"}>
        <Textarea id="rf-new-description" rows={4} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>
      <FormField id="rf-new-reference" label={t("rfReference")} optional hint={t("rfReferenceHint")}>
        <Input id="rf-new-reference" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
      </FormField>
      <FormField id="rf-new-files" label={t("attachments")} optional>
        <DocumentList values={files} onChange={setFiles} upload={uploadAdminDocument} label={t("attachments")} />
      </FormField>
      <Button
        variant="primary"
        loading={createRfInteraction.isPending}
        onClick={() =>
          createRfInteraction.mutate(
            {
              type,
              title: title || null,
              description: description || null,
              reference: reference || null,
              openedAt: openedAt ? new Date(`${openedAt}T12:00:00Z`).toISOString() : null,
              dueAt: dueAt ? new Date(`${dueAt}T23:59:00Z`).toISOString() : null,
              indicator: type === "PlanoDeAcao" ? indicator : null,
              year: type === "ConsultaMensal" ? year : null,
              month: type === "ConsultaMensal" ? mon : null,
              officialCounterfeitPermyriad: type === "ConsultaMensal" ? parsePercent(counterfeit) : null,
              officialUndervaluationPermyriad: type === "ConsultaMensal" ? parsePercent(undervaluation) : null,
              officialDeclarationQualityPermyriad: type === "ConsultaMensal" ? parsePercent(quality) : null,
              attachments: files.map((f) => f.key),
            },
            {
              onSuccess: () => {
                toast.success(t("rfSaved"));
                setDescription("");
                setReference("");
                setTitle("");
                setFiles([]);
                onClose();
              },
              onError,
            },
          )
        }
      >
        {t("registerRf")}
      </Button>
    </DetailSheet>
  );
}

/** Contestação de indicador (11.6 e 11.7): indicador, remessas contestadas, fundamento, fundamentação e evidências. */
function ContestSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("admin");
  const format = useFormatter();
  const onError = useAdminErrorToast();
  const { contest } = useProgramMutations();
  const [indicator, setIndicator] = useState<ComplianceIndicator>("QualidadeDeclaracao");
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState<ContestationReason>("ErroMaterial");
  const [grounds, setGrounds] = useState("");
  const [reference, setReference] = useState("");
  const [files, setFiles] = useState<Array<{ key: string; url: string; name: string }>>([]);
  const occurrences = useOccurrences({ indicator, status: "Confirmada", pageSize: 100 });

  return (
    <DetailSheet open={open} onClose={onClose} title={t("contestIndicator")} description={t("contestRule")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contest-indicator" label={t("colIndicator")}>
          <Choice id="contest-indicator" value={indicator} onChange={(v) => { setIndicator(v as ComplianceIndicator); setSelected([]); }}
            items={Object.fromEntries(INDICATORS.map((i) => [i, t(`indicator.${i}`)]))} />
        </FormField>
        <FormField id="contest-reason" label={t("contestationGround")}>
          <Choice id="contest-reason" value={reason} onChange={(v) => setReason(v as ContestationReason)}
            items={Object.fromEntries(CONTESTATION_REASONS.map((r) => [r, t(`contestationReason.${r}`)]))} />
        </FormField>
      </div>
      <SheetSection title={t("contestShipments")}>
        {occurrences.isPending ? (
          <Skeleton className="h-24" />
        ) : (occurrences.data?.items.length ?? 0) === 0 ? (
          <p className="text-body-sm text-foreground-secondary">{t("noConfirmedOccurrences")}</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
            {occurrences.data!.items.map((o) => (
              <li key={o.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-sm p-2 text-body-sm hover:bg-surface-muted">
                  <Checkbox
                    className="mt-0.5"
                    checked={selected.includes(o.id)}
                    onCheckedChange={(next) => setSelected((list) => (next === true ? [...list, o.id] : list.filter((x) => x !== o.id)))}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">
                      {o.orderNumber ?? o.code} · {format.dateTime(new Date(o.occurredAt), "short")}
                    </span>
                    <span className="truncate text-caption text-foreground-secondary">{o.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </SheetSection>
      <FormField id="contest-grounds" label={t("contestationGrounds")} hint={t("contestationGroundsHint")}>
        <Textarea id="contest-grounds" rows={4} maxLength={2000} value={grounds} onChange={(e) => setGrounds(e.target.value)} />
      </FormField>
      <FormField id="contest-reference" label={t("contestationReference")} optional>
        <Input id="contest-reference" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} />
      </FormField>
      <FormField id="contest-files" label={t("contestationEvidence")} optional hint={t("contestationEvidenceHint")}>
        <DocumentList values={files} onChange={setFiles} upload={uploadAdminDocument} label={t("contestationEvidence")} />
      </FormField>
      <Button
        variant="primary"
        disabled={selected.length === 0 || grounds.trim().length < 20}
        loading={contest.isPending}
        onClick={() =>
          contest.mutate(
            { indicator, occurrenceIds: selected, reason, grounds: grounds.trim(), evidence: files.map((f) => f.key), reference: reference || null },
            {
              onSuccess: () => {
                toast.success(t("contestationSaved"));
                setSelected([]);
                setGrounds("");
                setFiles([]);
                onClose();
              },
              onError,
            },
          )
        }
      >
        {t("contest")}
      </Button>
    </DetailSheet>
  );
}

function RfDetailSheet({ interaction, onClose }: { interaction: RfInteractionDto | null; onClose: () => void }) {
  const t = useTranslations("admin");
  const format = useFormatter();
  const onError = useAdminErrorToast();
  const { completeRfInteraction } = useProgramMutations();
  const [response, setResponse] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [files, setFiles] = useState<Array<{ key: string; url: string; name: string }>>([]);
  const r = interaction;
  const pct = (v: number | null) =>
    v === null ? "—" : format.number(v / 10_000, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <DetailSheet open={Boolean(r)} onClose={onClose} title={r?.title ?? ""} description={r ? t(`rfType.${r.type}`) : undefined}>
      {r ? (
        <>
          <KeyValueList
            items={[
              { label: t("rfOpenedAt"), value: format.dateTime(new Date(r.openedAt), "short") },
              { label: t("colDue"), value: r.dueAt ? format.dateTime(new Date(r.dueAt), "short") : "—" },
              { label: t("colStatus"), value: t(`rfStatus.${r.status}`) },
              { label: t("rfReference"), value: r.reference ?? "—" },
              ...(r.indicator ? [{ label: t("colIndicator"), value: t(`indicator.${r.indicator}`) }] : []),
              ...(r.contestationReason ? [{ label: t("contestationGround"), value: t(`contestationReason.${r.contestationReason}`) }] : []),
              ...(r.type === "ConsultaMensal"
                ? [
                    { label: t("indicator.Contrafacao"), value: pct(r.officialCounterfeitPermyriad) },
                    { label: t("indicator.Subvaloracao"), value: pct(r.officialUndervaluationPermyriad) },
                    { label: t("indicator.QualidadeDeclaracao"), value: pct(r.officialDeclarationQualityPermyriad) },
                  ]
                : []),
              { label: t("createdBy"), value: r.createdBy ?? "—" },
            ]}
          />
          {r.description ? <p className="rounded-md bg-surface-muted p-3 text-body-sm whitespace-pre-line text-foreground">{r.description}</p> : null}
          {r.attachments.length ? (
            <ul className="flex flex-col gap-1">
              {r.attachments.map((f) => (
                <li key={f.key}>
                  <a href={documentHref(f.url)} target="_blank" rel="noopener noreferrer" className="text-body-sm text-primary underline-offset-2 hover:underline">
                    {f.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {r.response ? (
            <SheetSection title={t("rfResponse")}>
              <p className="text-body-sm whitespace-pre-line text-foreground">{r.response}</p>
              {r.completedAt ? (
                <span className="text-caption text-foreground-secondary">
                  {format.dateTime(new Date(r.completedAt), "short")} · {r.completedBy ?? "—"}
                </span>
              ) : null}
            </SheetSection>
          ) : null}
          {r.status === "Pendente" ? (
            <SheetSection title={t("rfComplete")}>
              {r.type === "Contestacao" ? (
                <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 text-body-sm">
                  <span>{t("contestationAccepted")}</span>
                  <Switch checked={accepted} onCheckedChange={setAccepted} />
                </label>
              ) : null}
              <FormField id="rf-response" label={t("rfResponse")} hint={t(`rfResponseHint.${r.type}`)}>
                <Textarea id="rf-response" rows={4} maxLength={4000} value={response} onChange={(e) => setResponse(e.target.value)} />
              </FormField>
              <DocumentList values={files} onChange={setFiles} upload={uploadAdminDocument} label={t("attachments")} />
              <Button
                variant="primary"
                loading={completeRfInteraction.isPending}
                disabled={response.trim().length < 5}
                onClick={() =>
                  completeRfInteraction.mutate(
                    {
                      id: r.id,
                      body: {
                        response: response.trim(),
                        attachments: files.map((f) => f.key),
                        contestationAccepted: r.type === "Contestacao" ? accepted : null,
                      },
                    },
                    { onSuccess: () => { toast.success(t("rfCompleted")); onClose(); }, onError },
                  )
                }
              >
                {t("rfComplete")}
              </Button>
            </SheetSection>
          ) : null}
        </>
      ) : null}
    </DetailSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Monitoramento                                                        */
/* ------------------------------------------------------------------ */

/**
 * Alertas do monitoramento (Programa 6; Política 7.3): fracionamento, aumento abrupto, concentração por destinatário,
 * preço muito abaixo, divergência reiterada, valor declarado e remetente. Fracionamento da mesma loja retém a etiqueta
 * até o julgamento; procedente e atribuído ao vendedor registra a infração (6.5).
 */
export function AdminMonitoring() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const onError = useAdminErrorToast();
  const { runMonitor } = useProgramMutations();
  const [status, setStatus] = useState<"all" | MonitoringAlertStatus>("Aberto");
  const [page, setPage] = useState(1);
  const [judging, setJudging] = useState<MonitoringAlertDto | null>(null);
  const list = useMonitoringAlerts({ status: status === "all" ? undefined : status, page, pageSize: 20 });
  const items = { all: t("filterAllStatus"), ...Object.fromEntries(ALERT_STATUSES.map((s) => [s, t(`alertStatus.${s}`)])) } as Record<
    "all" | MonitoringAlertStatus,
    string
  >;

  return (
    <div>
      <PanelTitle>{t("compliance")}</PanelTitle>
      <ComplianceTabs />
      <p className="-mt-2 mb-4 max-w-3xl text-body-sm text-foreground-secondary">{t("monitoringIntro")}</p>
      <PanelToolbar
        action={
          <Button
            variant="secondary"
            loading={runMonitor.isPending}
            onClick={() =>
              runMonitor.mutate(undefined, {
                onSuccess: (r) =>
                  toast.success(
                    t("monitorRan", {
                      alerts: r.newAlerts,
                      listings: r.listingsFlagged,
                      notices: r.noticesCreated,
                      suspended: r.sellersSuspended,
                      lifted: r.suspensionsLifted,
                    }),
                  ),
                onError,
              })
            }
          >
            <Radar data-icon="inline-start" strokeWidth={1.75} /> {t("runMonitor")}
          </Button>
        }
      >
        <FilterSelect id="alerts-status" label={t("filterStatus")} value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={items} className="sm:w-56" />
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState illustration="box" title={t("noAlerts")} description={t("noAlertsHint")} />
      ) : (
        <>
          <PanelCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDate")}</TableHead>
                  <TableHead>{t("colAlert")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colSeller")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-foreground-secondary tabular-nums">{format.dateTime(new Date(a.detectedAt), "short")}</TableCell>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {t(`alertType.${a.type}`)}
                        {a.holdsShipments && a.status === "Aberto" ? <Badge variant="danger">{t("holdsShipments")}</Badge> : null}
                      </span>
                      <span className="line-clamp-2 max-w-md text-caption text-foreground-secondary">{a.summary}</span>
                      {a.orderNumbers.length ? (
                        <span className="block text-caption text-foreground-muted tabular-nums">{a.orderNumbers.join(", ")}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{a.sellerName ?? a.buyerEmail ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "Aberto" ? "warning" : a.status === "Procedente" ? "danger" : "neutral"}>
                        {t(`alertStatus.${a.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {a.status === "Aberto" ? (
                        <Button variant="primary" size="sm" onClick={() => setJudging(a)}>
                          {t("judge")}
                        </Button>
                      ) : (
                        <span className="text-caption text-foreground-muted">{a.attribution ? t(`attribution.${a.attribution}`) : ""}</span>
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
      <ResolveAlertSheet key={judging?.id ?? "none"} alert={judging} onClose={() => setJudging(null)} />
    </div>
  );
}

function ResolveAlertSheet({ alert, onClose }: { alert: MonitoringAlertDto | null; onClose: () => void }) {
  const t = useTranslations("admin");
  const onError = useAdminErrorToast();
  const { resolveAlert } = useProgramMutations();
  const [attribution, setAttribution] = useState<AlertAttribution>(alert?.sellerId ? "Vendedor" : "Comprador");
  const [note, setNote] = useState("");
  const [registerInfraction, setRegisterInfraction] = useState(Boolean(alert?.sellerId));
  const [severity, setSeverity] = useState<InfractionSeverity>("Media");

  const resolve = (upheld: boolean) =>
    alert &&
    resolveAlert.mutate(
      {
        id: alert.id,
        body: {
          upheld,
          attribution: upheld ? attribution : null,
          note: note || null,
          registerInfraction: upheld && attribution === "Vendedor" && registerInfraction,
          severity: upheld && attribution === "Vendedor" && registerInfraction ? severity : null,
        },
      },
      { onSuccess: () => { toast.success(upheld ? t("alertUpheld") : t("alertDismissed")); onClose(); }, onError },
    );

  return (
    <DetailSheet open={Boolean(alert)} onClose={onClose} title={alert ? t(`alertType.${alert.type}`) : ""} description={alert?.summary}>
      {alert ? (
        <>
          <KeyValueList
            items={[
              { label: t("colSeller"), value: alert.sellerName ?? "—" },
              { label: t("buyer"), value: alert.buyerEmail ?? "—" },
              { label: t("orders"), value: alert.orderNumbers.join(", ") || "—" },
            ]}
          />
          {alert.holdsShipments ? <p className="rounded-md bg-warning-soft p-3 text-body-sm text-foreground">{t("holdsShipmentsHint")}</p> : null}
          <SheetSection title={t("ifUpheld")}>
            <FormField id="alert-attribution" label={t("attributionLabel")} hint={t("attributionHint")}>
              <Choice id="alert-attribution" value={attribution} onChange={(v) => setAttribution(v as AlertAttribution)}
                items={Object.fromEntries(ATTRIBUTIONS.map((a) => [a, t(`attribution.${a}`)]))} />
            </FormField>
            {attribution === "Vendedor" && alert.sellerId ? (
              <>
                <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 text-body-sm">
                  <span>{t("registerInfractionToo")}</span>
                  <Switch checked={registerInfraction} onCheckedChange={setRegisterInfraction} />
                </label>
                {registerInfraction ? (
                  <FormField id="alert-severity" label={t("severityLabel")}>
                    <Choice id="alert-severity" value={severity} onChange={(v) => setSeverity(v as InfractionSeverity)}
                      items={Object.fromEntries(SEVERITIES.map((s) => [s, t(`severity.${s}`)]))} />
                  </FormField>
                ) : null}
              </>
            ) : null}
          </SheetSection>
          <FormField id="alert-note" label={t("resolutionNote")} optional>
            <Textarea id="alert-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" className="flex-1" loading={resolveAlert.isPending} onClick={() => resolve(true)}>
              {t("uphold")}
            </Button>
            <Button variant="secondary" className="flex-1" disabled={resolveAlert.isPending} onClick={() => resolve(false)}>
              {t("dismiss")}
            </Button>
          </div>
        </>
      ) : null}
    </DetailSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Comunicações com os vendedores                                       */
/* ------------------------------------------------------------------ */

/** Comunicações de todas as lojas (Política 4.6, 6.2, 8.4 a 8.6): respostas para analisar e prazos de 10 dias. */
export function AdminProgramNotices() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const onError = useAdminErrorToast();
  const { resolveNotice } = useProgramMutations();
  const [status, setStatus] = useState<"all" | SellerNoticeStatus>("Respondida");
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<SellerNoticeDto | null>(null);
  const list = useSellerNotices({ status: status === "all" ? undefined : status, page, pageSize: 20 });
  const items = { all: t("filterAllStatus"), ...Object.fromEntries(NOTICE_STATUSES.map((s) => [s, t(`noticeStatus.${s}`)])) } as Record<
    "all" | SellerNoticeStatus,
    string
  >;

  return (
    <div>
      <PanelTitle>{t("compliance")}</PanelTitle>
      <ComplianceTabs />
      <p className="-mt-2 mb-4 max-w-3xl text-body-sm text-foreground-secondary">{t("noticesIntro")}</p>
      <PanelToolbar>
        <FilterSelect id="notices-status" label={t("filterStatus")} value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={items} className="sm:w-56" />
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState illustration="box" title={t("noNotices")} description={t("noNoticesHint")} />
      ) : (
        <>
          <PanelCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDate")}</TableHead>
                  <TableHead>{t("colSubject")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colSeller")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="text-foreground-secondary tabular-nums">{format.dateTime(new Date(n.createdAt), "short")}</TableCell>
                    <TableCell>
                      <span className="block font-medium">{n.title}</span>
                      <span className="block text-caption text-foreground-secondary">
                        {t(`noticeType.${n.type}`)}
                        {n.dueAt && n.status === "Aberta" ? ` · ${t("dueOn", { date: format.dateTime(new Date(n.dueAt), "short") })}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{n.sellerName}</TableCell>
                    <TableCell>
                      <NoticeBadge notice={n} />
                    </TableCell>
                    <TableCell className="text-right">
                      {n.status !== "Encerrada" && n.type !== "AlteracaoPolitica" ? (
                        <Button variant={n.status === "Respondida" ? "primary" : "ghost"} size="sm" onClick={() => setResolving(n)}>
                          {t("resolveNotice")}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelCard>
          <Pager page={list.data.page} pageSize={list.data.pageSize} totalCount={list.data.totalCount} onChange={setPage} />
        </>
      )}
      <ResolveNoticeSheet
        key={resolving?.id ?? "none"}
        notice={resolving}
        loading={resolveNotice.isPending}
        onClose={() => setResolving(null)}
        onSubmit={(accepted, resolution) =>
          resolving &&
          resolveNotice.mutate(
            { id: resolving.id, body: { accepted, resolution } },
            { onSuccess: () => { toast.success(t("noticeResolved")); setResolving(null); }, onError },
          )
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Capacitação                                                          */
/* ------------------------------------------------------------------ */

/** Capacitação de quem trabalha com as remessas (Programa 13.1): no início da função e a cada 12 meses. */
export function AdminTrainings() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const onError = useAdminErrorToast();
  const trainings = useTrainings();
  const { registerTraining } = useProgramMutations();
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [role, setRole] = useState("");
  const [topic, setTopic] = useState("");
  const [initial, setInitial] = useState(false);
  const [trainedAt, setTrainedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);

  const prefill = (name: string, email: string | null, personRole: string | null) => {
    setPersonName(name);
    setPersonEmail(email ?? "");
    setRole(personRole ?? "");
    setOpen(true);
  };

  return (
    <div>
      <PanelTitle>{t("compliance")}</PanelTitle>
      <ComplianceTabs />
      <p className="-mt-2 mb-4 max-w-3xl text-body-sm text-foreground-secondary">{t("trainingIntro")}</p>
      <PanelToolbar
        action={
          <Button variant="primary" onClick={() => prefill("", null, null)}>
            <GraduationCap data-icon="inline-start" strokeWidth={1.75} /> {t("registerTraining")}
          </Button>
        }
      >
        <span />
      </PanelToolbar>
      {trainings.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : trainings.isError ? (
        <ErrorState error={trainings.error} onRetry={() => trainings.refetch()} />
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <SectionHeader title={t("trainingPeople")} />
            {trainings.data.people.length === 0 ? (
              <p className="text-body-sm text-foreground-secondary">{t("noTrainingPeople")}</p>
            ) : (
              <PanelCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("person")}</TableHead>
                      <TableHead className="hidden md:table-cell">{t("role")}</TableHead>
                      <TableHead>{t("lastTraining")}</TableHead>
                      <TableHead>{t("nextTraining")}</TableHead>
                      <TableHead className="text-right">{t("colActions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainings.data.people.map((p) => (
                      <TableRow key={`${p.personName}-${p.email ?? ""}`}>
                        <TableCell>
                          <span className="flex items-center gap-2 font-medium">
                            <UserRound className="size-4 text-foreground-secondary" aria-hidden /> {p.personName}
                          </span>
                          {p.email ? <span className="block text-caption text-foreground-secondary">{p.email}</span> : null}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{p.role ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">{p.lastTrainedAt ? format.dateTime(new Date(p.lastTrainedAt), "short") : "—"}</TableCell>
                        <TableCell>
                          {p.due ? (
                            <Badge variant="danger">{p.lastTrainedAt ? t("trainingDue") : t("trainingNever")}</Badge>
                          ) : p.nextDueAt ? (
                            <span className="tabular-nums">{format.dateTime(new Date(p.nextDueAt), "short")}</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => prefill(p.personName, p.email, p.role)}>
                            {t("registerTraining")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </PanelCard>
            )}
          </section>
          <section>
            <SectionHeader title={t("trainingRecords")} />
            {trainings.data.records.length === 0 ? (
              <p className="text-body-sm text-foreground-secondary">{t("noTrainingRecords")}</p>
            ) : (
              <PanelCard>
                <ul className="divide-y divide-border">
                  {trainings.data.records.map((r) => (
                    <li key={r.id} className="flex flex-col gap-0.5 px-4 py-3 text-body-sm">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {r.personName} · {r.topic}
                        </span>
                        <span className="text-caption text-foreground-secondary tabular-nums">{format.dateTime(new Date(r.trainedAt), "short")}</span>
                      </span>
                      <span className="text-caption text-foreground-secondary">
                        {r.role}
                        {r.initial ? ` · ${t("trainingInitial")}` : ` · ${t("trainingPeriodic")}`}
                        {r.notes ? ` · ${r.notes}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </PanelCard>
            )}
          </section>
        </div>
      )}
      <DetailSheet open={open} onClose={() => setOpen(false)} title={t("registerTraining")} description={t("registerTrainingHint")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="tr-name" label={t("person")}>
            <Input id="tr-name" value={personName} maxLength={160} onChange={(e) => setPersonName(e.target.value)} />
          </FormField>
          <FormField id="tr-email" label={t("email")} optional>
            <Input id="tr-email" type="email" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} />
          </FormField>
          <FormField id="tr-role" label={t("role")} hint={t("roleHint")}>
            <Input id="tr-role" value={role} maxLength={120} onChange={(e) => setRole(e.target.value)} />
          </FormField>
          <FormField id="tr-date" label={t("trainedAt")}>
            <Input id="tr-date" type="date" value={trainedAt} onChange={(e) => setTrainedAt(e.target.value)} />
          </FormField>
        </div>
        <FormField id="tr-topic" label={t("trainingTopic")} hint={t("trainingTopicHint")}>
          <Input id="tr-topic" value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} />
        </FormField>
        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 text-body-sm">
          <span>{t("trainingInitialLabel")}</span>
          <Switch checked={initial} onCheckedChange={setInitial} />
        </label>
        <FormField id="tr-notes" label={t("notes")} optional>
          <Textarea id="tr-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        <Button
          variant="primary"
          loading={registerTraining.isPending}
          onClick={() =>
            registerTraining.mutate(
              {
                personName,
                personEmail: personEmail || null,
                role,
                topic,
                initial,
                trainedAt: trainedAt ? new Date(`${trainedAt}T12:00:00Z`).toISOString() : null,
                notes: notes || null,
              },
              {
                onSuccess: () => {
                  toast.success(t("trainingSaved"));
                  setTopic("");
                  setNotes("");
                  setOpen(false);
                },
                onError,
              },
            )
          }
        >
          {t("registerTraining")}
        </Button>
      </DetailSheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Registro de ações                                                    */
/* ------------------------------------------------------------------ */

/** Ações contra a venda de produtos ilegais e os resultados (Programa 8.9; Política 6.8). */
export function AdminEnforcementActions() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const [kind, setKind] = useState<"all" | EnforcementActionKind>("all");
  const [page, setPage] = useState(1);
  const list = useEnforcementActions({ kind: kind === "all" ? undefined : kind, page, pageSize: 30 });
  const items = { all: t("allTypes"), ...Object.fromEntries(ACTION_KINDS.map((k) => [k, t(`actionKind.${k}`)])) } as Record<
    "all" | EnforcementActionKind,
    string
  >;

  return (
    <div>
      <PanelTitle>{t("compliance")}</PanelTitle>
      <ComplianceTabs />
      <p className="-mt-2 mb-4 max-w-3xl text-body-sm text-foreground-secondary">{t("actionsIntro")}</p>
      <PanelToolbar>
        <FilterSelect id="actions-kind" label={t("filterType")} value={kind} onChange={(v) => { setKind(v); setPage(1); }} items={items} className="sm:w-80" />
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState illustration="box" title={t("noActions")} description={t("noActionsHint")} />
      ) : (
        <>
          <PanelCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDate")}</TableHead>
                  <TableHead>{t("colAction")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colSeller")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("colResult")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-foreground-secondary tabular-nums">
                      {format.dateTime(new Date(a.occurredAt), "short")}
                      <span className="block text-caption">{a.automatic ? t("automatic") : (a.actorEmail ?? "—")}</span>
                    </TableCell>
                    <TableCell>
                      <span className="block font-medium">{t(`actionKind.${a.kind}`)}</span>
                      <span className="line-clamp-2 max-w-md text-caption text-foreground-secondary">
                        {a.productName ? `${a.productName} · ` : ""}
                        {a.reason}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{a.sellerName ?? "—"}</TableCell>
                    <TableCell className="hidden max-w-sm text-body-sm text-foreground-secondary lg:table-cell">{a.result}</TableCell>
                  </TableRow>
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

/* ------------------------------------------------------------------ */
/* Auditorias                                                           */
/* ------------------------------------------------------------------ */

/** Auditoria anual (Política 7.4): lojas com infração no período e amostra das demais. */
export function AdminAudits() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const onError = useAdminErrorToast();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const audits = useSellerAudits(Number(year));
  const { planAudits } = useProgramMutations();
  const [completing, setCompleting] = useState<SellerAuditDto | null>(null);
  const years = Object.fromEntries([currentYear, currentYear - 1, currentYear - 2].map((y) => [String(y), String(y)]));

  return (
    <div>
      <PanelTitle>{t("compliance")}</PanelTitle>
      <ComplianceTabs />
      <p className="-mt-2 mb-4 max-w-3xl text-body-sm text-foreground-secondary">{t("auditsIntro")}</p>
      <PanelToolbar
        action={
          <Button
            variant="primary"
            loading={planAudits.isPending}
            onClick={() =>
              planAudits.mutate(
                { year: Number(year) },
                { onSuccess: (r) => toast.success(t("auditsPlanned", { withInfractions: r.withInfractions, sample: r.sample })), onError },
              )
            }
          >
            <ClipboardCheck data-icon="inline-start" strokeWidth={1.75} /> {t("planAudits")}
          </Button>
        }
      >
        <FilterSelect id="audits-year" label={t("year")} value={year} onChange={setYear} items={years} className="sm:w-40" />
      </PanelToolbar>
      {audits.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : audits.isError ? (
        <ErrorState error={audits.error} onRetry={() => audits.refetch()} />
      ) : audits.data.length === 0 ? (
        <EmptyState illustration="box" title={t("noAudits")} description={t("noAuditsHint")} />
      ) : (
        <PanelCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colSeller")}</TableHead>
                <TableHead>{t("auditReasonLabel")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead className="text-right">{t("colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <span className="block font-medium">{a.sellerName}</span>
                    <span className="block text-caption text-foreground-secondary tabular-nums">{format.dateTime(new Date(a.plannedAt), "short")}</span>
                  </TableCell>
                  <TableCell>{t(`auditReason.${a.reason}`)}</TableCell>
                  <TableCell>
                    <Badge variant={a.status === "Planejada" ? "warning" : a.outcome === "NaoConforme" ? "danger" : "success"}>
                      {a.status === "Planejada" ? t("auditStatus.Planejada") : t(`auditOutcome.${a.outcome ?? "Conforme"}`)}
                    </Badge>
                    {a.findings ? <span className="mt-1 line-clamp-2 block max-w-xs text-caption text-foreground-secondary">{a.findings}</span> : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {a.status === "Planejada" ? (
                      <Button variant="secondary" size="sm" onClick={() => setCompleting(a)}>
                        {t("completeAudit")}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PanelCard>
      )}
      <CompleteAuditSheet key={completing?.id ?? "none"} audit={completing} onClose={() => setCompleting(null)} />
    </div>
  );
}

function CompleteAuditSheet({ audit, onClose }: { audit: SellerAuditDto | null; onClose: () => void }) {
  const t = useTranslations("admin");
  const onError = useAdminErrorToast();
  const { completeAudit } = useProgramMutations();
  const [outcome, setOutcome] = useState<SellerAuditOutcome>("Conforme");
  const [findings, setFindings] = useState("");
  return (
    <DetailSheet open={Boolean(audit)} onClose={onClose} title={t("completeAudit")} description={audit?.sellerName}>
      <p className="rounded-md bg-surface-muted p-3 text-body-sm text-foreground-secondary">{t("auditChecklist")}</p>
      <FormField id="audit-outcome" label={t("auditOutcomeLabel")}>
        <Choice id="audit-outcome" value={outcome} onChange={(v) => setOutcome(v as SellerAuditOutcome)}
          items={{ Conforme: t("auditOutcome.Conforme"), NaoConforme: t("auditOutcome.NaoConforme") }} />
      </FormField>
      <FormField id="audit-findings" label={t("auditFindings")} hint={t("auditFindingsHint")}>
        <Textarea id="audit-findings" rows={4} maxLength={4000} value={findings} onChange={(e) => setFindings(e.target.value)} />
      </FormField>
      <Button
        variant="primary"
        loading={completeAudit.isPending}
        onClick={() =>
          audit &&
          completeAudit.mutate(
            { id: audit.id, body: { outcome, findings } },
            { onSuccess: () => { toast.success(t("auditCompleted")); onClose(); }, onError },
          )
        }
      >
        {t("completeAudit")}
      </Button>
    </DetailSheet>
  );
}
