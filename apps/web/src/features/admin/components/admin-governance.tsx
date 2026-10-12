"use client";

import type {
  AdminSellerDetailDto,
  DocumentRequestKind,
  InfractionSeverity,
  MeasureRecommendationDto,
  SellerMeasureDto,
  SellerMeasureType,
  SellerNoticeDto,
  SellerNoticeType,
} from "@marketplace/contracts";
import { AlertTriangle, FileJson, Gavel, Mail, ShieldAlert, Undo2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/shared/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { documentHref, downloadAuthenticated } from "@/lib/api/download";
import { cn } from "@/lib/utils";

import { useAdminProducts } from "../api";
import { useProgramMutations } from "../api/compliance";
import { DetailSheet, SheetSection, useAdminErrorToast } from "./admin-widgets";

const SEVERITIES: InfractionSeverity[] = ["Leve", "Media", "Grave"];
const MEASURES: SellerMeasureType[] = ["RemocaoAnuncio", "SuspensaoTemporaria", "Exclusao"];
const NOTICE_TYPES: SellerNoticeType[] = ["SolicitacaoDocumentos", "AtualizacaoCadastral", "Aviso"];
const DOCUMENT_KINDS: DocumentRequestKind[] = ["Autenticidade", "ValorDaOperacao", "Registros"];

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

const SEVERITY_BADGE: Record<InfractionSeverity, "neutral" | "warning" | "danger"> = { Leve: "neutral", Media: "warning", Grave: "danger" };

/**
 * Governança da loja na ficha do admin (Política de Vendedores 3.5, 6, 7 e 8): infrações e reincidência, medidas
 * graduadas, comunicações com prazo de 10 dias, aceites da Política, auditorias e o dossiê para autoridades (9.1).
 */
export function SellerGovernanceSection({ detail }: { detail: AdminSellerDetailDto }) {
  const t = useTranslations("admin");
  const format = useFormatter();
  const g = detail.governance;
  const onError = useAdminErrorToast();
  const { revokeMeasure, resolveNotice } = useProgramMutations();
  const [sheet, setSheet] = useState<"infraction" | "measure" | "notice" | "dossier" | null>(null);
  const [revoking, setRevoking] = useState<SellerMeasureDto | null>(null);
  const [resolving, setResolving] = useState<SellerNoticeDto | null>(null);
  const [recommendation, setRecommendation] = useState<{ infractionId: string; value: MeasureRecommendationDto } | null>(null);
  const sellerId = detail.summary.id;
  const date = (iso: string) => format.dateTime(new Date(iso), "short");

  if (!g) return null;

  return (
    <>
      <SheetSection
        title={t("governance")}
        action={
          <span className="flex items-center gap-2">
            <Badge variant={g.infractions12Months > 0 ? "warning" : "neutral"}>{t("infractions12m", { count: g.infractions12Months })}</Badge>
            {g.recidivist ? <Badge variant="danger">{t("recidivist")}</Badge> : null}
          </span>
        }
      >
        {g.reRegistrationMatches.length > 0 ? (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-body-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
            <span>{t("reRegistration", { matches: g.reRegistrationMatches.join("; ") })}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSheet("notice")}>
            <Mail data-icon="inline-start" strokeWidth={1.75} /> {t("sendNotice")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSheet("infraction")}>
            <Gavel data-icon="inline-start" strokeWidth={1.75} /> {t("registerInfraction")}
          </Button>
          <Button variant="secondary" size="sm" className="text-danger" onClick={() => setSheet("measure")}>
            <ShieldAlert data-icon="inline-start" strokeWidth={1.75} /> {t("applyMeasure")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSheet("dossier")}>
            <FileJson data-icon="inline-start" strokeWidth={1.75} /> {t("dossier")}
          </Button>
        </div>
      </SheetSection>

      <SheetSection title={t("measures")}>
        {g.measures.length === 0 ? (
          <p className="text-body-sm text-foreground-secondary">{t("noMeasures")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border text-body-sm">
            {g.measures.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 px-3 py-2">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    {t(`measureType.${m.type}`)}
                    <Badge variant={m.active ? "danger" : "neutral"}>{m.active ? t("active") : m.revokedAt ? t("revoked") : t("ended")}</Badge>
                    {m.automatic ? <Badge variant="soft">{t("automatic")}</Badge> : null}
                  </span>
                  <span className="text-caption text-foreground-secondary tabular-nums">
                    {date(m.appliedAt)}
                    {m.endsAt ? ` → ${date(m.endsAt)}` : ""}
                  </span>
                </span>
                <span className="text-caption text-foreground-secondary">
                  {m.productName ? `${m.productName} · ` : ""}
                  {m.reason}
                </span>
                {m.revocationReason ? <span className="text-caption text-foreground-muted">{t("revokedBecause", { reason: m.revocationReason })}</span> : null}
                {m.active ? (
                  <Button variant="ghost" size="xs" className="self-start" onClick={() => setRevoking(m)}>
                    <Undo2 data-icon="inline-start" strokeWidth={1.75} /> {t("revokeMeasure")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SheetSection>

      <SheetSection title={t("infractions")}>
        {g.infractions.length === 0 ? (
          <p className="text-body-sm text-foreground-secondary">{t("noInfractions")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border text-body-sm">
            {g.infractions.map((i) => (
              <li key={i.id} className="flex flex-col gap-0.5 px-3 py-2">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    {i.code}
                    <Badge variant={SEVERITY_BADGE[i.severity]}>{t(`severity.${i.severity}`)}</Badge>
                    {i.intentional ? <Badge variant="danger">{t("intentional")}</Badge> : null}
                    {i.recidivist ? <Badge variant="warning">{t("recidivist")}</Badge> : null}
                  </span>
                  <span className="text-caption text-foreground-secondary tabular-nums">{date(i.occurredAt)}</span>
                </span>
                <span className="text-caption text-foreground-secondary">
                  {i.productName ? `${i.productName} · ` : ""}
                  {i.orderNumber ? `${i.orderNumber} · ` : ""}
                  {i.description}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SheetSection>

      <SheetSection title={t("sellerNotices")}>
        {g.notices.length === 0 ? (
          <p className="text-body-sm text-foreground-secondary">{t("noNotices")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border text-body-sm">
            {g.notices.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 px-3 py-2">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{n.title}</span>
                  <NoticeBadge notice={n} />
                </span>
                <span className="text-caption text-foreground-secondary tabular-nums">
                  {t(`noticeType.${n.type}`)} · {date(n.createdAt)}
                  {n.dueAt && n.status === "Aberta" ? ` · ${t("dueOn", { date: date(n.dueAt) })}` : ""}
                </span>
                {n.responseText || n.responseFiles.length ? (
                  <div className="rounded-sm bg-surface-muted p-2 text-caption text-foreground">
                    {n.responseText}
                    {n.responseFiles.map((f) => (
                      <a key={f.key} href={documentHref(f.url)} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary underline">
                        {f.name}
                      </a>
                    ))}
                  </div>
                ) : null}
                {n.resolution ? <span className="text-caption text-foreground-muted">{n.resolution}</span> : null}
                {n.status !== "Encerrada" && n.type !== "AlteracaoPolitica" ? (
                  <Button variant="ghost" size="xs" className="self-start" onClick={() => setResolving(n)}>
                    {t("resolveNotice")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SheetSection>

      <SheetSection title={t("policyAcceptances")}>
        {g.acceptances.length === 0 ? (
          <p className="text-body-sm text-danger">{t("policyNotAccepted")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border text-body-sm">
            {g.acceptances.map((a) => (
              <li key={`${a.policyVersion}-${a.acceptedAt}`} className="flex flex-col gap-0.5 px-3 py-2">
                <span className="font-medium">{t("policyVersionLabel", { version: a.policyVersion })}</span>
                <span className="text-caption text-foreground-secondary tabular-nums">
                  {format.dateTime(new Date(a.acceptedAt), { dateStyle: "short", timeStyle: "medium" })} · {a.representativeName}
                  {a.representativeDocumentMasked ? ` (${a.representativeDocumentMasked})` : ""}
                  {a.ipAddress ? ` · IP ${a.ipAddress}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SheetSection>

      {g.audits.length > 0 ? (
        <SheetSection title={t("audits")}>
          <ul className="divide-y divide-border rounded-md border border-border text-body-sm">
            {g.audits.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  {a.year} · {t(`auditReason.${a.reason}`)}
                </span>
                <Badge variant={a.status === "Planejada" ? "warning" : a.outcome === "NaoConforme" ? "danger" : "success"}>
                  {a.status === "Planejada" ? t("auditStatus.Planejada") : t(`auditOutcome.${a.outcome ?? "Conforme"}`)}
                </Badge>
              </li>
            ))}
          </ul>
        </SheetSection>
      ) : null}

      <InfractionSheet
        open={sheet === "infraction"}
        sellerId={sellerId}
        onClose={() => setSheet(null)}
        onRegistered={(infractionId, value) => {
          setSheet("measure");
          setRecommendation({ infractionId, value });
        }}
      />
      <MeasureSheet
        key={recommendation?.infractionId ?? "measure"}
        open={sheet === "measure"}
        sellerId={sellerId}
        recommendation={recommendation}
        onClose={() => {
          setSheet(null);
          setRecommendation(null);
        }}
      />
      <NoticeSheet open={sheet === "notice"} sellerId={sellerId} onClose={() => setSheet(null)} />
      <DossierSheet open={sheet === "dossier"} sellerId={sellerId} sellerName={detail.summary.name} onClose={() => setSheet(null)} />

      <ReasonSheet
        open={Boolean(revoking)}
        title={t("revokeMeasure")}
        description={revoking ? `${t(`measureType.${revoking.type}`)} · ${revoking.reason}` : undefined}
        label={t("revokeReason")}
        submitLabel={t("revokeMeasure")}
        loading={revokeMeasure.isPending}
        onClose={() => setRevoking(null)}
        onSubmit={(reason) =>
          revoking &&
          revokeMeasure.mutate(
            { sellerId, measureId: revoking.id, body: { reason } },
            { onSuccess: () => { toast.success(t("measureRevoked")); setRevoking(null); }, onError },
          )
        }
      />
      <ResolveNoticeSheet
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
    </>
  );
}

export function NoticeBadge({ notice }: { notice: Pick<SellerNoticeDto, "status" | "overdue"> }) {
  const t = useTranslations("admin");
  if (notice.status === "Aberta" && notice.overdue) return <Badge variant="danger">{t("overdue")}</Badge>;
  return (
    <Badge variant={notice.status === "Aberta" ? "warning" : notice.status === "Respondida" ? "soft" : "neutral"}>
      {t(`noticeStatus.${notice.status}`)}
    </Badge>
  );
}

function InfractionSheet({
  open,
  sellerId,
  onClose,
  onRegistered,
}: {
  open: boolean;
  sellerId: string;
  onClose: () => void;
  onRegistered: (infractionId: string, recommendation: MeasureRecommendationDto) => void;
}) {
  const t = useTranslations("admin");
  const onError = useAdminErrorToast();
  const { registerInfraction } = useProgramMutations();
  const products = useAdminProducts({ sellerId, pageSize: 100 });
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<InfractionSeverity>("Leve");
  const [intentional, setIntentional] = useState(false);
  const [productId, setProductId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const productItems = { "": t("noProduct"), ...Object.fromEntries((products.data?.items ?? []).map((p) => [p.id, p.name])) };

  return (
    <DetailSheet open={open} onClose={onClose} title={t("registerInfraction")} description={t("registerInfractionHint")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="inf-code" label={t("infractionCode")} hint={t("infractionCodeHint")}>
          <Input id="inf-code" value={code} maxLength={40} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="DIVERGENCIA" />
        </FormField>
        <FormField id="inf-severity" label={t("severityLabel")} hint={t("severityHint")}>
          <Choice id="inf-severity" value={severity} onChange={(v) => setSeverity(v as InfractionSeverity)}
            items={Object.fromEntries(SEVERITIES.map((s) => [s, t(`severity.${s}`)]))} />
        </FormField>
      </div>
      <FormField id="inf-description" label={t("colDescription")}>
        <Textarea id="inf-description" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="inf-product" label={t("colProduct")} optional>
          <Choice id="inf-product" value={productId} onChange={setProductId} items={productItems} />
        </FormField>
        <FormField id="inf-order" label={t("occurrenceOrder")} optional>
          <Input id="inf-order" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="PY-2026-000123" />
        </FormField>
      </div>
      <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 text-body-sm">
        <span>{t("intentionalLabel")}</span>
        <Switch checked={intentional} onCheckedChange={setIntentional} />
      </label>
      <Button
        variant="primary"
        loading={registerInfraction.isPending}
        onClick={() =>
          registerInfraction.mutate(
            {
              sellerId,
              body: {
                code: code || null,
                description,
                severity,
                intentional,
                productId: productId || null,
                orderNumber: orderNumber || null,
              },
            },
            {
              onSuccess: (result) => {
                toast.success(t("infractionSaved"));
                setCode("");
                setDescription("");
                onRegistered(result.infraction.id, result.recommendation);
              },
              onError,
            },
          )
        }
      >
        {t("registerInfraction")}
      </Button>
    </DetailSheet>
  );
}

function MeasureSheet({
  open,
  sellerId,
  recommendation,
  onClose,
}: {
  open: boolean;
  sellerId: string;
  recommendation: { infractionId: string; value: MeasureRecommendationDto } | null;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const onError = useAdminErrorToast();
  const { applyMeasure } = useProgramMutations();
  const products = useAdminProducts({ sellerId, pageSize: 100 });
  const [type, setType] = useState<SellerMeasureType>(recommendation?.value.type ?? "RemocaoAnuncio");
  const [reason, setReason] = useState("");
  const [productId, setProductId] = useState("");
  const [days, setDays] = useState(String(recommendation?.value.suspensionDays ?? 30));
  const productItems = { "": t("noProduct"), ...Object.fromEntries((products.data?.items ?? []).map((p) => [p.id, p.name])) };

  return (
    <DetailSheet open={open} onClose={onClose} title={t("applyMeasure")} description={t("applyMeasureHint")}>
      {recommendation ? (
        <div className="flex flex-col gap-1 rounded-md bg-primary-soft p-3 text-body-sm text-foreground">
          <span className="font-semibold">
            {t("recommended", { measure: t(`measureType.${recommendation.value.type}`) })}
            {recommendation.value.suspensionDays ? ` · ${t("days", { count: recommendation.value.suspensionDays })}` : ""}
          </span>
          <span className="text-caption text-foreground-secondary">{recommendation.value.rationale}</span>
        </div>
      ) : null}
      <FormField id="measure-type" label={t("measureTypeLabel")}>
        <Choice id="measure-type" value={type} onChange={(v) => setType(v as SellerMeasureType)}
          items={Object.fromEntries(MEASURES.map((m) => [m, t(`measureType.${m}`)]))} />
      </FormField>
      {type === "RemocaoAnuncio" ? (
        <FormField id="measure-product" label={t("colProduct")}>
          <Choice id="measure-product" value={productId} onChange={setProductId} items={productItems} />
        </FormField>
      ) : null}
      {type === "SuspensaoTemporaria" ? (
        <FormField id="measure-days" label={t("suspensionDays")} hint={t("suspensionDaysHint")}>
          <Input id="measure-days" type="number" inputMode="numeric" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
        </FormField>
      ) : null}
      {type === "Exclusao" ? <p className="rounded-md bg-danger-soft p-3 text-body-sm text-danger">{t("exclusionWarning")}</p> : null}
      <FormField id="measure-reason" label={t("measureReason")} hint={t("measureReasonHint")}>
        <Textarea id="measure-reason" rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
      <Button
        variant="primary"
        loading={applyMeasure.isPending}
        onClick={() =>
          applyMeasure.mutate(
            {
              sellerId,
              body: {
                type,
                reason,
                infractionId: recommendation?.infractionId ?? null,
                productId: type === "RemocaoAnuncio" ? productId || null : null,
                suspensionDays: type === "SuspensaoTemporaria" ? Number(days) || null : null,
              },
            },
            { onSuccess: () => { toast.success(t("measureApplied")); onClose(); }, onError },
          )
        }
      >
        {t("applyMeasure")}
      </Button>
    </DetailSheet>
  );
}

function NoticeSheet({ open, sellerId, onClose }: { open: boolean; sellerId: string; onClose: () => void }) {
  const t = useTranslations("admin");
  const onError = useAdminErrorToast();
  const { createNotice } = useProgramMutations();
  const products = useAdminProducts({ sellerId, pageSize: 100 });
  const [type, setType] = useState<SellerNoticeType>("SolicitacaoDocumentos");
  const [kind, setKind] = useState<DocumentRequestKind>("Autenticidade");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [productId, setProductId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const productItems = { "": t("noProduct"), ...Object.fromEntries((products.data?.items ?? []).map((p) => [p.id, p.name])) };

  return (
    <DetailSheet open={open} onClose={onClose} title={t("sendNotice")} description={t("sendNoticeHint")}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="notice-type" label={t("noticeTypeLabel")}>
          <Choice id="notice-type" value={type} onChange={(v) => setType(v as SellerNoticeType)}
            items={Object.fromEntries(NOTICE_TYPES.map((n) => [n, t(`noticeType.${n}`)]))} />
        </FormField>
        {type === "SolicitacaoDocumentos" ? (
          <FormField id="notice-kind" label={t("documentKindLabel")}>
            <Choice id="notice-kind" value={kind} onChange={(v) => setKind(v as DocumentRequestKind)}
              items={Object.fromEntries(DOCUMENT_KINDS.map((k) => [k, t(`documentKind.${k}`)]))} />
          </FormField>
        ) : null}
      </div>
      <FormField id="notice-title" label={t("noticeTitleLabel")} optional hint={t("noticeTitleHint")}>
        <Input id="notice-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
      </FormField>
      <FormField id="notice-message" label={t("noticeMessage")} hint={t("noticeMessageHint")}>
        <Textarea id="notice-message" rows={4} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="notice-product" label={t("colProduct")} optional>
          <Choice id="notice-product" value={productId} onChange={setProductId} items={productItems} />
        </FormField>
        <FormField id="notice-order" label={t("occurrenceOrder")} optional>
          <Input id="notice-order" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="PY-2026-000123" />
        </FormField>
      </div>
      <Button
        variant="primary"
        loading={createNotice.isPending}
        onClick={() =>
          createNotice.mutate(
            {
              sellerId,
              body: {
                type,
                documentKind: type === "SolicitacaoDocumentos" ? kind : null,
                title: title || null,
                message,
                productId: productId || null,
                orderNumber: orderNumber || null,
              },
            },
            {
              onSuccess: () => {
                toast.success(t("noticeSent"));
                setTitle("");
                setMessage("");
                onClose();
              },
              onError,
            },
          )
        }
      >
        {t("sendNotice")}
      </Button>
    </DetailSheet>
  );
}

/** Dossiê da loja para autoridades (Programa 8.8; Política 9.1): exporta cadastro, anúncios, pedidos e medidas. */
function DossierSheet({ open, sellerId, sellerName, onClose }: { open: boolean; sellerId: string; sellerName: string; onClose: () => void }) {
  const t = useTranslations("admin");
  const onError = useAdminErrorToast();
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <DetailSheet open={open} onClose={onClose} title={t("dossier")} description={t("dossierHint", { seller: sellerName })}>
      <FormField id="dossier-purpose" label={t("dossierPurpose")} hint={t("dossierPurposeHint")}>
        <Textarea id="dossier-purpose" rows={3} maxLength={500} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </FormField>
      <Button
        variant="primary"
        loading={busy}
        disabled={purpose.trim().length < 10}
        onClick={async () => {
          setBusy(true);
          try {
            await downloadAuthenticated(`/admin/sellers/${sellerId}/dossier`, `dossie-${sellerId.slice(0, 8)}.json`, { purpose: purpose.trim() });
            toast.success(t("dossierExported"));
            onClose();
          } catch (error) {
            onError(error);
          } finally {
            setBusy(false);
          }
        }}
      >
        <FileJson data-icon="inline-start" strokeWidth={1.75} /> {t("dossierExport")}
      </Button>
    </DetailSheet>
  );
}

function ReasonSheet({
  open,
  title,
  description,
  label,
  submitLabel,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  submitLabel: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <DetailSheet open={open} onClose={onClose} title={title} description={description}>
      <FormField id="reason-text" label={label}>
        <Textarea id="reason-text" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </FormField>
      <Button variant="primary" loading={loading} disabled={reason.trim().length < 5} onClick={() => onSubmit(reason.trim())}>
        {submitLabel}
      </Button>
    </DetailSheet>
  );
}

export function ResolveNoticeSheet({
  notice,
  loading,
  onClose,
  onSubmit,
}: {
  notice: SellerNoticeDto | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (accepted: boolean, resolution: string) => void;
}) {
  const t = useTranslations("admin");
  const [resolution, setResolution] = useState("");
  return (
    <DetailSheet open={Boolean(notice)} onClose={onClose} title={t("resolveNotice")} description={notice?.title}>
      {notice ? (
        <>
          <p className="rounded-md bg-surface-muted p-3 text-body-sm whitespace-pre-line text-foreground">{notice.message}</p>
          {notice.responseText ? (
            <p className={cn("rounded-md border border-border p-3 text-body-sm text-foreground")}>{notice.responseText}</p>
          ) : (
            <p className="text-body-sm text-foreground-secondary">{t("noResponseYet")}</p>
          )}
          <FormField id="notice-resolution" label={t("noticeResolution")} hint={t("noticeResolutionHint")}>
            <Textarea id="notice-resolution" rows={3} maxLength={1000} value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </FormField>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" className="flex-1" loading={loading} onClick={() => onSubmit(true, resolution.trim())}>
              {t("noticeAccept")}
            </Button>
            <Button variant="secondary" className="flex-1 text-danger" disabled={loading} onClick={() => onSubmit(false, resolution.trim())}>
              {t("noticeReject")}
            </Button>
          </div>
          {notice.type === "AtualizacaoCadastral" ? (
            <p className="text-caption text-foreground-secondary">{t("noticeRejectDataHint")}</p>
          ) : null}
        </>
      ) : null}
    </DetailSheet>
  );
}
