"use client";

import type { ShippingQuoteDto, ShippingQuoteItem } from "@marketplace/contracts";
import { AlertCircle, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShippingQuoteMutation } from "@/features/shipping/api";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { formatCep, isValidCep, onlyDigits } from "@/lib/validation/documents";

const CEP_STORAGE_KEY = "mktpy.cep";

export function readStoredCep(): string {
  try {
    return localStorage.getItem(CEP_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeCep(cep: string): void {
  try {
    localStorage.setItem(CEP_STORAGE_KEY, onlyDigits(cep));
  } catch {
    /* ignore */
  }
}

interface CepShippingCalculatorProps {
  sellerId: string;
  items: ShippingQuoteItem[];
  className?: string;
  onQuote?: (quote: ShippingQuoteDto) => void;
}

/**
 * Cálculo de frete por CEP (DESIGN.md › Formulários): input com máscara + botão primary
 * "Calcular"; validação no envio; opções em lista `divide-y` com transportadora, prazo em dias
 * úteis e preço em tabular-nums. Persiste o último CEP para reaproveitar na home e no checkout.
 */
export function CepShippingCalculator({
  sellerId,
  items,
  className,
  onQuote,
}: CepShippingCalculatorProps) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  // CEP salvo: "" no servidor, valor do localStorage no cliente (sem setState em effect).
  const storedCep = useSyncExternalStore(
    () => () => {},
    readStoredCep,
    () => "",
  );
  const [typedCep, setTypedCep] = useState<string | null>(null);
  const cep = typedCep ?? formatCep(storedCep);
  const [touched, setTouched] = useState(false);
  const quote = useShippingQuoteMutation();

  const valid = isValidCep(cep);
  const invalid = touched && !valid;
  const itemsKey = items.map((i) => `${i.productId}:${i.variantId ?? "-"}:${i.quantity}`).join("|");

  // Re-cota automaticamente quando a variação/quantidade muda e já havia cotação.
  useEffect(() => {
    if (quote.data && valid)
      quote.mutate(
        { postalCode: onlyDigits(cep), sellerId, items },
        { onSuccess: (data) => onQuote?.(data) },
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, sellerId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    storeCep(cep);
    quote.mutate(
      { postalCode: onlyDigits(cep), sellerId, items },
      { onSuccess: (data) => onQuote?.(data) },
    );
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <form onSubmit={submit} className="flex gap-2" noValidate>
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t("cepLabel")}</span>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder={t("cepPlaceholder")}
            value={cep}
            maxLength={9}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? "cep-error" : undefined}
            onChange={(e) => setTypedCep(formatCep(e.target.value))}
            className="tabular-nums"
          />
        </label>
        <Button type="submit" variant="primary" loading={quote.isPending}>
          {t("calculate")}
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {invalid ? (
          <p id="cep-error" className="flex items-center gap-1 text-caption text-danger">
            <AlertCircle className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {t("invalidCep")}
          </p>
        ) : (
          <span />
        )}
        <a
          href="https://buscacepinter.correios.com.br/app/endereco/index.php"
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-sm text-caption text-primary underline-offset-4 focus-ring hover:underline"
        >
          {t("dontKnowCep")}
        </a>
      </div>

      {quote.isError ? (
        <ErrorState
          error={quote.error}
          compact
          onRetry={() => quote.mutate({ postalCode: onlyDigits(cep), sellerId, items })}
        />
      ) : null}

      {quote.data ? (
        <div className="flex flex-col gap-2 pt-2">
          <p className="flex items-center gap-1 text-caption text-foreground-secondary">
            <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            {quote.data.destination.city}, {quote.data.destination.state} · CEP{" "}
            <span className="tabular-nums">{formatCep(quote.data.postalCode)}</span>
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {quote.data.options.map((o) => {
              const free = o.price.amount === 0;
              return (
                <li key={o.id} className="flex items-center justify-between gap-4 py-3 last:pb-0">
                  <div className="flex min-w-0 flex-col">
                    <p className="text-body-sm font-medium text-foreground">{o.service}</p>
                    <p className="text-caption text-foreground-secondary">
                      {o.carrier} ·{" "}
                      {tc("businessDays", { min: o.estimatedDays.min, max: o.estimatedDays.max })}
                    </p>
                    {o.description ? (
                      <p className="text-caption text-foreground-muted">{o.description}</p>
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-body-sm font-medium tabular-nums",
                      free ? "text-success" : "text-foreground",
                    )}
                  >
                    {free ? t("freeShippingLabel") : formatMoney(o.price)}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
