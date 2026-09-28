"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { PanelTitle } from "@/components/layout/panel-shell";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PanelCard, PanelToolbar, SearchInput } from "@/components/shared/panel-widgets";
import { useDebouncedValue } from "@/hooks/use-debounce";

import { useAdminAudit } from "../api";
import { Pager } from "./admin-widgets";

/** Trilha de auditoria: quem fez o quê e quando (logins, exportações, ações do admin). */
export function AdminAudit() {
  const t = useTranslations("admin");
  const format = useFormatter();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(query, 300);
  const list = useAdminAudit({ q: debounced || undefined, page, pageSize: 40 });

  return (
    <div>
      <PanelTitle>{t("audit")}</PanelTitle>
      <PanelToolbar>
        <SearchInput
          id="admin-audit-search"
          label={t("searchAudit")}
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPage(1);
          }}
          className="sm:w-96"
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
        />
      ) : (
        <>
          <PanelCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colWhen")}</TableHead>
                  <TableHead>{t("colAction")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("colWho")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("colTarget")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-foreground-secondary tabular-nums">
                      {format.dateTime(new Date(a.occurredAt), "dateTime")}
                    </TableCell>
                    <TableCell className="font-medium">{a.action}</TableCell>
                    <TableCell className="hidden text-foreground-secondary sm:table-cell">
                      {a.userEmail ?? "—"}
                    </TableCell>
                    <TableCell className="hidden max-w-[240px] truncate text-foreground-secondary md:table-cell">
                      {a.target ?? "—"}
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
    </div>
  );
}
