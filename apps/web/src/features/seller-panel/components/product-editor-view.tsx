"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";

import { useCreateProduct, useSellerProduct, useUpdateProduct } from "../api";
import { ProductForm } from "./product-form";

/** Novo produto. */
export function ProductCreateView() {
  const t = useTranslations("sellerPanel");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const create = useCreateProduct();
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <PanelTitle>{t("newProduct")}</PanelTitle>
      <ProductForm
        submitLabel={t("productSave")}
        submitting={create.isPending}
        serverErrors={serverErrors}
        onSubmit={(values) => {
          setServerErrors(undefined);
          create.mutate(values, {
            onSuccess: (product) => {
              toast.success(t("productCreated"));
              router.replace(`/vendedor/produtos/${product.id}`);
            },
            onError: (error) => {
              if (isApiError(error) && error.errors) setServerErrors(error.errors);
              else toast.error(isApiError(error) ? error.message : tErrors("genericTitle"));
            },
          });
        }}
      />
    </div>
  );
}

/** Edição de produto existente. */
export function ProductEditView({ productId }: { productId: string }) {
  const t = useTranslations("sellerPanel");
  const tErrors = useTranslations("errors");
  const product = useSellerProduct(productId);
  const update = useUpdateProduct(productId);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>();

  if (product.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }
  if (product.isError)
    return <ErrorState error={product.error} onRetry={() => product.refetch()} />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <PanelTitle className="mb-0 line-clamp-2">{product.data.name}</PanelTitle>
        {product.data.status === "Ativo" ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            render={<Link href={`/produto/${product.data.slug}`} target="_blank" />}
          >
            <ExternalLink data-icon="inline-start" strokeWidth={1.75} /> {t("productViewInStore")}
          </Button>
        ) : null}
      </div>
      <ProductForm
        product={product.data}
        submitLabel={t("productSave")}
        submitting={update.isPending}
        serverErrors={serverErrors}
        onSubmit={(values) => {
          setServerErrors(undefined);
          update.mutate(values, {
            onSuccess: () => toast.success(t("productSaved")),
            onError: (error) => {
              if (isApiError(error) && error.errors) setServerErrors(error.errors);
              else toast.error(isApiError(error) ? error.message : tErrors("genericTitle"));
            },
          });
        }}
      />
    </div>
  );
}
