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

export class NetworkError extends Error {
  readonly url: string;
  readonly cause: unknown;

  constructor(url: string, cause: unknown) {
    super("Falha de rede ao acessar a API");
    this.name = "NetworkError";
    this.url = url;
    this.cause = cause;
  }
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
