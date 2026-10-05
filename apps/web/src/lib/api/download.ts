import { useAuthStore } from "@/features/auth/store";
import { env } from "@/lib/env";

/**
 * Baixa um arquivo de uma rota autenticada da API (ex.: a etiqueta da remessa, que exige o token do vendedor ou do
 * admin) e salva com o nome informado. `path` pode vir com o prefixo `/api` (como a API devolve) ou sem ele.
 */
export async function downloadAuthenticated(path: string, fileName: string): Promise<void> {
  const base = env.apiUrl.replace(/\/$/, "");
  const url = path.startsWith("/api/") ? `${base}${path.slice(4)}` : `${base}${path}`;
  const token = useAuthStore.getState().accessToken;
  const response = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
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
