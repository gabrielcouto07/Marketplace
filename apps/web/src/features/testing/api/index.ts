"use client";

import type { TestModeDto } from "@marketplace/contracts";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";
import { env } from "@/lib/env";

export const testingApi = {
  mode: () => api.get<TestModeDto>("/test-mode"),
};

/**
 * Modo de testes: a API usa o gateway de pagamento fictício (ou o site roda no mock). Liga os atalhos
 * "preencher com dados de teste" e a aprovação simulada do pagamento; em produção real fica desligado.
 */
export function useTestMode(): boolean {
  const mode = useQuery({
    queryKey: queryKeys.testMode,
    queryFn: testingApi.mode,
    staleTime: Infinity,
    retry: false,
    enabled: !env.apiMocking,
  });
  return env.apiMocking || mode.data?.enabled === true;
}
