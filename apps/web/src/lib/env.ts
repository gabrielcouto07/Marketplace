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
   * Selo do Programa Remessa Conforme. Só ligar ("true") em produção depois do Ato Declaratório Executivo da Coana:
   * exibir o selo sem a certificação é propaganda enganosa. "simulacao" mostra o selo com a etiqueta "Simulação"
   * (pré-visualização de como o site fica certificado).
   */
  remessaConforme: remessaConformeMode() !== "off",
  remessaConformeMode: remessaConformeMode(),
  /** Número do ADE de certificação, mostrado no rodapé e no header junto ao selo (opcional). */
  remessaConformeAde: process.env.NEXT_PUBLIC_REMESSA_CONFORME_ADE || null,
  /** Faixa conquistada no ciclo (Portaria Coana 193/2026): selos saem em dezembro para quem passa de 100 mil remessas. */
  remessaConformeSelo: complianceTier(process.env.NEXT_PUBLIC_REMESSA_CONFORME_SELO),
  /** Ciclo do selo (ex.: "2026/2027"), mostrado junto da medalha. */
  remessaConformeCiclo: process.env.NEXT_PUBLIC_REMESSA_CONFORME_CICLO || null,
} as const;

function remessaConformeMode(): "off" | "simulacao" | "certificado" {
  const raw = (process.env.NEXT_PUBLIC_REMESSA_CONFORME ?? "").trim().toLowerCase();
  if (raw === "true" || raw === "certificado") return "certificado";
  if (raw === "simulacao" || raw === "simulação" || raw === "preview") return "simulacao";
  return "off";
}

function complianceTier(raw: string | undefined): "ouro" | "prata" | "bronze" | null {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "ouro" || v === "prata" || v === "bronze" ? v : null;
}
