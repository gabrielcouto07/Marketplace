import type { ApiErrorDto } from "@marketplace/contracts";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors?: Record<string, string[]>;
  readonly traceId?: string;

  constructor(dto: ApiErrorDto) {
    super(dto.message);
    this.name = "ApiError";
    this.status = dto.status;
    this.code = dto.code;
    this.errors = dto.errors;
    this.traceId = dto.traceId;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isValidation(): boolean {
    return this.status === 400 || this.status === 422;
  }
}

export const NETWORK_ERROR_MESSAGE = "Falha de rede ao acessar a API";
export const TIMEOUT_ERROR_MESSAGE = "A API demorou demais para responder. Tente novamente.";

export class NetworkError extends Error {
  readonly url: string;
  readonly cause: unknown;
  /** `true` quando a requisição estourou o tempo limite do client. */
  readonly isTimeout: boolean;

  constructor(url: string, cause: unknown, options: { timeout?: boolean } = {}) {
    super(options.timeout ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE);
    this.name = "NetworkError";
    this.url = url;
    this.cause = cause;
    this.isTimeout = Boolean(options.timeout);
  }
}

/**
 * Mensagem genérica por status quando a resposta não traz ProblemDetails e `statusText`
 * vem vazio (HTTP/2 não envia reason phrase). Nunca devolve string vazia.
 */
export function defaultHttpErrorMessage(status: number): string {
  if (status === 400 || status === 422) return "Um ou mais campos são inválidos.";
  if (status === 401) return "Sessão inválida ou expirada.";
  if (status === 403) return "Você não tem permissão para esta ação.";
  if (status === 404) return "Não encontramos o que você procura.";
  if (status === 409) return "Esta ação conflita com o estado atual. Atualize a página.";
  if (status === 429) return "Muitas tentativas. Aguarde um instante e tente de novo.";
  if (status >= 500) return "O servidor está indisponível no momento. Tente novamente.";
  return `Erro inesperado (HTTP ${status}).`;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isNotFoundError(error: unknown): boolean {
  return isApiError(error) && error.isNotFound;
}
