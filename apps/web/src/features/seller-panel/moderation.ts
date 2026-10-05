/** Motivos de análise/bloqueio aplicados pela plataforma (ComplianceService na API). */
export const MODERATION_KEYS = ["MARCA_PROTEGIDA", "PRECO_ABAIXO_REFERENCIA", "DENUNCIA", "CONTRAFACAO"] as const;

export type ModerationKey = (typeof MODERATION_KEYS)[number] | "OUTRO";

/** Motivo → chave de tradução (motivos novos caem em "OUTRO"). */
export function moderationKey(reason: string): ModerationKey {
  return (MODERATION_KEYS as readonly string[]).includes(reason) ? (reason as ModerationKey) : "OUTRO";
}
