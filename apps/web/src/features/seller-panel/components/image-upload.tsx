"use client";

import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/errors";
import { BLUR_DATA_URL, isDirectImage } from "@/lib/images";
import { cn } from "@/lib/utils";

import { uploadImage } from "../api";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 8 * 1024 * 1024;

interface UploadedImage {
  url: string;
  storageKey: string;
}

/**
 * Envia um arquivo e devolve a URL pública (ou null em falha, já com toast). `busy` conta uploads em voo,
 * então vários arquivos em paralelo só liberam o botão quando o último termina.
 */
function useUploadHandler(onDone?: (url: string, storageKey: string) => void) {
  const t = useTranslations("sellerPanel");
  const [pending, setPending] = useState(0);
  const upload = async (file: File): Promise<UploadedImage | null> => {
    if (!ACCEPT.split(",").includes(file.type)) {
      toast.error(t("uploadInvalidType"));
      return null;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t("uploadTooLarge"));
      return null;
    }
    setPending((n) => n + 1);
    try {
      const result = await uploadImage(file);
      onDone?.(result.publicUrl, result.storageKey);
      return { url: result.publicUrl, storageKey: result.storageKey };
    } catch (error) {
      toast.error(isApiError(error) ? error.message : t("uploadFailed"));
      return null;
    } finally {
      setPending((n) => n - 1);
    }
  };
  return { busy: pending > 0, upload };
}

interface SingleImageUploadProps {
  id?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  /** "square" para logo (1:1) ou "wide" para banner (3:1). */
  shape?: "square" | "wide";
  label: string;
  className?: string;
}

/** Uma imagem (logo/banner): tile clicável com preview, troca e remoção. */
export function SingleImageUpload({
  id,
  value,
  onChange,
  shape = "square",
  label,
  className,
}: SingleImageUploadProps) {
  const t = useTranslations("sellerPanel");
  const generated = useId();
  const inputId = id ?? generated;
  const inputRef = useRef<HTMLInputElement>(null);
  const { busy, upload } = useUploadHandler((url) => onChange(url));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface-muted",
          shape === "square" ? "size-28" : "aspect-[3/1] w-full",
        )}
      >
        {value ? (
          <Image
            src={value}
            alt={label}
            fill
            sizes={shape === "square" ? "112px" : "(max-width: 768px) 100vw, 640px"}
            className="object-cover"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            unoptimized={isDirectImage(value)}
          />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex size-full pressable flex-col items-center justify-center gap-1 text-caption text-foreground-secondary focus-ring"
          >
            {busy ? (
              <Loader2
                className="size-5 animate-spin text-primary"
                strokeWidth={1.75}
                aria-hidden
              />
            ) : (
              <ImagePlus className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
            )}
            {t("uploadChoose")}
          </button>
        )}
        {busy && value ? (
          <span className="absolute inset-0 grid place-items-center bg-overlay/40">
            <Loader2 className="size-6 animate-spin text-white" strokeWidth={1.75} aria-hidden />
          </span>
        ) : null}
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {value ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload data-icon="inline-start" strokeWidth={1.75} /> {t("uploadReplace")}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <Trash2 data-icon="inline-start" strokeWidth={1.75} /> {t("uploadRemove")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export interface GalleryImage {
  url: string;
  storageKey?: string | null;
}

interface GalleryUploadProps {
  value: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  max?: number;
  describedBy?: string;
  invalid?: boolean;
}

/** Galeria do produto: grade 1:1, a primeira foto é a capa; mover para a frente e remover. */
export function GalleryUpload({
  value,
  onChange,
  max = 8,
  describedBy,
  invalid,
}: GalleryUploadProps) {
  const t = useTranslations("sellerPanel");
  const inputRef = useRef<HTMLInputElement>(null);
  const { busy, upload } = useUploadHandler();
  const remaining = max - value.length;

  // Vários arquivos de uma vez: sobe todos em paralelo e acrescenta à galeria numa única atualização.
  // Chamar onChange a cada arquivo usaria o `value` capturado na seleção e sobrescreveria os anteriores.
  const uploadMany = async (files: File[]) => {
    const uploaded = (await Promise.all(files.map(upload))).filter(
      (img): img is UploadedImage => img !== null,
    );
    if (uploaded.length) onChange([...value, ...uploaded]);
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-describedby={describedBy}>
        {value.map((img, index) => (
          <li
            key={img.url}
            className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-muted"
          >
            <Image
              src={img.url}
              alt={t("uploadImageOf", { index: index + 1 })}
              fill
              sizes="(max-width: 640px) 33vw, 160px"
              className="object-contain"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              unoptimized={isDirectImage(img.url)}
            />
            {index === 0 ? (
              <span className="absolute top-1 left-1 rounded-sm bg-primary px-1.5 py-0.5 text-caption text-primary-foreground">
                {t("uploadCover")}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onChange([img, ...value.filter((_, i) => i !== index)])}
                className="absolute top-1 left-1 rounded-sm bg-surface/90 px-1.5 py-0.5 text-caption text-foreground focus-ring backdrop-blur"
              >
                {t("uploadMakeCover")}
              </button>
            )}
            <button
              type="button"
              aria-label={t("uploadRemove")}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="absolute right-1 bottom-1 grid size-8 place-items-center rounded-full bg-surface/90 text-danger focus-ring backdrop-blur"
            >
              <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
            </button>
          </li>
        ))}
        {remaining > 0 ? (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className={cn(
                "flex aspect-square w-full pressable flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-surface-muted text-caption text-foreground-secondary focus-ring",
                invalid ? "border-danger" : "border-border-strong",
              )}
            >
              {busy ? (
                <Loader2
                  className="size-5 animate-spin text-primary"
                  strokeWidth={1.75}
                  aria-hidden
                />
              ) : (
                <ImagePlus className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
              )}
              {t("uploadAdd")}
            </button>
          </li>
        ) : null}
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        aria-label={t("uploadAdd")}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, remaining);
          e.target.value = "";
          if (files.length) void uploadMany(files);
        }}
      />
      <p className="text-caption text-foreground-secondary">{t("uploadHint", { max })}</p>
    </div>
  );
}
