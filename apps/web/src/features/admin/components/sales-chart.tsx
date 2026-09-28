"use client";

import type { AdminSalesPointDto } from "@marketplace/contracts";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { brl } from "./admin-widgets";

/**
 * Histórico de vendas (30 dias), série única: barras finas em `primary`, topo arredondado, 2 px de vão,
 * eixo recessivo, tooltip por barra e tabela oculta para leitores de tela.
 */
export function SalesChart({ points }: { points: AdminSalesPointDto[] }) {
  const t = useTranslations("admin");
  const format = useFormatter();
  const id = useId();
  const [active, setActive] = useState<number | null>(null);

  const width = 600;
  const height = 180;
  const padX = 8;
  const padTop = 24;
  const padBottom = 24;
  const max = Math.max(1, ...points.map((p) => p.amount.amount));
  const slot = (width - padX * 2) / Math.max(1, points.length);
  const barW = Math.max(4, slot - 2);
  const plotH = height - padTop - padBottom;
  const y = (v: number) => padTop + plotH - (v / max) * plotH;
  const total = points.reduce((s, p) => s + p.amount.amount, 0);
  const activePoint = active === null ? null : points[active];

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="text-body-sm text-foreground-secondary">{t("salesChartTitle")}</span>
        <span className="text-body-sm font-medium text-foreground tabular-nums">{brl(total)}</span>
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-44 w-full"
          role="img"
          aria-labelledby={`${id}-title`}
          onMouseLeave={() => setActive(null)}
        >
          <title id={`${id}-title`}>{t("salesChartAria")}</title>
          {[0.5, 1].map((f) => (
            <line
              key={f}
              x1={padX}
              x2={width - padX}
              y1={y(max * f)}
              y2={y(max * f)}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}
          <line
            x1={padX}
            x2={width - padX}
            y1={y(0)}
            y2={y(0)}
            className="stroke-border-strong"
            strokeWidth={1}
          />
          {points.map((p, i) => {
            const x = padX + i * slot + (slot - barW) / 2;
            const top = y(p.amount.amount);
            const h = Math.max(p.amount.amount > 0 ? 3 : 0, y(0) - top);
            const isActive = active === i;
            return (
              <g key={p.date}>
                <rect
                  x={padX + i * slot}
                  y={padTop}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  tabIndex={0}
                  aria-label={`${format.dateTime(new Date(p.date), { day: "2-digit", month: "short" })}: ${brl(p.amount.amount)}`}
                />
                {h > 0 ? (
                  <rect
                    x={x}
                    y={top}
                    width={barW}
                    height={h}
                    rx={4}
                    className={isActive ? "fill-primary-hover" : "fill-primary"}
                    pointerEvents="none"
                  />
                ) : null}
              </g>
            );
          })}
          {points.map((p, i) =>
            i % 7 === 0 || (i === points.length - 1 && (points.length - 1) % 7 >= 3) ? (
              <text
                key={`l-${p.date}`}
                x={padX + i * slot + slot / 2}
                y={height - 6}
                textAnchor="middle"
                className="fill-foreground-muted text-[11px]"
              >
                {format.dateTime(new Date(p.date), { day: "2-digit", month: "2-digit" })}
              </text>
            ) : null,
          )}
        </svg>
        {activePoint ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 rounded-md border border-border bg-surface px-3 py-2 text-caption text-foreground shadow-md"
          >
            <span className="text-foreground-secondary">
              {format.dateTime(new Date(activePoint.date), { day: "2-digit", month: "short" })}
            </span>{" "}
            <span className="font-medium tabular-nums">{brl(activePoint.amount.amount)}</span>{" "}
            <span className="text-foreground-secondary">
              · {t("salesChartOrders", { count: activePoint.orders })}
            </span>
          </div>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>{t("salesChartAria")}</caption>
        <thead>
          <tr>
            <th>{t("colDate")}</th>
            <th>{t("colTotal")}</th>
            <th>{t("orders")}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{format.dateTime(new Date(p.date), "short")}</td>
              <td>{brl(p.amount.amount)}</td>
              <td>{p.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
