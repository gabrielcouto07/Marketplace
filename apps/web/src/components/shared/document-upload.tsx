"use client";

import type { PresignedUploadDto } from "@marketplace/contracts";
import { ExternalLink, FileText, FileUp, Loader2, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { documentHref } from "@/lib/api/download";
import { isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

export const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Link para abrir uma referência de documento: link assinado da API, exemplo público ou nada (chave sem link). */
function hrefFor(reference: string): string | null {
  if (reference.startsWith("/api/") || reference.startsWith("/images/") || /^https?:\/\//.test(reference)) return documentHref(reference);
  return null;
}

/**
 * Documento privado (PDF ou foto): sobe para o armazenamento privado da API e guarda só a referência. Nunca vai para o
 * bucket público das fotos do catálogo (Política de Vendedores 9.4). `upload` é o envio do vendedor ou do admin.
 */
export function DocumentUpload({
  id,
  value,
  onChange,
  label,
  upload,
  invalid,
  describedBy,
  className,
}: {
  id?: string;
  /** Referência gravada: chave `doc/…`, link assinado devolvido pela API ou exemplo `/images/kyc/…`. */
  value: string | null;
  onChange: (reference: string | null) => void;
  label: string;
  upload: (file: File) => Promise<PresignedUploadDto>;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const t = useTranslations("common");
  const generated = useId();
  const inputId = id ?? generated;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Depois do envio: o link assinado para conferir o arquivo e o nome original.
  const [sent, setSent] = useState<{ key: string; url: string; name: string } | null>(null);

  const pick = async (file: File) => {
    if (!DOCUMENT_ACCEPT.split(",").includes(file.type)) {
      toast.error(t("documentInvalidType"));
      return;
    }
    if (file.size > DOCUMENT_MAX_BYTES) {
      toast.error(t("documentTooLarge"));
      return;
    }
    setBusy(true);
    try {
      const result = await upload(file);
      setSent({ key: result.storageKey, url: result.publicUrl, name: file.name });
      onChange(result.storageKey);
    } catch (error) {
      toast.error(isApiError(error) ? error.message : t("documentUploadFailed"));
    } finally {
      setBusy(false);
    }
  };

  const current = value && sent?.key === value ? sent : null;
  const href = current ? documentHref(current.url) : value ? hrefFor(value) : null;
  const name = current?.name ?? (value ? t("documentOnFile") : null);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {value ? (
        <div
          className={cn(
            "flex min-h-14 items-center gap-3 rounded-md border bg-surface px-3 py-2",
            invalid ? "border-danger" : "border-border",
          )}
        >
          <FileText className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">{name}</span>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 text-body-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {t("documentOpen")}
              <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden />
            </a>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-describedby={describedBy}
          className={cn(
            "flex min-h-14 pressable items-center justify-center gap-2 rounded-md border border-dashed bg-surface-muted px-3 text-body-sm text-foreground-secondary focus-ring",
            invalid ? "border-danger" : "border-border-strong",
          )}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin text-primary" strokeWidth={1.75} aria-hidden />
          ) : (
            <FileUp className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
          )}
          {t("documentChoose")}
        </button>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={DOCUMENT_ACCEPT}
        className="sr-only"
        aria-label={label}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pick(file);
        }}
      />
      {value ? (
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
            <Upload data-icon="inline-start" strokeWidth={1.75} /> {t("documentReplace")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSent(null);
              onChange(null);
            }}
          >
            <Trash2 data-icon="inline-start" strokeWidth={1.75} /> {t("documentRemove")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Lista de anexos enviados (respostas e evidências): vários arquivos, cada um com link para conferir. */
export function DocumentList({
  values,
  onChange,
  upload,
  max = 5,
  label,
}: {
  values: Array<{ key: string; url: string; name: string }>;
  onChange: (values: Array<{ key: string; url: string; name: string }>) => void;
  upload: (file: File) => Promise<PresignedUploadDto>;
  max?: number;
  label: string;
}) {
  const t = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const add = async (files: FileList) => {
    const room = max - values.length;
    const picked = Array.from(files).slice(0, room);
    if (picked.length === 0) return;
    setBusy(true);
    const added: Array<{ key: string; url: string; name: string }> = [];
    try {
      for (const file of picked) {
        if (!DOCUMENT_ACCEPT.split(",").includes(file.type)) {
          toast.error(t("documentInvalidType"));
          continue;
        }
        if (file.size > DOCUMENT_MAX_BYTES) {
          toast.error(t("documentTooLarge"));
          continue;
        }
        const result = await upload(file);
        added.push({ key: result.storageKey, url: result.publicUrl, name: file.name });
      }
    } catch (error) {
      toast.error(isApiError(error) ? error.message : t("documentUploadFailed"));
    } finally {
      setBusy(false);
      if (added.length > 0) onChange([...values, ...added]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {values.map((file) => (
            <li key={file.key} className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
              <FileText className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
              <a
                href={documentHref(file.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-body-sm text-primary underline-offset-2 hover:underline"
              >
                {file.name}
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={t("documentRemove")}
                onClick={() => onChange(values.filter((v) => v.key !== file.key))}
              >
                <Trash2 strokeWidth={1.75} />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {values.length < max ? (
        <Button type="button" variant="secondary" size="sm" className="self-start" loading={busy} onClick={() => inputRef.current?.click()}>
          <FileUp data-icon="inline-start" strokeWidth={1.75} />
          {t("documentAdd")}
        </Button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={DOCUMENT_ACCEPT}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) void add(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
