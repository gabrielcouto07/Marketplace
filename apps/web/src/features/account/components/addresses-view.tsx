"use client";

import type { AddressDto, AddressInput } from "@marketplace/contracts";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/store-shell";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddresses, useCreateAddress, useDeleteAddress, useUpdateAddress } from "@/features/account/api";
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
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : addresses.isError ? (
        <ErrorState error={addresses.error} onRetry={() => addresses.refetch()} />
      ) : addresses.data.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={t("noAddresses")}
          description={t("noAddressesHint")}
          action={
            <Button variant="cta" onClick={openNew}>
              <Plus data-icon="inline-start" /> {t("addAddress")}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {addresses.data.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <MapPin className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {a.label}
                    {a.isDefault ? (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">{t("default")}</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-muted-foreground">{a.recipientName}</p>
                  <p className="text-sm">
                    {a.street}, {a.number}
                    {a.complement ? ` – ${a.complement}` : ""}
                  </p>
                  <p className="text-sm">
                    {a.neighborhood} · {a.city}/{a.state} · CEP {formatCep(a.postalCode)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(a)}>
                  <Pencil data-icon="inline-start" /> {tc("edit")}
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => setDeleting(a)}>
                  <Trash2 data-icon="inline-start" /> {tc("delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {addresses.data && addresses.data.length > 0 ? (
        <Button variant="cta" size="lg" onClick={openNew}>
          <Plus data-icon="inline-start" /> {t("addAddress")}
        </Button>
      ) : null}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-2xl pb-safe sm:mx-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editing ? t("editAddress") : t("addAddress")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
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
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteAddressConfirm")}</DialogTitle>
            <DialogDescription>
              {deleting ? `${deleting.label} — ${deleting.street}, ${deleting.number}` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={remove.isPending}>
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
