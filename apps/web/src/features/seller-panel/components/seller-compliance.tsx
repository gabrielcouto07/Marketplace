"use client";

import type { SellerNoticeDto, SellerNoticeStatus } from "@marketplace/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Ban, CalendarCheck, FileText, Inbox, Mail, ShieldCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { DocumentList } from "@/components/shared/document-upload";
import { FormField } from "@/components/shared/form-field";
import { FilterSelect, PanelCard, PanelToolbar } from "@/components/shared/panel-widgets";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSellerPolicy } from "@/features/compliance/api";
import { SellerPolicyText } from "@/features/compliance/components/seller-policy-text";
import { Link } from "@/i18n/navigation";
import { documentHref } from "@/lib/api/download";
import { isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

import {
  uploadDocument,
  useAcceptSellerPolicy,
  useConfirmSellerData,
  useRespondNotice,
  useSellerCompliance,
  useSellerNotice,
  useSellerNotices,
  useSellerProfile,
} from "../api";

type Tone = "danger" | "warning" | "info";

const TONE: Record<Tone, string> = {
  danger: "border-danger/30 bg-danger-soft",
  warning: "border-warning/30 bg-warning-soft",
  info: "border-primary/20 bg-primary-soft",
};
const TONE_ICON: Record<Tone, string> = { danger: "text-danger", warning: "text-warning", info: "text-primary" };

function Banner({
  tone,
  icon: Icon,
  title,
  children,
  action,
}: {
  tone: Tone;
  icon: typeof AlertTriangle;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center", TONE[tone])}>
      <Icon className={cn("size-5 shrink-0", TONE_ICON[tone])} strokeWidth={1.75} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-sm font-semibold text-foreground">{title}</p>
        {children ? <div className="text-body-sm text-foreground-secondary">{children}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * Avisos da Política de Vendedores no topo do painel: loja excluída ou suspensa (8.1 e 8.4, com o motivo — 8.5),
 * aceite de nova versão da Política (2.2 e 10.3), confirmação anual dos dados (4.3), cadastro incompleto (3.1 e 3.2) e
 * comunicações abertas com prazo de 10 dias (6.2 e 8.6).
 */
export function SellerComplianceBanners() {
  const t = useTranslations("sellerCompliance");
  const format = useFormatter();
  const status = useSellerCompliance();
  const [policyOpen, setPolicyOpen] = useState(false);

  const s = status.data;
  if (!s) return null;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  const banners: ReactNode[] = [];
  if (s.status === "Excluido") {
    banners.push(
      <Banner key="excluded" tone="danger" icon={Ban} title={t("excludedTitle")}>
        {s.suspensionReason ? t("reason", { reason: s.suspensionReason }) : null} {t("excludedText")}
      </Banner>,
    );
  } else if (s.status === "Suspenso") {
    banners.push(
      <Banner
        key="suspended"
        tone="danger"
        icon={Ban}
        title={s.suspendedUntil ? t("suspendedUntilTitle", { date: date(s.suspendedUntil) }) : t("suspendedTitle")}
        action={
          <Button variant="secondary" size="sm" render={<Link href="/vendedor/comunicacoes" />}>
            {t("seeNotices")}
          </Button>
        }
      >
        {s.suspensionReason ? t("reason", { reason: s.suspensionReason }) : null} {t("suspendedText")}
      </Banner>,
    );
  } else if (s.status === "Pendente") {
    banners.push(
      <Banner
        key="pending"
        tone="info"
        icon={ShieldCheck}
        title={t("pendingTitle")}
        action={
          s.admissionDataComplete ? null : (
            <Button variant="secondary" size="sm" render={<Link href="/vendedor/configuracoes" />}>
              {t("completeData")}
            </Button>
          )
        }
      >
        {s.admissionDataComplete ? t("pendingText") : t("missingData", { items: s.missingAdmissionData.join(", ") })}
      </Banner>,
    );
  } else if (!s.admissionDataComplete) {
    banners.push(
      <Banner
        key="missing"
        tone="warning"
        icon={AlertTriangle}
        title={t("missingTitle")}
        action={
          <Button variant="secondary" size="sm" render={<Link href="/vendedor/configuracoes" />}>
            {t("completeData")}
          </Button>
        }
      >
        {t("missingData", { items: s.missingAdmissionData.join(", ") })}
      </Banner>,
    );
  }

  if (s.policyAcceptanceRequired && s.status !== "Excluido") {
    banners.push(
      <Banner
        key="policy"
        tone="warning"
        icon={FileText}
        title={t("policyTitle", { version: s.policyVersion })}
        action={
          <Button variant="primary" size="sm" onClick={() => setPolicyOpen(true)}>
            {t("policyCta")}
          </Button>
        }
      >
        {s.policyVersionAccepted ? t("policyChanged", { version: s.policyVersionAccepted }) : t("policyFirst")}
      </Banner>,
    );
  }

  if (s.dataConfirmationDue && s.admissionDataComplete && s.status !== "Excluido") {
    banners.push(
      <Banner
        key="confirm"
        tone="warning"
        icon={CalendarCheck}
        title={t("confirmTitle")}
        action={
          <Button variant="secondary" size="sm" render={<Link href="/vendedor/configuracoes" />}>
            {t("confirmCta")}
          </Button>
        }
      >
        {t("confirmText", { date: date(s.dataConfirmationDueAt) })}
      </Banner>,
    );
  }

  if (s.openNotices > 0) {
    banners.push(
      <Banner
        key="notices"
        tone={s.overdueNotices > 0 ? "danger" : "info"}
        icon={Mail}
        title={t("noticesTitle", { count: s.openNotices })}
        action={
          <Button variant="secondary" size="sm" render={<Link href="/vendedor/comunicacoes" />}>
            {t("seeNotices")}
          </Button>
        }
      >
        {s.overdueNotices > 0 ? t("noticesOverdue", { count: s.overdueNotices }) : t("noticesText")}
      </Banner>,
    );
  }

  return (
    <>
      {banners.length > 0 ? <div className="mb-6 flex flex-col gap-3">{banners}</div> : null}
      <PolicyAcceptanceSheet open={policyOpen} onClose={() => setPolicyOpen(false)} version={s.policyVersion} />
    </>
  );
}

/** Leitura e aceite eletrônico da Política pelo representante legal, com data, hora e identificação (2.2). */
function PolicyAcceptanceSheet({ open, onClose, version }: { open: boolean; onClose: () => void; version: string }) {
  const t = useTranslations("sellerCompliance");
  const tErrors = useTranslations("errors");
  const policy = useSellerPolicy();
  const profile = useSellerProfile();
  const accept = useAcceptSellerPolicy();
  const [read, setRead] = useState(false);
  const [representative, setRepresentative] = useState<string | null>(null);
  const name = representative ?? profile.data?.verification?.responsibleName ?? "";

  return (
    <BottomSheet open={open} onOpenChange={(next) => !next && onClose()}>
      <BottomSheetContent className="max-h-[92dvh] sm:mx-auto sm:max-w-2xl">
        <BottomSheetHeader>
          <BottomSheetTitle>{t("policySheetTitle", { version })}</BottomSheetTitle>
          <BottomSheetDescription>{t("policySheetText")}</BottomSheetDescription>
        </BottomSheetHeader>
        <BottomSheetBody className="flex flex-col gap-4 overflow-y-auto">
          <div className="max-h-[45dvh] overflow-y-auto rounded-md border border-border bg-surface-muted p-4">
            {policy.data ? <SellerPolicyText policy={policy.data} compact /> : <Skeleton className="h-40" />}
          </div>
          <FormField id="policy-representative" label={t("representativeName")} hint={t("representativeHint")}>
            <Input
              id="policy-representative"
              autoComplete="name"
              value={name}
              maxLength={160}
              onChange={(e) => setRepresentative(e.target.value)}
            />
          </FormField>
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-3 text-body-sm text-foreground has-data-checked:border-primary">
            <Checkbox className="mt-0.5" checked={read} onCheckedChange={(v) => setRead(v === true)} />
            <span>{t("policyAcceptLabel", { version })}</span>
          </label>
        </BottomSheetBody>
        <BottomSheetFooter>
          <Button
            variant="primary"
            fullWidth
            disabled={!read || name.trim().length < 5}
            loading={accept.isPending}
            onClick={() =>
              accept.mutate(
                { accept: true, representativeName: name.trim() },
                {
                  onSuccess: () => {
                    toast.success(t("policyAccepted"));
                    onClose();
                  },
                  onError: (error) => toast.error(isApiError(error) ? error.message : tErrors("genericTitle")),
                },
              )
            }
          >
            {t("policyAcceptCta")}
          </Button>
        </BottomSheetFooter>
      </BottomSheetContent>
    </BottomSheet>
  );
}

/** Confirmação anual dos dados cadastrais (Política 4.3): data da última confirmação e o botão para confirmar. */
export function DataConfirmationCard({ className }: { className?: string }) {
  const t = useTranslations("sellerCompliance");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const status = useSellerCompliance();
  const confirm = useConfirmSellerData();
  const s = status.data;
  if (!s || s.status === "Excluido") return null;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:p-6",
        s.dataConfirmationDue ? "border-warning/30 bg-warning-soft" : "border-border bg-surface shadow-xs",
        className,
      )}
    >
      <CalendarCheck
        className={cn("size-6 shrink-0", s.dataConfirmationDue ? "text-warning" : "text-success")}
        strokeWidth={1.75}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className="text-body font-semibold text-foreground">{t("confirmCardTitle")}</h2>
        <p className="text-body-sm text-foreground-secondary">
          {s.dataConfirmedAt ? t("confirmedAt", { date: date(s.dataConfirmedAt) }) : t("neverConfirmed")}{" "}
          {t("confirmDue", { date: date(s.dataConfirmationDueAt) })}
        </p>
        {!s.admissionDataComplete ? (
          <p className="text-caption text-warning">{t("missingData", { items: s.missingAdmissionData.join(", ") })}</p>
        ) : null}
      </div>
      <Button
        variant={s.dataConfirmationDue ? "primary" : "secondary"}
        size="sm"
        disabled={!s.admissionDataComplete}
        loading={confirm.isPending}
        onClick={() =>
          confirm.mutate(undefined, {
            onSuccess: () => toast.success(t("confirmedToast")),
            onError: (error) => toast.error(isApiError(error) ? error.message : tErrors("genericTitle")),
          })
        }
      >
        {t("confirmCta")}
      </Button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Comunicações                                                         */
/* ------------------------------------------------------------------ */

type StatusFilter = "all" | SellerNoticeStatus;

const NOTICE_BADGE: Record<SellerNoticeStatus, "warning" | "soft" | "neutral"> = {
  Aberta: "warning",
  Respondida: "soft",
  Encerrada: "neutral",
};

export function NoticeStatusBadge({ notice }: { notice: Pick<SellerNoticeDto, "status" | "overdue"> }) {
  const t = useTranslations("sellerCompliance");
  if (notice.status === "Aberta" && notice.overdue) return <Badge variant="danger">{t("overdue")}</Badge>;
  return <Badge variant={NOTICE_BADGE[notice.status]}>{t(`noticeStatus.${notice.status}`)}</Badge>;
}

/**
 * Comunicações da plataforma à loja (Política 4.6, 6.2, 8.4 a 8.6 e 10.3): medidas aplicadas com o motivo, pedidos de
 * documentos (autenticidade, valor da operação, registros), correção de dados e alterações da Política. O vendedor
 * responde em até 10 dias com texto e documentos.
 */
export function SellerNotices() {
  const t = useTranslations("sellerCompliance");
  const format = useFormatter();
  const client = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useSellerNotices({ status: status === "all" ? undefined : status, page });

  const filters: Record<StatusFilter, string> = {
    all: t("filterAll"),
    Aberta: t("noticeStatus.Aberta"),
    Respondida: t("noticeStatus.Respondida"),
    Encerrada: t("noticeStatus.Encerrada"),
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <PanelTitle className="mb-2">{t("noticesPageTitle")}</PanelTitle>
      <p className="mb-6 text-body-sm text-foreground-secondary">{t("noticesPageIntro")}</p>
      <PanelToolbar>
        <FilterSelect
          id="notice-status"
          label={t("filterLabel")}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          items={filters}
          className="sm:w-56"
        />
      </PanelToolbar>

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.data.items.length === 0 ? (
        <EmptyState illustration="box" title={t("emptyTitle")} description={t("emptyText")} />
      ) : (
        <PanelCard>
          <ul className="divide-y divide-border">
            {list.data.items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(n.id)}
                  className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface-muted focus-ring"
                >
                  <Inbox className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-body-sm text-foreground", !n.readAt && "font-semibold")}>{n.title}</span>
                      <NoticeStatusBadge notice={n} />
                    </span>
                    <span className="text-caption text-foreground-secondary">
                      {t(`noticeType.${n.type}`)} · {format.dateTime(new Date(n.createdAt), { dateStyle: "medium" })}
                      {n.dueAt && n.status === "Aberta"
                        ? ` · ${t("dueAt", { date: format.dateTime(new Date(n.dueAt), { dateStyle: "medium" }) })}`
                        : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PanelCard>
      )}
      {list.data && list.data.totalCount > list.data.pageSize ? (
        <div className="mt-4 flex justify-between gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t("previous")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page * list.data.pageSize >= list.data.totalCount}
            onClick={() => setPage(page + 1)}
          >
            {t("next")}
          </Button>
        </div>
      ) : null}

      {openId ? (
        <NoticeSheet
          id={openId}
          onClose={() => {
            setOpenId(null);
            // Abrir marca como lida: a lista e os avisos do painel refletem isso.
            void client.invalidateQueries({ queryKey: ["seller", "notices"] });
            void client.invalidateQueries({ queryKey: ["seller", "compliance"] });
          }}
        />
      ) : null}
    </div>
  );
}

function NoticeSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useTranslations("sellerCompliance");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const notice = useSellerNotice(id);
  const respond = useRespondNotice(id);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Array<{ key: string; url: string; name: string }>>([]);
  const n = notice.data;
  // Aviso e mudança da Política não pedem resposta (a API recusa).
  const canRespond = n ? n.status !== "Encerrada" && n.type !== "AlteracaoPolitica" && n.type !== "Aviso" : false;
  // Política 8.4: o pedido de correção só se encerra com os dados corrigidos ou confirmados em Configurações.
  const dataUpdate = n?.type === "AtualizacaoCadastral" && n.status === "Aberta";

  return (
    <BottomSheet open onOpenChange={(next) => !next && onClose()}>
      <BottomSheetContent className="max-h-[92dvh] sm:mx-auto sm:max-w-2xl">
        <BottomSheetHeader>
          <BottomSheetTitle>{n?.title ?? t("loading")}</BottomSheetTitle>
          {n ? (
            <BottomSheetDescription>
              {t(`noticeType.${n.type}`)}
              {n.documentKind ? ` · ${t(`documentKind.${n.documentKind}`)}` : ""} ·{" "}
              {format.dateTime(new Date(n.createdAt), { dateStyle: "medium", timeStyle: "short" })}
            </BottomSheetDescription>
          ) : null}
        </BottomSheetHeader>
        <BottomSheetBody className="flex flex-col gap-4 overflow-y-auto">
          {notice.isError ? <ErrorState error={notice.error} onRetry={() => notice.refetch()} /> : null}
          {!n ? (
            <Skeleton className="h-40" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <NoticeStatusBadge notice={n} />
                {n.dueAt && n.status === "Aberta" ? (
                  <span className="text-caption text-foreground-secondary tabular-nums">
                    {t("dueAt", { date: format.dateTime(new Date(n.dueAt), { dateStyle: "medium", timeStyle: "short" }) })}
                  </span>
                ) : null}
              </div>
              <p className="text-body-sm whitespace-pre-line text-foreground">{n.message}</p>
              {n.productName ? (
                <p className="text-body-sm text-foreground-secondary">
                  {t("product")}:{" "}
                  {n.productSlug ? (
                    <Link href={`/produto/${n.productSlug}`} className="font-medium text-primary underline-offset-2 hover:underline">
                      {n.productName}
                    </Link>
                  ) : (
                    n.productName
                  )}
                </p>
              ) : null}
              {n.orderNumber ? (
                <p className="text-body-sm text-foreground-secondary tabular-nums">
                  {t("order")}: {n.orderNumber}
                </p>
              ) : null}

              {dataUpdate ? (
                <div className="flex flex-col items-start gap-3 rounded-md bg-warning-soft p-3">
                  <p className="text-body-sm text-foreground">{t("dataUpdateHint")}</p>
                  <Button variant="secondary" size="sm" render={<Link href="/vendedor/configuracoes" />}>
                    {t("dataUpdateCta")}
                  </Button>
                </div>
              ) : null}

              {n.respondedAt ? (
                <div className="flex flex-col gap-2 rounded-md bg-surface-muted p-3">
                  <p className="text-caption font-semibold text-foreground-secondary uppercase">
                    {t("yourResponse", { date: format.dateTime(new Date(n.respondedAt), { dateStyle: "medium" }) })}
                  </p>
                  {n.responseText ? <p className="text-body-sm whitespace-pre-line text-foreground">{n.responseText}</p> : null}
                  {n.responseFiles.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {n.responseFiles.map((f) => (
                        <li key={f.key}>
                          <a
                            href={documentHref(f.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-body-sm text-primary underline-offset-2 hover:underline"
                          >
                            {f.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {n.resolution ? (
                <div className="flex flex-col gap-1 rounded-md border border-border p-3">
                  <p className="text-caption font-semibold text-foreground-secondary uppercase">{t("resolution")}</p>
                  <p className="text-body-sm text-foreground">{n.resolution}</p>
                </div>
              ) : null}

              {canRespond ? (
                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  <FormField id="notice-response" label={n.respondedAt ? t("respondAgain") : t("respond")} hint={t("respondHint")}>
                    <Textarea id="notice-response" rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} />
                  </FormField>
                  <DocumentList values={files} onChange={setFiles} upload={uploadDocument} label={t("attachments")} />
                </div>
              ) : null}
            </>
          )}
        </BottomSheetBody>
        {canRespond ? (
          <BottomSheetFooter>
            <Button
              variant="primary"
              fullWidth
              disabled={text.trim().length < 10 || (n?.type === "SolicitacaoDocumentos" && files.length === 0)}
              loading={respond.isPending}
              onClick={() =>
                respond.mutate(
                  { text: text.trim() || null, files: files.map((f) => f.key) },
                  {
                    onSuccess: () => {
                      toast.success(t("responded"));
                      setText("");
                      setFiles([]);
                    },
                    onError: (error) => toast.error(isApiError(error) ? error.message : tErrors("genericTitle")),
                  },
                )
              }
            >
              {t("sendResponse")}
            </Button>
          </BottomSheetFooter>
        ) : null}
      </BottomSheetContent>
    </BottomSheet>
  );
}

