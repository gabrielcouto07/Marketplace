"use client";

import type { OrderDto } from "@marketplace/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormField } from "@/components/shared/form-field";
import {
  BottomSheet,
  BottomSheetBody,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isApiError } from "@/lib/api/errors";
import { shipOrderSchema, type ShipOrderFormValues } from "@/lib/validation/schemas";

import { useShipOrder } from "../api";

interface ShipOrderSheetProps {
  order: OrderDto | null;
  onClose: () => void;
}

/** Postagem do pedido: transportadora + código de rastreio → status Enviado. */
export function ShipOrderSheet({ order, onClose }: ShipOrderSheetProps) {
  const t = useTranslations("sellerPanel");
  const tErrors = useTranslations("errors");
  const ship = useShipOrder();
  const { register, handleSubmit, setError, reset, formState } = useForm<ShipOrderFormValues>({
    resolver: zodResolver(shipOrderSchema),
    defaultValues: { carrier: order?.shippingOption.carrier ?? "", trackingCode: "" },
    mode: "onBlur",
  });
  const { errors } = formState;

  const submit = handleSubmit((values) => {
    if (!order) return;
    ship.mutate(
      {
        id: order.id,
        body: { carrier: values.carrier, trackingCode: values.trackingCode.toUpperCase() },
      },
      {
        onSuccess: () => {
          toast.success(t("shipSuccess", { number: order.number }));
          reset();
          onClose();
        },
        onError: (error) => {
          if (isApiError(error) && error.errors) {
            for (const [field, messages] of Object.entries(error.errors))
              setError(field as keyof ShipOrderFormValues, { message: messages[0] });
          } else toast.error(isApiError(error) ? error.message : tErrors("genericTitle"));
        },
      },
    );
  });

  return (
    <BottomSheet open={Boolean(order)} onOpenChange={(open) => !open && onClose()}>
      <BottomSheetContent>
        <form onSubmit={submit} noValidate className="flex flex-col">
          <BottomSheetHeader>
            <BottomSheetTitle>{t("shipTitle")}</BottomSheetTitle>
            <BottomSheetDescription>
              {order ? t("shipDescription", { number: order.number }) : null}
            </BottomSheetDescription>
          </BottomSheetHeader>
          <BottomSheetBody className="flex flex-col gap-4">
            <FormField id="ship-carrier" label={t("shipCarrier")} error={errors.carrier?.message}>
              <Input
                id="ship-carrier"
                placeholder={t("shipCarrierPlaceholder")}
                aria-invalid={Boolean(errors.carrier) || undefined}
                aria-describedby={errors.carrier ? "ship-carrier-error" : undefined}
                {...register("carrier")}
              />
            </FormField>
            <FormField
              id="ship-tracking"
              label={t("shipTracking")}
              error={errors.trackingCode?.message}
              hint={t("shipTrackingHint")}
            >
              <Input
                id="ship-tracking"
                placeholder="PY123456789BR"
                className="uppercase tabular-nums"
                autoComplete="off"
                aria-invalid={Boolean(errors.trackingCode) || undefined}
                aria-describedby={
                  errors.trackingCode ? "ship-tracking-error" : "ship-tracking-hint"
                }
                {...register("trackingCode")}
              />
            </FormField>
          </BottomSheetBody>
          <BottomSheetFooter>
            <Button type="submit" variant="primary" fullWidth loading={ship.isPending}>
              {t("shipConfirm")}
            </Button>
          </BottomSheetFooter>
        </form>
      </BottomSheetContent>
    </BottomSheet>
  );
}
