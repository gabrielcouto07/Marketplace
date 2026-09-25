import type { ApiErrorDto, PagedResult } from "@marketplace/contracts";
import { HttpResponse, delay } from "msw";

/** Prefixo que casa tanto "/api/..." (browser) quanto "http://host/api/..." (Node). */
export const API = "*/api";

const MIN_LATENCY = 300;
const MAX_LATENCY = 800;

/** Latência simulada de 300–800 ms (0 em testes). */
export async function simulateLatency(): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  await delay(MIN_LATENCY + Math.floor(Math.random() * (MAX_LATENCY - MIN_LATENCY)));
}

/** Taxa de erro aleatória para listagens (ajustável via NEXT_PUBLIC_MOCK_ERROR_RATE; padrão 3%). */
const ERROR_RATE = Number(process.env.NEXT_PUBLIC_MOCK_ERROR_RATE ?? "0.03");

export function shouldFailRandomly(): boolean {
  return Math.random() < ERROR_RATE;
}

export function problem(
  status: number,
  code: string,
  message: string,
  errors?: Record<string, string[]>,
) {
  const body: ApiErrorDto = { status, code, message, errors, traceId: crypto.randomUUID() };
  return HttpResponse.json(body, {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

export const notFound = (what = "Recurso") => problem(404, "NOT_FOUND", `${what} não encontrado.`);
export const serverError = () =>
  problem(500, "INTERNAL_ERROR", "Erro interno simulado. Tente novamente.");
export const unauthorized = () => problem(401, "UNAUTHORIZED", "Sessão inválida ou expirada.");
export const validation = (errors: Record<string, string[]>) =>
  problem(422, "VALIDATION_ERROR", "Um ou mais campos são inválidos.", errors);

export function paginate<T>(items: T[], page = 1, pageSize = 20): PagedResult<T> {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(60, Math.max(1, pageSize));
  const start = (safePage - 1) * safeSize;
  return {
    items: items.slice(start, start + safeSize),
    page: safePage,
    pageSize: safeSize,
    totalCount: items.length,
  };
}

export function num(value: string | null, fallback?: number): number | undefined {
  if (value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function bool(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  return value === "true" || value === "1";
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addMinutes(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
