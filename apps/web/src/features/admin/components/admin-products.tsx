"use client";

import type { AdminProductListItemDto, ProductStatus } from "@marketplace/contracts";
import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { FormField } from "@/components/shared/form-field";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FilterSelect,
  PanelCard,
  PanelToolbar,
  SearchInput,
} from "@/components/shared/panel-widgets";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { Link } from "@/i18n/navigation";
import { BLUR_DATA_URL, isDirectImage } from "@/lib/images";
import { formatMoney } from "@/lib/money";

import { useAdminProductUpdate, useAdminProducts } from "../api";
import {
  DetailSheet,
  KeyValueList,
  Pager,
  ProductStatusBadge,
  SheetSection,
  brl,
  rowButtonClass,
  useAdminErrorToast,
} from "./admin-widgets";

const STATUSES: ProductStatus[] = ["Ativo", "Rascunho", "Arquivado"];
type Filter = "all" | ProductStatus;

function ProductDetail({
  product,
  onClose,
}: {
  product: AdminProductListItemDto | null;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const format = useFormatter();
  const update = useAdminProductUpdate();
  const onError = useAdminErrorToast();
  // Estado guarda só edições; o exibido cai no produto aberto (remontado por `key` a cada produto).
  const [nameEdit, setName] = useState<string | null>(null);
  const [priceEdit, setPrice] = useState<number | null>(null);
  const [stockEdit, setStock] = useState<number | null>(null);
  const [statusEdit, setStatus] = useState<ProductStatus | null>(null);
  const name = nameEdit ?? product?.name ?? "";
  const price = priceEdit ?? product?.price.amount ?? 0;
  const stock = stockEdit ?? product?.stock ?? 0;
  const status = statusEdit ?? product?.status ?? "Ativo";

  const statusItems = Object.fromEntries(STATUSES.map((s) => [s, t(`productStatus.${s}`)]));
  const p = product;

  return (
    <DetailSheet
      open={Boolean(p)}
      onClose={onClose}
      title={p?.name ?? t("products")}
      description={p ? `${p.sellerName} · ${p.categoryName}` : undefined}
    >
      {p ? (
        <>
          <div className="flex items-center gap-4">
            <span className="relative size-20 shrink-0 overflow-hidden rounded-md bg-surface-muted">
              <Image
                src={p.thumbnailUrl}
                alt=""
                fill
                sizes="80px"
                className="object-contain"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                unoptimized={isDirectImage(p.thumbnailUrl)}
              />
            </span>
            <div className="flex flex-col gap-1">
              <ProductStatusBadge status={p.status} />
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                render={<Link href={`/produto/${p.slug}`} target="_blank" />}
              >
                <ExternalLink data-icon="inline-start" strokeWidth={1.75} /> {t("viewInStore")}
              </Button>
            </div>
          </div>
          <SheetSection title={t("sheetSummary")}>
            <KeyValueList
              items={[
                {
                  label: t("colSeller"),
                  value: (
                    <Link
                      className="text-primary"
                      href={`/admin/vendedores?q=${encodeURIComponent(p.sellerName)}`}
                    >
                      {p.sellerName}
                    </Link>
                  ),
                },
                { label: t("soldCount"), value: format.number(p.soldCount) },
                {
                  label: t("updatedAt"),
                  value: format.dateTime(new Date(p.updatedAt), "dateTime"),
                },
              ]}
            />
          </SheetSection>
          <SheetSection title={t("editProduct")}>
            <FormField id="prod-name" label={t("colProduct")}>
              <Input id="prod-name" value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField id="prod-price" label={t("colPrice")}>
                <Input
                  id="prod-price"
                  inputMode="numeric"
                  className="tabular-nums"
                  value={formatMoney({ amount: price, currency: "BRL" })}
                  onChange={(e) =>
                    setPrice(Number(e.target.value.replace(/\D/g, "").slice(0, 10) || 0))
                  }
                />
              </FormField>
              <FormField id="prod-stock" label={t("colStock")}>
                <Input
                  id="prod-stock"
                  type="number"
                  min={0}
                  className="tabular-nums"
                  value={stock}
                  onChange={(e) => setStock(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
                />
              </FormField>
            </div>
            <FormField id="prod-status" label={t("colStatus")} hint={t("productStatusHint")}>
              <Select
                value={status}
                onValueChange={(v) => setStatus((v as ProductStatus) ?? "Ativo")}
                items={statusItems}
              >
                <SelectTrigger id="prod-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`productStatus.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <Button
              variant="primary"
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  { id: p.id, body: { name, priceAmount: price, stock, status } },
                  {
                    onSuccess: () => {
                      toast.success(t("saved"));
                      onClose();
                    },
                    onError,
                  },
                )
              }
            >
              {tc("save")}
            </Button>
          </SheetSection>
        </>
      ) : null}
    </DetailSheet>
  );
}

export function AdminProducts() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminProductListItemDto | null>(null);
  const debounced = useDebouncedValue(query, 300);
  const list = useAdminProducts({
    q: debounced || undefined,
    status: filter === "all" ? undefined : filter,
    page,
    pageSize: 25,
  });
  const items: Record<Filter, string> = {
    all: t("filterAllStatus"),
    Ativo: t("productStatus.Ativo"),
    Rascunho: t("productStatus.Rascunho"),
    Arquivado: t("productStatus.Arquivado"),
  };

  return (
    <div>
      <PanelTitle>{t("products")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-products-search"
          label={t("searchProducts")}
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          className="sm:w-80"
        />
        <FilterSelect
          id="admin-products-state"
          label={t("filterStatus")}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          items={items}
          className="sm:w-56"
        />
      </PanelToolbar>
      {list.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          illustration="search"
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
            >
              {t("clearFilters")}
            </Button>
          }
        />
      ) : (
        <>
          <PanelCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colProduct")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colSeller")}</TableHead>
                  <TableHead className="text-right">{t("colPrice")}</TableHead>
                  <TableHead className="text-right">{t("colStock")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((p) => (
                  <TableRow key={p.id} className={rowButtonClass()} onClick={() => setSelected(p)}>
                    <TableCell>
                      <button
                        type="button"
                        className="flex items-center gap-3 rounded-sm text-left focus-ring"
                      >
                        <span className="relative size-10 shrink-0 overflow-hidden rounded-sm bg-surface-muted">
                          <Image
                            src={p.thumbnailUrl}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-contain"
                            placeholder="blur"
                            blurDataURL={BLUR_DATA_URL}
                            unoptimized={isDirectImage(p.thumbnailUrl)}
                          />
                        </span>
                        <span className="line-clamp-2 max-w-[200px] font-medium sm:max-w-none">
                          {p.name}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="hidden text-foreground-secondary md:table-cell">
                      {p.sellerName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brl(p.price.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format.number(p.stock)}
                    </TableCell>
                    <TableCell>
                      <ProductStatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </PanelCard>
          <Pager
            page={list.data.page}
            pageSize={list.data.pageSize}
            totalCount={list.data.totalCount}
            onChange={setPage}
          />
        </>
      )}
      <ProductDetail
        key={selected?.id ?? "none"}
        product={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
