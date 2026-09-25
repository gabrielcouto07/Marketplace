"use client";

import type { CheckoutGroupDto, CheckoutQuoteDto } from "@marketplace/contracts";
import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/shared/states";
import { RadioGroup } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckoutSection, OptionCard } from "@/features/checkout/components/checkout-section";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

interface ShippingSectionProps {
  hasAddress: boolean;
  quote: CheckoutQuoteDto | undefined;
  quoting: boolean;
  quoteError: unknown;
  quoteFailed: boolean;
  selection: Record<string, string>;
  onSelect: (sellerId: string, optionId: string) => void;
  onRetry: () => void;
}

/** 2. Frete por loja: um grupo de radio cards por vendedor (transportadora, prazo, preço). */
export function ShippingSection({
  hasAddress,
  quote,
  quoting,
  quoteError,
  quoteFailed,
  selection,
  onSelect,
  onRetry,
}: ShippingSectionProps) {
  const t = useTranslations("checkout");
  return (
    <CheckoutSection id="checkout-shipping" title={t("shippingTitle")}>
      {!hasAddress ? (
        <p className="text-body-sm text-foreground-secondary">{t("selectAddress")}</p>
      ) : quoteFailed && !quote ? (
        <ErrorState compact error={quoteError} onRetry={onRetry} />
      ) : !quote ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div
          className={cn("flex flex-col gap-6 transition-opacity", quoting && "opacity-60")}
          aria-busy={quoting}
        >
          {quote.groups.map((g) => (
            <ShippingGroup
              key={g.seller.id}
              group={g}
              selectedId={selection[g.seller.id] ?? g.selectedShippingOptionId}
              onSelect={(id) => onSelect(g.seller.id, id)}
            />
          ))}
        </div>
      )}
    </CheckoutSection>
  );
}

function ShippingGroup({
  group,
  selectedId,
  onSelect,
}: {
  group: CheckoutGroupDto;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("checkout");
  const tc = useTranslations("common");
  const tOrders = useTranslations("orders");
  const tCatalog = useTranslations("catalog");
  const count = group.lines.reduce((acc, l) => acc + l.quantity, 0);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-foreground-secondary">
        {group.seller.name} · {tOrders("items", { count })}
      </p>
      <RadioGroup
        aria-label={t("shippingBy", { seller: group.seller.name })}
        value={selectedId ?? undefined}
        onValueChange={(value) => {
          if (typeof value === "string") onSelect(value);
        }}
      >
        {group.shippingOptions.map((opt) => {
          const free = opt.price.amount === 0;
          return (
            <OptionCard key={opt.id} value={opt.id}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-sm font-medium text-foreground">
                  {opt.carrier} · {opt.service}
                </span>
                <span className="text-caption text-foreground-secondary">
                  {tc("businessDays", { min: opt.estimatedDays.min, max: opt.estimatedDays.max })}
                  {opt.description ? ` · ${opt.description}` : ""}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-body-sm font-medium tabular-nums",
                  free ? "text-success" : "text-foreground",
                )}
              >
                {free ? tCatalog("freeShipping") : formatMoney(opt.price)}
              </span>
            </OptionCard>
          );
        })}
      </RadioGroup>
    </div>
  );
}
