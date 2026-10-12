import { useAuthStore } from "@/features/auth/store";
import { env } from "@/lib/env";

/**
 * URL absoluta (ou relativa à origem) de uma rota da API. `path` pode vir com o prefixo `/api` (como a API devolve
 * links de etiqueta, comprovante e documento) ou sem ele.
 */
export function apiHref(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = env.apiUrl.replace(/\/$/, "");
  return path.startsWith("/api/") ? `${base}${path.slice(4)}` : `${base}${path}`;
}

/**
 * Link para abrir um documento enviado. Documentos privados voltam da API como link assinado e temporário
 * (`/api/documents/doc/…?t=…`); exemplos da demonstração ficam em `/images/kyc`.
 */
export function documentHref(url: string): string {
  return url.startsWith("/api/") ? apiHref(url) : url;
}

/**
 * Baixa um arquivo de uma rota autenticada da API (ex.: a etiqueta da remessa, que exige o token do vendedor ou do
 * admin) e salva com o nome informado. Com `body`, a rota é chamada com POST e corpo JSON (ex.: o dossiê da loja).
 */
export async function downloadAuthenticated(path: string, fileName: string, body?: unknown): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(apiHref(path), {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
