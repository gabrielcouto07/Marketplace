import type { ApiErrorDto } from "@marketplace/contracts";

import { env } from "@/lib/env";

import { ApiError, NetworkError, defaultHttpErrorMessage } from "./errors";

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
  /** Não tentar renovar a sessão em 401 (usado internamente na repetição e nas rotas de auth). */
  skipRefresh?: boolean;
  /** Tempo limite em ms (padrão 20 s). */
  timeoutMs?: number;
}

/** Tempo limite padrão de uma requisição. */
export const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Base URL da API.
 * - No navegador: NEXT_PUBLIC_API_URL (padrão "/api", relativo à origem).
 * - No servidor (RSC / generateMetadata): precisa ser absoluta, então prefixa `env.siteUrl`
 *   quando NEXT_PUBLIC_API_URL for relativa.
 */
export function getApiBaseUrl(): string {
  const configured = env.apiUrl.replace(/\/$/, "");
  if (/^https?:\/\//.test(configured)) return configured;
  if (typeof window !== "undefined") return configured;
  return `${env.siteUrl}${configured.startsWith("/") ? "" : "/"}${configured}`;
}

/** `true` quando a URL aponta para a própria API (relativa ou absoluta). */
export function isApiUrl(url: string): boolean {
  return url.startsWith("/") || url.startsWith(getApiBaseUrl());
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

let localeProvider: () => string | null = () => null;

/**
 * Locale ativo (`pt-BR` | `es-PY`) enviado em `Accept-Language`: a API responde mensagens de
 * erro e textos localizados no idioma da interface. Registrado pela camada de providers.
 */
export function setLocaleProvider(provider: () => string | null): void {
  localeProvider = provider;
}

/**
 * Renovação de sessão em 401: devolve o novo access token ou `null` (sessão encerrada).
 * Registrada pela store de auth; `http()` chama uma única vez por rajada (single-flight) e repete a
 * requisição original com o token novo. Sem isso, um token expirado vira "Algo deu errado" em toda
 * tela autenticada (endereços, pedidos, checkout).
 */
type SessionRefresher = () => Promise<string | null>;
let sessionRefresher: SessionRefresher | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setSessionRefresher(refresher: SessionRefresher | null): void {
  sessionRefresher = refresher;
}

function refreshSession(): Promise<string | null> {
  if (!sessionRefresher) return Promise.resolve(null);
  if (!refreshInFlight) {
    refreshInFlight = sessionRefresher()
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Combina o `signal` do chamador com um tempo limite. Usa `AbortSignal.any` quando existe;
 * caso contrário, encadeia manualmente (Safari < 17.4).
 */
function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout]);
  const controller = new AbortController();
  const forward = (source: AbortSignal) => () => controller.abort(source.reason);
  if (signal.aborted) controller.abort(signal.reason);
  else signal.addEventListener("abort", forward(signal), { once: true });
  timeout.addEventListener("abort", forward(timeout), { once: true });
  return controller.signal;
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Fetch wrapper tipado. Componentes NUNCA chamam isto diretamente — use os hooks em features/<dominio>/api.
 * Lança ApiError (resposta HTTP com erro) ou NetworkError (falha de rede/offline/tempo limite).
 * Sempre envia `credentials: "include"` para o cookie httpOnly do refresh token funcionar tanto pelo
 * proxy (/api) quanto cross-origin (NEXT_PUBLIC_API_URL absoluta).
 */
export async function http<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const {
    method = "GET",
    body,
    query,
    signal,
    headers = {},
    accessToken,
    skipRefresh,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}${buildQueryString(query)}`;

  const token = accessToken === undefined ? tokenProvider() : accessToken;
  const locale = localeProvider();
  // Só renova quando a requisição usou o token armazenado (não em login/refresh nem em repetições).
  const canRefresh =
    !skipRefresh && accessToken === undefined && Boolean(token) && !path.startsWith("/auth/");
  const init: RequestInit = {
    method,
    signal: withTimeout(signal, timeoutMs),
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(locale ? { "Accept-Language": locale } : {}),
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
    if (isTimeoutError(error)) throw new NetworkError(url, error, { timeout: true });
    if (isAbortError(error)) throw error;
    throw new NetworkError(url, error);
  }

  if (response.status === 401 && canRefresh) {
    const fresh = await refreshSession();
    if (fresh && fresh !== token) {
      return http<TResponse>(path, { ...options, accessToken: fresh, skipRefresh: true });
    }
  }

  if (response.status === 204) return undefined as TResponse;

  const contentType = response.headers.get("content-type") ?? "";
  const isJson =
    contentType.includes("application/json") || contentType.includes("application/problem+json");
  const payload: unknown = isJson
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const problem = (isJson ? payload : null) as Partial<ApiErrorDto> | null;
    throw new ApiError({
      status: response.status,
      code: problem?.code ?? `HTTP_${response.status}`,
      // HTTP/2 não envia reason phrase: `statusText` vem vazio e a mensagem não pode ficar em branco.
      message: problem?.message || response.statusText || defaultHttpErrorMessage(response.status),
      errors: problem?.errors,
      traceId: problem?.traceId,
    });
  }

  return payload as TResponse;
}

/**
 * Envia um arquivo binário para uma URL de upload (pré-assinada pela API). Não passa por `http()` porque
 * o corpo não é JSON e a URL pode ser de outro host (R2). Lança ApiError em falha.
 */
export async function uploadFile(
  url: string,
  file: Blob,
  headers: Record<string, string> = {},
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      body: file,
      headers,
      credentials: isApiUrl(url) ? "include" : "same-origin",
    });
  } catch (error) {
    throw new NetworkError(url, error);
  }
  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: `UPLOAD_${response.status}`,
      message: "Não foi possível enviar a imagem.",
    });
  }
}

/**
 * Baixa um arquivo (ex.: PDF do boleto) e dispara o download no navegador. Usa o mesmo `fetch`
 * (o MSW intercepta em dev); URLs da própria API (relativas ou absolutas) levam o token da sessão.
 */
export async function downloadBlob(url: string, filename: string): Promise<void> {
  const ownApi = isApiUrl(url);
  const token = ownApi ? tokenProvider() : null;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: ownApi ? "include" : "same-origin",
    });
  } catch (error) {
    throw new NetworkError(url, error);
  }
  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: `DOWNLOAD_${response.status}`,
      message: "Não foi possível baixar o arquivo.",
    });
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
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
  /** Aceita corpo opcional (ex.: `DELETE /me` com senha e confirmação). */
  delete: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    http<T>(path, { ...options, method: "DELETE", body }),
};
