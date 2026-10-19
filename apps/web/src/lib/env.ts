/**
 * Variáveis públicas com defaults seguros:
 *  - `siteUrl` cai na URL da Vercel (produção ou preview) quando NEXT_PUBLIC_SITE_URL não é definida;
 *  - o mock (MSW) vem de NEXT_PUBLIC_API_MOCKING (ver .env.production para o deploy sem backend);
 *  - `googleClientId` e `mercadoPagoPublicKey` só importam fora do mock: sem eles, o login com Google
 *    fica oculto e o pagamento com cartão indisponível (Pix e boleto seguem funcionando).
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;
  return "http://localhost:3210";
}

export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  apiMocking: process.env.NEXT_PUBLIC_API_MOCKING === "true",
  siteUrl: resolveSiteUrl(),
  isDev: process.env.NODE_ENV === "development",
  /** Client ID OAuth do Google Identity Services (login social real). */
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null,
  /** Public key do Mercado Pago (tokenização de cartão no navegador). */
  mercadoPagoPublicKey: process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || null,
  /**
   * Selo do Programa Remessa Conforme. A Portaria Coana 130/2023 (art. 13) só permite o selo à empresa certificada:
   * ele aparece com NEXT_PUBLIC_REMESSA_CONFORME=true e o número do Ato Declaratório Executivo (ADE) em
   * NEXT_PUBLIC_REMESSA_CONFORME_ADE. Sem os dois, nenhuma página mostra o selo (não há modo de simulação).
   */
  remessaConforme: remessaConformeMode() === "certificado",
  remessaConformeMode: remessaConformeMode(),
  /** Número do ADE de certificação, mostrado no rodapé e na página do programa junto ao selo. */
  remessaConformeAde: remessaConformeAde(),
  /** Faixa conquistada no ciclo (Portaria Coana 193/2026): selos saem em dezembro para quem passa de 100 mil remessas. */
  remessaConformeSelo: complianceTier(process.env.NEXT_PUBLIC_REMESSA_CONFORME_SELO),
  /** Ciclo do selo (ex.: "2026/2027"), mostrado junto da medalha. */
  remessaConformeCiclo: process.env.NEXT_PUBLIC_REMESSA_CONFORME_CICLO || null,
} as const;

function remessaConformeAde(): string | null {
  return process.env.NEXT_PUBLIC_REMESSA_CONFORME_ADE?.trim() || null;
}

/** "semAde": ligado sem o número do ADE, o selo continua desligado (o painel de integrações avisa). */
function remessaConformeMode(): "off" | "semAde" | "certificado" {
  const raw = (process.env.NEXT_PUBLIC_REMESSA_CONFORME ?? "").trim().toLowerCase();
  if (raw !== "true" && raw !== "certificado") return "off";
  return remessaConformeAde() ? "certificado" : "semAde";
}

function complianceTier(raw: string | undefined): "ouro" | "prata" | "bronze" | null {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "ouro" || v === "prata" || v === "bronze" ? v : null;
}
