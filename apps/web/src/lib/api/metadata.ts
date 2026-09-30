import type { ProductDetailDto, SellerDto } from "@marketplace/contracts";

import { http } from "./http";

/**
 * Leituras de catálogo para `generateMetadata` (Server Components).
 *
 * Com a API .NET, `NEXT_PUBLIC_API_URL` absoluta atende direto. Com o mock, o MSW registrado em
 * `instrumentation.ts` intercepta o fetch de saída no runtime Node. Em qualquer falha (timeout,
 * 404, mock indisponível) devolve `null` e a página usa o título derivado do slug — a metadata
 * nunca pode derrubar a renderização.
 */
const TIMEOUT_MS = 2000;

async function tryGet<T>(path: string): Promise<T | null> {
  try {
    return await http<T>(path, { accessToken: null, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return null;
  }
}

export const fetchProductForMetadata = (slug: string) =>
  tryGet<ProductDetailDto>(`/products/${encodeURIComponent(slug)}`);

export const fetchSellerForMetadata = (slug: string) =>
  tryGet<SellerDto>(`/sellers/${encodeURIComponent(slug)}`);

/** Primeira frase da descrição, limitada para meta description / Open Graph. */
export function summarize(text: string, max = 160): string {
  const first = text.split("\n")[0]?.trim() ?? "";
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}
