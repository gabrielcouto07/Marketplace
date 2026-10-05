"use client";

import type { AddressDto } from "@marketplace/contracts";
import { MapPin, Plus, TriangleAlert } from "lucide-react";
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
import { type useAddresses, useCreateAddress, useUpdateAddress } from "@/features/account/api";
import { AddressForm } from "@/features/account/components/address-form";
import { useCurrentUser } from "@/features/auth/store";
import { CheckoutSection, OptionCard } from "@/features/checkout/components/checkout-section";
import { isApiError } from "@/lib/api/errors";
import { formatCep, formatCpf } from "@/lib/validation/documents";

interface AddressSectionProps {
  addresses: ReturnType<typeof useAddresses>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * 1. Endereço de entrega: radio cards + "Novo endereço" em bottom sheet. Endereço sem o CPF de quem recebe (cadastrado
 * antes do Remessa Conforme) não segue para o pagamento: o aviso abre o mesmo formulário para completar ali mesmo.
 */
export function AddressSection({ addresses, selectedId, onSelect }: AddressSectionProps) {
  const t = useTranslations("checkout");
  const tAccount = useTranslations("account");
  const user = useCurrentUser();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AddressDto | null>(null);
  const selected = addresses.data?.find((a) => a.id === selectedId);
  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const formError = editing ? updateAddress.error : createAddress.error;

  return (
    <CheckoutSection
      id="checkout-address"
      title={t("addressTitle")}
      action={
        <Button variant="ghost" size="sm" onClick={openNew}>
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
          <Button variant="secondary" onClick={openNew}>
            <Plus data-icon="inline-start" strokeWidth={1.75} /> {t("addAddress")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
                {a.recipientCpf ? null : (
                  <span className="text-caption font-medium text-warning">{t("addressMissingCpf")}</span>
                )}
              </span>
            </OptionCard>
          ))}
        </RadioGroup>
        {selected && !selected.recipientCpf ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-3 rounded-md bg-warning-soft p-3 text-body-sm text-foreground"
          >
            <p className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={1.75} aria-hidden />
              {t("addressMissingCpfHint")}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(selected);
                setSheetOpen(true);
              }}
            >
              {t("addressMissingCpfAction")}
            </Button>
          </div>
        ) : null}
        </div>
      )}

      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <BottomSheetContent className="sm:mx-auto sm:max-w-lg">
          <BottomSheetHeader>
            <BottomSheetTitle>{editing ? tAccount("editAddress") : t("newAddress")}</BottomSheetTitle>
            {editing ? null : <BottomSheetDescription>{t("newAddressHint")}</BottomSheetDescription>}
          </BottomSheetHeader>
          <BottomSheetBody className="py-4">
            <AddressForm
              key={editing?.id ?? "new"}
              submitting={createAddress.isPending || updateAddress.isPending}
              submitLabel={t("useThisAddress")}
              serverErrors={isApiError(formError) ? formError.errors : undefined}
              defaultValues={
                editing
                  ? {
                      label: editing.label,
                      recipientName: editing.recipientName,
                      postalCode: editing.postalCode,
                      street: editing.street,
                      number: editing.number,
                      complement: editing.complement ?? "",
                      neighborhood: editing.neighborhood,
                      city: editing.city,
                      state: editing.state,
                      phone: editing.phone ?? "",
                      recipientCpf: editing.recipientCpf ? formatCpf(editing.recipientCpf) : "",
                      isDefault: editing.isDefault,
                    }
                  : {
                      recipientName: user?.fullName ?? "",
                      phone: user?.phone ?? "",
                    }
              }
              onSubmit={(values) =>
                editing
                  ? updateAddress.mutate(
                      { id: editing.id, body: values },
                      {
                        onSuccess: (updated) => {
                          onSelect(updated.id);
                          setSheetOpen(false);
                          setEditing(null);
                          toast.success(tAccount("addressSaved"));
                        },
                        onError: (err) => toast.error(isApiError(err) ? err.message : t("orderFailed")),
                      },
                    )
                  : createAddress.mutate(values, {
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
