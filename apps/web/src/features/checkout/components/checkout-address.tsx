"use client";

import { MapPin, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { type useAddresses, useCreateAddress } from "@/features/account/api";
import { AddressForm } from "@/features/account/components/address-form";
import { useCurrentUser } from "@/features/auth/store";
import { CheckoutSection, OptionCard } from "@/features/checkout/components/checkout-section";
import { isApiError } from "@/lib/api/errors";
import { formatCep } from "@/lib/validation/documents";

interface AddressSectionProps {
  addresses: ReturnType<typeof useAddresses>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** 1. Endereço de entrega: radio cards + "Novo endereço" em bottom sheet. */
export function AddressSection({ addresses, selectedId, onSelect }: AddressSectionProps) {
  const t = useTranslations("checkout");
  const tAccount = useTranslations("account");
  const user = useCurrentUser();
  const createAddress = useCreateAddress();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <CheckoutSection
      id="checkout-address"
      title={t("addressTitle")}
      action={
        <Button variant="ghost" size="sm" onClick={() => setSheetOpen(true)}>
          <Plus data-icon="inline-start" strokeWidth={1.75} /> {t("newAddress")}
        </Button>
      }
    >
      {addresses.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : addresses.isError ? (
        <ErrorState compact error={addresses.error} onRetry={() => addresses.refetch()} />
      ) : addresses.data.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p className="flex items-start gap-2 text-body-sm text-foreground-secondary">
            <MapPin
              className="mt-0.5 size-5 shrink-0 text-primary"
              strokeWidth={1.75}
              aria-hidden
            />
            {t("noAddressDescription")}
          </p>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            <Plus data-icon="inline-start" strokeWidth={1.75} /> {t("addAddress")}
          </Button>
        </div>
      ) : (
        <RadioGroup
          aria-label={t("selectAddress")}
          value={selectedId ?? undefined}
          onValueChange={(value) => {
            if (typeof value === "string") onSelect(value);
          }}
        >
          {addresses.data.map((a) => (
            <OptionCard key={a.id} value={a.id} align="start">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="text-body-sm font-medium text-foreground">{a.label}</span>
                  {a.isDefault ? <Badge variant="soft">{tAccount("default")}</Badge> : null}
                </span>
                <span className="text-caption text-foreground-secondary">
                  {a.street}, {a.number}
                  {a.complement ? ` · ${a.complement}` : ""}
                  <br />
                  {a.neighborhood} · {a.city}/{a.state} · {formatCep(a.postalCode)}
                </span>
              </span>
            </OptionCard>
          ))}
        </RadioGroup>
      )}

      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <BottomSheetContent className="sm:mx-auto sm:max-w-lg">
          <BottomSheetHeader>
            <BottomSheetTitle>{t("newAddress")}</BottomSheetTitle>
            <BottomSheetDescription>{t("newAddressHint")}</BottomSheetDescription>
          </BottomSheetHeader>
          <BottomSheetBody className="py-4">
            <AddressForm
              submitting={createAddress.isPending}
              submitLabel={t("useThisAddress")}
              serverErrors={
                isApiError(createAddress.error) ? createAddress.error.errors : undefined
              }
              defaultValues={{
                recipientName: user?.fullName ?? "",
                phone: user?.phone ?? "",
              }}
              onSubmit={(values) =>
                createAddress.mutate(values, {
                  onSuccess: (created) => {
                    onSelect(created.id);
                    setSheetOpen(false);
                    toast.success(tAccount("addressSaved"));
                  },
                  onError: (err) => toast.error(isApiError(err) ? err.message : t("orderFailed")),
                })
              }
            />
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    </CheckoutSection>
  );
}
