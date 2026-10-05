"use client";

import type { SellerStatus } from "@marketplace/contracts";
import { ExternalLink } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { FormField } from "@/components/shared/form-field";
import { ReputationMeter } from "@/components/shared/seller-badge";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  FilterSelect,
  PanelCard,
  PanelToolbar,
  SearchInput,
} from "@/components/shared/panel-widgets";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { Link } from "@/i18n/navigation";

import { useAdminSeller, useAdminSellerUpdate, useAdminSellers } from "../api";
import { OrdersTable } from "./admin-orders";
import {
  DetailSheet,
  DetailSkeleton,
  KeyValueList,
  Pager,
  PayoutStatusBadge,
  SellerStatusBadge,
  SheetSection,
  brl,
  rowButtonClass,
  useAdminErrorToast,
} from "./admin-widgets";
import { SellerVerificationSection } from "./admin-compliance";

const STATUSES: SellerStatus[] = ["Aprovado", "Pendente", "Suspenso"];
type Filter = "all" | SellerStatus;

function SellerDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const format = useFormatter();
  const detail = useAdminSeller(id);
  const update = useAdminSellerUpdate();
  const onError = useAdminErrorToast();
  // Estado guarda só edições; o exibido cai no dado carregado (remontado por `key` a cada loja).
  const [nameEdit, setName] = useState<string | null>(null);
  const [cityEdit, setCity] = useState<string | null>(null);
  const [descriptionEdit, setDescription] = useState<string | null>(null);
  const [statusEdit, setStatus] = useState<SellerStatus | null>(null);
  const [reputationEdit, setReputation] = useState<number | null>(null);
  const [officialEdit, setOfficial] = useState<boolean | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const d = detail.data;
  const name = nameEdit ?? d?.summary.name ?? "";
  const city = cityEdit ?? d?.summary.city ?? "";
  const description = descriptionEdit ?? d?.description ?? "";
  const status = statusEdit ?? d?.summary.status ?? "Aprovado";
  const reputation = reputationEdit ?? d?.summary.reputationLevel ?? 3;
  const official = officialEdit ?? d?.summary.isOfficialStore ?? false;

  const statusItems = Object.fromEntries(STATUSES.map((s) => [s, t(`sellerStatus.${s}`)]));
  const repItems = Object.fromEntries(
    [1, 2, 3, 4, 5].map((n) => [String(n), t("reputationLevel", { level: n })]),
  );

  return (
    <DetailSheet
      open={Boolean(id)}
      onClose={onClose}
      title={d?.summary.name ?? t("sellers")}
      description={d ? `RUC ${d.summary.ruc} · ${d.summary.city}` : undefined}
    >
      {detail.isPending ? (
        <DetailSkeleton />
      ) : detail.isError ? (
        <ErrorState error={detail.error} compact />
      ) : d ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SellerStatusBadge status={d.summary.status} />
            {d.summary.isOfficialStore ? <Badge variant="primary">{t("official")}</Badge> : null}
            <ReputationMeter level={d.summary.reputationLevel} />
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              render={<Link href={`/loja/${d.summary.slug}`} target="_blank" />}
            >
              <ExternalLink data-icon="inline-start" strokeWidth={1.75} /> {t("viewStore")}
            </Button>
          </div>

          <SheetSection title={t("sheetSummary")}>
            <KeyValueList
              items={[
                {
                  label: t("owner"),
                  value: d.summary.ownerEmail ? (
                    <Link
                      className="text-primary"
                      href={`/admin/compradores?q=${encodeURIComponent(d.summary.ownerEmail)}`}
                    >
                      {d.summary.ownerEmail}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: t("memberSince"),
                  value: format.dateTime(new Date(d.summary.memberSince), "short"),
                },
                { label: t("colProducts"), value: format.number(d.summary.productCount) },
                { label: t("colOrders"), value: format.number(d.summary.ordersCount) },
                { label: t("colSales"), value: brl(d.summary.gross30d.amount) },
                { label: t("openDisputes"), value: format.number(d.summary.openDisputes) },
                { label: t("rating"), value: `${d.rating.toFixed(1)} (${d.reviewCount})` },
                {
                  label: t("categories"),
                  value: d.categories.map((c) => c.name).join(", ") || "—",
                },
              ]}
            />
          </SheetSection>

          <SellerVerificationSection detail={d} />

          <SheetSection title={t("editSeller")}>
            <FormField id="seller-status" label={t("colStatus")} hint={t("sellerStatusHint")}>
              <Select
                value={status}
                onValueChange={(v) => setStatus((v as SellerStatus) ?? "Aprovado")}
                items={statusItems}
              >
                <SelectTrigger id="seller-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`sellerStatus.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="seller-rep" label={t("reputation")}>
                <Select
                  value={String(reputation)}
                  onValueChange={(v) => setReputation(Number(v ?? 3))}
                  items={repItems}
                >
                  <SelectTrigger id="seller-rep" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {t("reputationLevel", { level: n })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 text-body-sm sm:mt-7">
                <span>{t("official")}</span>
                <Switch checked={official} onCheckedChange={setOfficial} />
              </label>
            </div>
            {status === "Suspenso" && d.summary.status !== "Suspenso" ? (
              <FormField id="seller-suspension" label={t("suspensionReason")} hint={t("suspensionReasonHint")}>
                <Textarea
                  id="seller-suspension"
                  rows={2}
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                />
              </FormField>
            ) : null}
            <FormField id="seller-name" label={t("colSeller")}>
              <Input id="seller-name" value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField id="seller-city" label={t("city")}>
              <Input id="seller-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </FormField>
            <FormField id="seller-desc" label={t("description")}>
              <Textarea
                id="seller-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
            <Button
              variant="primary"
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  {
                    id: d.summary.id,
                    body: {
                      name,
                      city,
                      description,
                      status,
                      reputationLevel: reputation,
                      isOfficialStore: official,
                      suspensionReason: suspensionReason.trim() || null,
                    },
                  },
                  { onSuccess: () => toast.success(t("saved")), onError },
                )
              }
            >
              {tc("save")}
            </Button>
          </SheetSection>

          <SheetSection title={t("recentOrders")}>
            {d.recentOrders.length ? (
              <PanelCard>
                <OrdersTable orders={d.recentOrders} />
              </PanelCard>
            ) : (
              <p className="text-body-sm text-foreground-secondary">{t("noOrders")}</p>
            )}
          </SheetSection>

          <SheetSection title={t("payouts")}>
            <ul className="divide-y divide-border rounded-md border border-border text-body-sm">
              {d.recentPayouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate">
                    {p.orderNumber} ·{" "}
                    <span className="text-foreground-secondary">
                      {format.dateTime(new Date(p.scheduledFor), "short")}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">
                    {brl(p.net.amount)} <PayoutStatusBadge status={p.status} />
                  </span>
                </li>
              ))}
              {d.recentPayouts.length === 0 ? (
                <li className="px-3 py-2 text-foreground-secondary">—</li>
              ) : null}
            </ul>
          </SheetSection>
        </>
      ) : null}
    </DetailSheet>
  );
}

export function AdminSellers() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const debounced = useDebouncedValue(query, 300);
  const list = useAdminSellers({
    q: debounced || undefined,
    status: filter === "all" ? undefined : filter,
    page,
    pageSize: 25,
  });
  const items: Record<Filter, string> = {
    all: t("filterAllStatus"),
    Aprovado: t("sellerStatus.Aprovado"),
    Pendente: t("sellerStatus.Pendente"),
    Suspenso: t("sellerStatus.Suspenso"),
  };

  return (
    <div>
      <PanelTitle>{t("sellers")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-sellers-search"
          label={t("searchSellers")}
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          className="sm:w-80"
        />
        <FilterSelect
          id="admin-sellers-state"
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
                  <TableHead>{t("colSeller")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("colRuc")}</TableHead>
                  <TableHead className="text-right">{t("colProducts")}</TableHead>
                  <TableHead className="text-right">{t("colSales")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((s) => (
                  <TableRow
                    key={s.id}
                    className={rowButtonClass()}
                    onClick={() => setSelected(s.id)}
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="block max-w-[180px] truncate rounded-sm text-left font-medium focus-ring"
                      >
                        {s.name}
                      </button>
                      <span className="block text-caption text-foreground-secondary">
                        {s.city}
                        {s.openDisputes
                          ? ` · ${t("disputesCount", { count: s.openDisputes })}`
                          : ""}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-foreground-secondary tabular-nums sm:table-cell">
                      {s.ruc}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format.number(s.productCount)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {brl(s.gross30d.amount)}
                    </TableCell>
                    <TableCell>
                      <SellerStatusBadge status={s.status} />
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
      <SellerDetail key={selected ?? "none"} id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
