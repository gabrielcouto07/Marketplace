"use client";

import type { AddressDto, AddressInput } from "@marketplace/contracts";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddresses,
  useCreateAddress,
  useDeleteAddress,
  useUpdateAddress,
} from "@/features/account/api";
import { useAuthStore, useCurrentUser } from "@/features/auth/store";
import { isApiError } from "@/lib/api/errors";
import { formatCep } from "@/lib/validation/documents";

import { AddressForm } from "./address-form";
import { LoginRequired } from "./profile-view";

export function AddressesView() {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const tErrors = useTranslations("errors");
  const user = useCurrentUser();
  const hydrated = useAuthStore.persist.hasHydrated();
  const addresses = useAddresses();
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const remove = useDeleteAddress();

  const [editing, setEditing] = useState<AddressDto | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState<AddressDto | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | undefined>();

  if (!hydrated) return null;
  if (!user) return <LoginRequired next="/conta/enderecos" />;

  const openNew = () => {
    setEditing(null);
    setServerErrors(undefined);
    setSheetOpen(true);
  };
  const openEdit = (a: AddressDto) => {
    setEditing(a);
    setServerErrors(undefined);
    setSheetOpen(true);
  };

  const onSubmit = async (values: AddressInput) => {
    const handlers = {
      onSuccess: () => {
        toast.success(t("addressSaved"));
        setSheetOpen(false);
      },
      onError: (error: unknown) => {
        if (isApiError(error) && error.errors) setServerErrors(error.errors);
        else toast.error(tErrors("genericTitle"));
      },
    };
    if (editing) update.mutate({ id: editing.id, body: values }, handlers);
    else create.mutate(values, handlers);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => toast.success(t("addressDeleted")),
      onError: () => toast.error(tErrors("genericTitle")),
      onSettled: () => setDeleting(null),
    });
  };

  return (
    <PageContainer className="flex flex-col gap-4 py-4">
      {addresses.isPending ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs"
            >
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : addresses.isError ? (
        <ErrorState error={addresses.error} onRetry={() => addresses.refetch()} />
      ) : addresses.data.length === 0 ? (
        <EmptyState
          illustration="box"
          title={t("noAddresses")}
          description={t("noAddressesHint")}
          action={
            <Button variant="primary" onClick={openNew}>
              <Plus data-icon="inline-start" strokeWidth={1.75} /> {t("addAddress")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4 md:grid md:grid-cols-2">
          {addresses.data.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <p className="truncate text-title-3 text-foreground">{a.label}</p>
                  <p className="text-body-sm text-foreground-secondary">{a.recipientName}</p>
                </div>
                {a.isDefault ? <Badge variant="soft">{t("default")}</Badge> : null}
              </div>
              <p className="text-body-sm text-foreground-secondary">
                {a.street}, {a.number}
                {a.complement ? ` – ${a.complement}` : ""}
                <br />
                {a.neighborhood} · {a.city}/{a.state} ·{" "}
                <span className="tabular-nums">CEP {formatCep(a.postalCode)}</span>
              </p>
              <div className="-mb-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(a)}>
                  <Pencil data-icon="inline-start" strokeWidth={1.75} /> {tc("edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:bg-danger-soft"
                  onClick={() => setDeleting(a)}
                >
                  <Trash2 data-icon="inline-start" strokeWidth={1.75} /> {tc("delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {addresses.data && addresses.data.length > 0 ? (
        <Button variant="primary" fullWidth onClick={openNew}>
          <Plus data-icon="inline-start" strokeWidth={1.75} /> {t("addAddress")}
        </Button>
      ) : null}

      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <BottomSheetContent className="sm:mx-auto sm:max-w-lg">
          <BottomSheetHeader>
            <BottomSheetTitle>{editing ? t("editAddress") : t("addAddress")}</BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetBody className="py-4">
            <AddressForm
              key={editing?.id ?? "new"}
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
                      isDefault: editing.isDefault,
                    }
                  : undefined
              }
              onSubmit={onSubmit}
              submitting={create.isPending || update.isPending}
              serverErrors={serverErrors}
            />
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteAddressConfirm")}</DialogTitle>
            <DialogDescription>
              {deleting ? `${deleting.label} — ${deleting.street}, ${deleting.number}` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} loading={remove.isPending}>
              <Trash2 data-icon="inline-start" strokeWidth={1.75} /> {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
