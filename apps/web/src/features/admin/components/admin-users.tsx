"use client";

import type { UserRole } from "@marketplace/contracts";
import { Ban, ShieldCheck, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PanelTitle } from "@/components/layout/panel-shell";
import { FormField } from "@/components/shared/form-field";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { formatCpf, formatPhoneBr } from "@/lib/validation/documents";

import { useAdminUser, useAdminUserMutations, useAdminUsers } from "../api";
import { OrdersTable } from "./admin-orders";
import {
  DetailSheet,
  DetailSkeleton,
  KeyValueList,
  Pager,
  SheetSection,
  brl,
  rowButtonClass,
  useAdminErrorToast,
} from "./admin-widgets";

const ROLES: UserRole[] = ["Comprador", "Vendedor", "Admin"];
type RoleFilter = "all" | UserRole | "blocked";

function UserDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const format = useFormatter();
  const detail = useAdminUser(id);
  const { update, block, unblock, anonymize } = useAdminUserMutations();
  const onError = useAdminErrorToast();
  // Só as edições ficam em estado; o valor exibido cai no dado carregado. O componente é remontado
  // por `key` a cada usuário aberto, então nada precisa ser sincronizado em efeito.
  const [nameEdit, setFullName] = useState<string | null>(null);
  const [phoneEdit, setPhone] = useState<string | null>(null);
  const [rolesEdit, setRoles] = useState<UserRole[] | null>(null);
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const d = detail.data;
  const fullName = nameEdit ?? d?.summary.fullName ?? "";
  const phone = phoneEdit ?? d?.summary.phone ?? "";
  const roles = rolesEdit ?? d?.summary.roles ?? [];

  return (
    <DetailSheet
      open={Boolean(id)}
      onClose={onClose}
      title={d?.summary.fullName ?? t("buyers")}
      description={d?.summary.email}
    >
      {detail.isPending ? (
        <DetailSkeleton />
      ) : detail.isError ? (
        <ErrorState error={detail.error} compact />
      ) : d ? (
        <>
          <div className="flex flex-wrap gap-2">
            {d.summary.roles.map((r) => (
              <Badge key={r} variant={r === "Admin" ? "primary" : "soft"}>
                {t(`roles.${r}`)}
              </Badge>
            ))}
            {d.summary.blockedAt ? (
              <Badge variant="danger">
                <Ban strokeWidth={1.75} aria-hidden /> {t("blocked")}
              </Badge>
            ) : null}
          </div>

          <SheetSection title={t("sheetSummary")}>
            <KeyValueList
              items={[
                {
                  label: t("colSignup"),
                  value: format.dateTime(new Date(d.summary.createdAt), "short"),
                },
                {
                  label: t("colOrders"),
                  value: `${d.summary.ordersCount} · ${brl(d.summary.totalSpent.amount)}`,
                },
                { label: t("cpf"), value: d.cpf ? formatCpf(d.cpf) : "—" },
                {
                  label: t("phone"),
                  value: d.summary.phone ? formatPhoneBr(d.summary.phone) : "—",
                },
                {
                  label: t("loginMethods"),
                  value:
                    [d.hasPassword ? t("loginPassword") : null, d.hasGoogle ? "Google" : null]
                      .filter(Boolean)
                      .join(" · ") || "—",
                },
                { label: t("sellerOf"), value: d.summary.sellerName ?? "—" },
                {
                  label: t("consents"),
                  value: d.consents.map((c) => `${c.type} v${c.version}`).join(", ") || "—",
                },
                ...(d.blockedReason ? [{ label: t("blockReason"), value: d.blockedReason }] : []),
              ]}
            />
          </SheetSection>

          <SheetSection title={t("editUser")}>
            <FormField id="user-name" label={t("colName")}>
              <Input
                id="user-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </FormField>
            <FormField id="user-phone" label={t("phone")} optional>
              <Input
                id="user-phone"
                inputMode="tel"
                value={formatPhoneBr(phone)}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              />
            </FormField>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-body-sm font-medium text-foreground">
                {t("rolesLabel")}
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <label
                    key={r}
                    className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-body-sm has-data-checked:border-primary has-data-checked:bg-primary-soft/50"
                  >
                    <Checkbox
                      checked={roles.includes(r)}
                      onCheckedChange={(v) =>
                        setRoles(v === true ? [...roles, r] : roles.filter((x) => x !== r))
                      }
                    />
                    {t(`roles.${r}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button
              variant="primary"
              loading={update.isPending}
              onClick={() =>
                update.mutate(
                  { id: d.summary.id, body: { fullName, phone, roles } },
                  { onSuccess: () => toast.success(t("saved")), onError },
                )
              }
            >
              {tc("save")}
            </Button>
          </SheetSection>

          <SheetSection title={t("access")}>
            {d.summary.blockedAt ? (
              <Button
                variant="secondary"
                loading={unblock.isPending}
                onClick={() =>
                  unblock.mutate(d.summary.id, {
                    onSuccess: () => toast.success(t("unblocked")),
                    onError,
                  })
                }
              >
                <ShieldCheck data-icon="inline-start" strokeWidth={1.75} /> {t("unblock")}
              </Button>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  aria-label={t("blockReason")}
                  placeholder={t("blockReasonPlaceholder")}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Button
                  variant="destructive"
                  loading={block.isPending}
                  onClick={() =>
                    block.mutate(
                      { id: d.summary.id, reason: reason || null },
                      {
                        onSuccess: () => {
                          toast.success(t("blockedToast"));
                          setReason("");
                        },
                        onError,
                      },
                    )
                  }
                >
                  <Ban data-icon="inline-start" strokeWidth={1.75} /> {t("block")}
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              className="self-start text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 data-icon="inline-start" strokeWidth={1.75} /> {t("anonymize")}
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

          <SheetSection title={t("recentActivity")}>
            <ul className="divide-y divide-border rounded-md border border-border text-body-sm">
              {d.recentActivity.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 px-3 py-2">
                  <span className="truncate">
                    {a.action}
                    {a.target ? (
                      <span className="text-foreground-secondary"> · {a.target}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-foreground-secondary tabular-nums">
                    {format.dateTime(new Date(a.occurredAt), "dateTime")}
                  </span>
                </li>
              ))}
              {d.recentActivity.length === 0 ? (
                <li className="px-3 py-2 text-foreground-secondary">—</li>
              ) : null}
            </ul>
          </SheetSection>

          <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("anonymize")}</DialogTitle>
                <DialogDescription>
                  {t("anonymizeConfirm", { email: d.summary.email })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                  {tc("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  loading={anonymize.isPending}
                  onClick={() =>
                    anonymize.mutate(d.summary.id, {
                      onSuccess: () => {
                        toast.success(t("anonymized"));
                        setConfirmDelete(false);
                        onClose();
                      },
                      onError,
                    })
                  }
                >
                  {t("anonymize")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </DetailSheet>
  );
}

export function AdminBuyers() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const debounced = useDebouncedValue(query, 300);
  const list = useAdminUsers({
    q: debounced || undefined,
    role: filter === "all" || filter === "blocked" ? undefined : filter,
    blocked: filter === "blocked" ? true : undefined,
    page,
    pageSize: 25,
  });
  const items: Record<RoleFilter, string> = {
    all: t("filterAll"),
    Comprador: t("roles.Comprador"),
    Vendedor: t("roles.Vendedor"),
    Admin: t("roles.Admin"),
    blocked: t("blocked"),
  };

  return (
    <div>
      <PanelTitle>{t("buyers")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-buyers-search"
          label={t("searchBuyers")}
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          className="sm:w-80"
        />
        <FilterSelect
          id="admin-buyers-role"
          label={t("filterRole")}
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
                  <TableHead>{t("colName")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("colEmail")}</TableHead>
                  <TableHead className="text-right">{t("colOrders")}</TableHead>
                  <TableHead className="hidden text-right md:table-cell">{t("colSpent")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((u) => (
                  <TableRow
                    key={u.id}
                    className={rowButtonClass()}
                    onClick={() => setSelected(u.id)}
                  >
                    <TableCell>
                      <button
                        type="button"
                        className="block max-w-[180px] truncate rounded-sm text-left font-medium focus-ring"
                      >
                        {u.fullName}
                      </button>
                      <span className="block text-caption text-foreground-secondary sm:hidden">
                        {u.email}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-foreground-secondary sm:table-cell">
                      {u.email}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {format.number(u.ordersCount)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {brl(u.totalSpent.amount)}
                    </TableCell>
                    <TableCell>
                      <span className="flex flex-wrap gap-1">
                        {u.blockedAt ? <Badge variant="danger">{t("blocked")}</Badge> : null}
                        {u.roles
                          .filter((r) => r !== "Comprador")
                          .map((r) => (
                            <Badge key={r} variant={r === "Admin" ? "primary" : "soft"}>
                              {t(`roles.${r}`)}
                            </Badge>
                          ))}
                        {!u.blockedAt && u.roles.length === 1 ? (
                          <Badge variant="neutral">{t("roles.Comprador")}</Badge>
                        ) : null}
                      </span>
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
      <UserDetail key={selected ?? "none"} id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
