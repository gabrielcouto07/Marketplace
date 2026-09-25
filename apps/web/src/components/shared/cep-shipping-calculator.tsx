"use client";

import type { ShippingQuoteDto, ShippingQuoteItem } from "@marketplace/contracts";
import { Loader2, MapPin, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
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

/** Cálculo de frete por CEP (mock): mostra opções com preço e faixa de dias úteis. Persiste o último CEP. */
export function CepShippingCalculator({ sellerId, items, className, onQuote }: CepShippingCalculatorProps) {
  const t = useTranslations("product");
  const tc = useTranslations("common");
  // CEP salvo: "" no servidor, valor do localStorage no cliente (sem setState em effect).
  const storedCep = useSyncExternalStore(() => () => {}, readStoredCep, () => "");
  const [typedCep, setTypedCep] = useState<string | null>(null);
  const cep = typedCep ?? formatCep(storedCep);
  const setCep = (value: string) => setTypedCep(value);
  const [touched, setTouched] = useState(false);
  const quote = useShippingQuoteMutation();

  const valid = isValidCep(cep);
  const itemsKey = items.map((i) => `${i.productId}:${i.variantId ?? "-"}:${i.quantity}`).join("|");

  // Re-cota automaticamente quando a variação/quantidade muda e já havia cotação.
  useEffect(() => {
    if (quote.data && valid) quote.mutate({ postalCode: onlyDigits(cep), sellerId, items });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, sellerId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    storeCep(cep);
    quote.mutate({ postalCode: onlyDigits(cep), sellerId, items }, { onSuccess: (data) => onQuote?.(data) });
  };

  return (
    <section className={cn("rounded-xl border border-border bg-card p-4", className)} aria-labelledby="cep-calc-title">
      <h2 id="cep-calc-title" className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Truck className="size-4 text-primary" aria-hidden /> {t("shippingTitle")}
      </h2>
      <form onSubmit={submit} className="flex gap-2" noValidate>
        <label className="flex-1">
          <span className="sr-only">{t("cepLabel")}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder={t("cepPlaceholder")}
            value={cep}
            maxLength={9}
            aria-invalid={touched && !valid ? true : undefined}
            aria-describedby="cep-error"
            onChange={(e) => setCep(formatCep(e.target.value))}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={quote.isPending}>
          {quote.isPending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {t("calculate")}
        </Button>
      </form>
      {touched && !valid ? (
        <p id="cep-error" className="mt-1 text-xs text-destructive">
          {t("invalidCep")}
        </p>
      ) : null}
      <a
        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
        target="_blank"
        rel="noreferrer noopener"
        className="mt-1 inline-block text-xs text-primary hover:underline"
      >
        {t("dontKnowCep")}
      </a>

      {quote.isError ? (
        <ErrorState error={quote.error} compact className="mt-3" onRetry={() => quote.mutate({ postalCode: onlyDigits(cep), sellerId, items })} />
      ) : null}

      {quote.data ? (
        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" aria-hidden /> {quote.data.destination.city}, {quote.data.destination.state} · CEP {formatCep(quote.data.postalCode)}
          </p>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {quote.data.options.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{o.service}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.carrier} · {tc("businessDays", { min: o.estimatedDays.min, max: o.estimatedDays.max })}
                  </p>
                  {o.description ? <p className="text-[11px] text-muted-foreground">{o.description}</p> : null}
                </div>
                <p className={cn("shrink-0 text-sm font-bold", o.price.amount === 0 && "text-success")}>
                  {o.price.amount === 0 ? t("freeShippingLabel") : formatMoney(o.price)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
