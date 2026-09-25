import type { ApiErrorDto } from "@marketplace/contracts";

import { ApiError, NetworkError } from "./errors";

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | QueryValue[]>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: QueryParams;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Token de acesso; quando omitido usa o token armazenado (auth mock). */
  accessToken?: string | null;
}

/**
 * Base URL da API.
 * - No navegador: NEXT_PUBLIC_API_URL (padrão "/api", relativo à origem).
 * - No servidor (RSC / generateMetadata): precisa ser absoluta, então prefixa NEXT_PUBLIC_SITE_URL
 *   quando NEXT_PUBLIC_API_URL for relativa.
 */
export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  if (/^https?:\/\//.test(configured)) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return configured.replace(/\/$/, "");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${site}${configured.startsWith("/") ? "" : "/"}${configured.replace(/\/$/, "")}`;
}

export function buildQueryString(query?: QueryParams): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v !== undefined && v !== null && v !== "") params.append(key, String(v));
      }
    } else {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

let tokenProvider: () => string | null = () => null;

/** Permite que a camada de auth injete o token sem acoplar o client à store. */
export function setAccessTokenProvider(provider: () => string | null): void {
  tokenProvider = provider;
}

/**
 * Fetch wrapper tipado. Componentes NUNCA chamam isto diretamente — use os hooks em features/<dominio>/api.
 * Lança ApiError (resposta HTTP com erro) ou NetworkError (falha de rede/offline).
 */
export async function http<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
  const { method = "GET", body, query, signal, headers = {}, accessToken } = options;
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}${buildQueryString(query)}`;

  const token = accessToken === undefined ? tokenProvider() : accessToken;
  const init: RequestInit = {
    method,
    signal,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  };

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new NetworkError(url, error);
  }

  if (response.status === 204) return undefined as TResponse;

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json") || contentType.includes("application/problem+json");
  const payload: unknown = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);

  if (!response.ok) {
    const problem = (isJson ? payload : null) as Partial<ApiErrorDto> | null;
    throw new ApiError({
      status: response.status,
      code: problem?.code ?? `HTTP_${response.status}`,
      message: problem?.message ?? response.statusText ?? "Erro inesperado",
      errors: problem?.errors,
      traceId: problem?.traceId,
    });
  }

  return payload as TResponse;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    http<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    http<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    http<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    http<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    http<T>(path, { ...options, method: "DELETE" }),
};
