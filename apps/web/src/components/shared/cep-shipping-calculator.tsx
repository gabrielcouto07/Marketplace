"use client";

import type { ShippingQuoteDto, ShippingQuoteItem } from "@marketplace/contracts";
import { Loader2, MapPin } from "lucide-react";
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

/**
 * Cálculo de frete por CEP (mock), pensado para viver dentro de um card: input branco com
 * borda 1,5 px + botão azul-suave, opções com preço e faixa de dias úteis. Persiste o último CEP.
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
  const setCep = (value: string) => setTypedCep(value);
  const [touched, setTouched] = useState(false);
  const quote = useShippingQuoteMutation();

  const valid = isValidCep(cep);
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
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder={t("cepPlaceholder")}
            value={cep}
            maxLength={9}
            aria-invalid={touched && !valid ? true : undefined}
            aria-describedby={touched && !valid ? "cep-error" : undefined}
            onChange={(e) => setCep(formatCep(e.target.value))}
            className="h-12 w-full rounded-lg border-[1.5px] border-input bg-card px-3.5 text-[15px] font-semibold tabular-nums transition-colors outline-none placeholder:font-medium placeholder:text-placeholder focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/15"
          />
        </label>
        <Button type="submit" variant="soft" disabled={quote.isPending}>
          {quote.isPending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {t("calculate")}
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {touched && !valid ? (
          <p id="cep-error" className="text-xs font-medium text-destructive">
            {t("invalidCep")}
          </p>
        ) : (
          <span />
        )}
        <a
          href="https://buscacepinter.correios.com.br/app/endereco/index.php"
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs font-bold text-primary hover:underline"
        >
          {t("dontKnowCep")}
        </a>
      </div>

      {quote.isError ? (
        <ErrorState
          error={quote.error}
          compact
          className="mt-1"
          onRetry={() => quote.mutate({ postalCode: onlyDigits(cep), sellerId, items })}
        />
      ) : null}

      {quote.data ? (
        <div className="mt-1 flex animate-rise flex-col gap-2">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden /> {quote.data.destination.city},{" "}
            {quote.data.destination.state} · CEP {formatCep(quote.data.postalCode)}
          </p>
          <ul className="flex flex-col divide-y divide-card overflow-hidden rounded-lg bg-surface">
            {quote.data.options.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold">{o.service}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.carrier} ·{" "}
                    {tc("businessDays", { min: o.estimatedDays.min, max: o.estimatedDays.max })}
                  </p>
                  {o.description ? (
                    <p className="text-[11.5px] text-muted-foreground">{o.description}</p>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-extrabold tabular-nums",
                    o.price.amount === 0 && "text-success",
                  )}
                >
                  {o.price.amount === 0 ? t("freeShippingLabel") : formatMoney(o.price)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
