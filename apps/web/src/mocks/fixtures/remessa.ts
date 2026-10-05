import type {
  ComplianceBand,
  ImportTaxBreakdownDto,
  Money,
  NcmLookupDto,
  PlatformSettingsDto,
  SellerDocumentType,
  SellerDto,
  TaxRemittanceDto,
  UsdRateDto,
} from "@marketplace/contracts";

import { getRate } from "./base";

/**
 * Remessa Conforme no mock: as mesmas regras da API (`Marketplace.Domain/ImportTaxCalculator.cs` e
 * `Marketplace.Domain/Compliance/Compliance.cs`), em TypeScript puro. Sem estado — os handlers guardam remessas,
 * ocorrências e denúncias em `db`.
 */

// ---------------------------------------------------------------------------
// Configurações padrão (espelham PlatformSettings da API)
// ---------------------------------------------------------------------------

export const DEFAULT_PROTECTED_BRANDS =
  "Apple, iPhone, AirPods, Samsung, Xiaomi, Sony, PlayStation, Xbox, Nintendo, JBL, Bose, GoPro, Nike, Adidas, " +
  "Puma, Lacoste, Ray-Ban, Oakley, Rolex, Casio, Michael Kors, Louis Vuitton, Gucci, Prada, Chanel, Dior, " +
  "Carolina Herrera, Paco Rabanne, Calvin Klein, Hugo Boss, Johnnie Walker, Chivas, Absolut";

export type TaxSettings = Pick<
  PlatformSettingsDto,
  | "importTaxMode"
  | "importTaxBasisPoints"
  | "icmsBasisPoints"
  | "icmsStateOverrides"
  | "ibsStateBasisPoints"
  | "ibsMunicipalBasisPoints"
  | "cbsBasisPoints"
  | "insuranceBasisPoints"
  | "otherExpensesAmount"
>;

export const REMESSA_SETTINGS_DEFAULTS = {
  importTaxMode: "RemessaConforme",
  importTaxBasisPoints: 6000,
  icmsBasisPoints: 1700,
  icmsStateOverrides: "",
  ibsStateBasisPoints: 0,
  ibsMunicipalBasisPoints: 0,
  cbsBasisPoints: 0,
  insuranceBasisPoints: 0,
  otherExpensesAmount: 0,
  sellerStrikeLimit: 3,
  strikeWindowDays: 365,
  priceFloorPercent: 40,
  protectedBrands: DEFAULT_PROTECTED_BRANDS,
  requirePlatformLabel: true,
} as const satisfies Partial<PlatformSettingsDto>;

// ---------------------------------------------------------------------------
// Tributos (Lei 14.902/2024, Portaria MF 1.086/2024, LC 214/2025)
// ---------------------------------------------------------------------------

const LOW_TIER_LIMIT_USD_CENTS = 50_00;
const SIMPLIFIED_LIMIT_USD_CENTS = 3_000_00;
const HIGH_TIER_DEDUCTION_USD_CENTS = 20_00;
const LOW_TIER_BASIS_POINTS = 2000;
const HIGH_TIER_BASIS_POINTS = 6000;

const brl = (amount: number): Money => ({ amount, currency: "BRL" });
const applyBasisPoints = (amount: number, basisPoints: number) => Math.round((amount * basisPoints) / 10_000);
const effective = (taxes: number, customs: number) => (customs <= 0 ? 0 : Math.round((taxes * 10_000) / customs));

/** "SP=2000; RJ=2000" → alíquota da UF; sem exceção válida, o ICMS padrão. */
export function icmsBasisPointsFor(settings: TaxSettings, state: string | null): number {
  if (!state) return settings.icmsBasisPoints;
  for (const part of (settings.icmsStateOverrides ?? "").split(/[;,\n]/)) {
    const [uf, value] = part.split("=").map((s) => s.trim());
    if (uf?.length === 2 && uf.toUpperCase() === state && /^\d+$/.test(value ?? "") && Number(value) <= 5000)
      return Number(value);
  }
  return settings.icmsBasisPoints;
}

/** Valores de uma remessa (um pedido = um pacote = uma declaração), em centavos de BRL. */
export interface TaxInput {
  products: number;
  freight: number;
  discount: number;
  state?: string | null;
}

function usdRate(): UsdRateDto {
  const usd = getRate("USD", "BRL");
  return {
    numerator: usd.numerator,
    denominator: usd.denominator,
    displayRate: usd.displayRate,
    quotedAt: usd.quotedAt,
    source: "PTAX (simulado)",
  };
}

/**
 * II de 20% até US$ 50 e de 60% com dedução de US$ 20 acima; ICMS "por dentro" sobre valor aduaneiro + II; IBS e
 * CBS sobre a mesma base. No modo Flat, alíquota única apresentada como estimativa.
 */
export function calculateImportTax(input: TaxInput, settings: TaxSettings): ImportTaxBreakdownDto {
  const rate = usdRate();
  const zero = brl(0);
  const insurance = applyBasisPoints(input.products, settings.insuranceBasisPoints);
  const expenses = input.products > 0 ? Math.max(0, settings.otherExpensesAmount) : 0;
  const customs = Math.max(0, input.products + input.freight + insurance + expenses - input.discount);
  const state = input.state?.trim().toUpperCase() || null;
  const usdCents = Math.round((customs * rate.denominator) / rate.numerator);
  const common = {
    products: brl(input.products),
    freight: brl(input.freight),
    insurance: brl(insurance),
    otherExpenses: brl(expenses),
    discount: brl(input.discount),
    customsValue: brl(customs),
    customsValueUsd: { amount: usdCents, currency: "USD" } as Money,
    usdRate: rate,
  };

  if (settings.importTaxMode === "Flat") {
    const flat = applyBasisPoints(customs, settings.importTaxBasisPoints);
    return {
      regime: "Estimativa",
      isFinal: false,
      ...common,
      importDuty: brl(flat),
      importDutyBasisPoints: settings.importTaxBasisPoints,
      importDutyDeduction: zero,
      icms: zero,
      icmsBasisPoints: 0,
      icmsState: state,
      ibs: zero,
      ibsBasisPoints: 0,
      ibsState: zero,
      ibsStateBasisPoints: 0,
      ibsMunicipal: zero,
      ibsMunicipalBasisPoints: 0,
      cbs: zero,
      cbsBasisPoints: 0,
      totalTaxes: brl(flat),
      total: brl(customs + flat),
      effectiveBasisPoints: effective(flat, customs),
      exceedsSimplifiedLimit: false,
    };
  }

  let duty: number;
  let deduction = 0;
  let dutyBasisPoints: number;
  if (usdCents <= LOW_TIER_LIMIT_USD_CENTS) {
    dutyBasisPoints = LOW_TIER_BASIS_POINTS;
    duty = applyBasisPoints(customs, LOW_TIER_BASIS_POINTS);
  } else {
    dutyBasisPoints = HIGH_TIER_BASIS_POINTS;
    const gross = applyBasisPoints(customs, HIGH_TIER_BASIS_POINTS);
    deduction = Math.min(Math.round((HIGH_TIER_DEDUCTION_USD_CENTS * rate.numerator) / rate.denominator), gross);
    duty = gross - deduction;
  }
  const icmsBasisPoints = icmsBasisPointsFor(settings, state);
  const base = customs + duty;
  // ICMS por dentro: base / (1 − alíquota) − base.
  const icms =
    icmsBasisPoints <= 0 || base <= 0
      ? 0
      : Math.max(0, Math.round((base * 10_000) / (10_000 - icmsBasisPoints)) - base);
  const ibsState = applyBasisPoints(base, settings.ibsStateBasisPoints);
  const ibsMunicipal = applyBasisPoints(base, settings.ibsMunicipalBasisPoints);
  const cbs = applyBasisPoints(base, settings.cbsBasisPoints);
  const totalTaxes = duty + icms + ibsState + ibsMunicipal + cbs;
  return {
    regime: "RemessaConforme",
    isFinal: true,
    ...common,
    importDuty: brl(duty),
    importDutyBasisPoints: dutyBasisPoints,
    importDutyDeduction: brl(deduction),
    icms: brl(icms),
    icmsBasisPoints,
    icmsState: state,
    ibs: brl(ibsState + ibsMunicipal),
    ibsBasisPoints: settings.ibsStateBasisPoints + settings.ibsMunicipalBasisPoints,
    ibsState: brl(ibsState),
    ibsStateBasisPoints: settings.ibsStateBasisPoints,
    ibsMunicipal: brl(ibsMunicipal),
    ibsMunicipalBasisPoints: settings.ibsMunicipalBasisPoints,
    cbs: brl(cbs),
    cbsBasisPoints: settings.cbsBasisPoints,
    totalTaxes: brl(totalTaxes),
    total: brl(customs + totalTaxes),
    effectiveBasisPoints: effective(totalTaxes, customs),
    exceedsSimplifiedLimit: usdCents > SIMPLIFIED_LIMIT_USD_CENTS,
  };
}

/** Soma das remessas de uma compra (resumo do checkout). Alíquotas que variam entre remessas viram 0. */
export function sumImportTaxes(parts: ImportTaxBreakdownDto[]): ImportTaxBreakdownDto | null {
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const total = (pick: (p: ImportTaxBreakdownDto) => Money) => brl(parts.reduce((acc, p) => acc + pick(p).amount, 0));
  const same = (pick: (p: ImportTaxBreakdownDto) => number) =>
    new Set(parts.map(pick)).size === 1 ? pick(first) : 0;
  const customs = total((p) => p.customsValue);
  const taxes = total((p) => p.totalTaxes);
  const usd = parts.every((p) => p.customsValueUsd)
    ? ({ amount: parts.reduce((acc, p) => acc + p.customsValueUsd!.amount, 0), currency: "USD" } as Money)
    : null;
  return {
    regime: parts.some((p) => p.regime === "Estimativa") ? "Estimativa" : "RemessaConforme",
    isFinal: parts.every((p) => p.isFinal),
    products: total((p) => p.products),
    freight: total((p) => p.freight),
    insurance: total((p) => p.insurance),
    otherExpenses: total((p) => p.otherExpenses),
    discount: total((p) => p.discount),
    customsValue: customs,
    customsValueUsd: usd,
    importDuty: total((p) => p.importDuty),
    importDutyBasisPoints: same((p) => p.importDutyBasisPoints),
    importDutyDeduction: total((p) => p.importDutyDeduction),
    icms: total((p) => p.icms),
    icmsBasisPoints: same((p) => p.icmsBasisPoints),
    icmsState: first.icmsState,
    ibs: total((p) => p.ibs),
    ibsBasisPoints: first.ibsBasisPoints,
    ibsState: total((p) => p.ibsState),
    ibsStateBasisPoints: first.ibsStateBasisPoints,
    ibsMunicipal: total((p) => p.ibsMunicipal),
    ibsMunicipalBasisPoints: first.ibsMunicipalBasisPoints,
    cbs: total((p) => p.cbs),
    cbsBasisPoints: first.cbsBasisPoints,
    totalTaxes: taxes,
    total: total((p) => p.total),
    effectiveBasisPoints: effective(taxes.amount, customs.amount),
    usdRate: first.usdRate,
    exceedsSimplifiedLimit: parts.some((p) => p.exceedsSimplifiedLimit),
  };
}

// ---------------------------------------------------------------------------
// NCM (tabela oficial do Siscomex — recorte com os códigos do catálogo)
// ---------------------------------------------------------------------------

export const NCM_TABLE: Record<string, string> = {
  "22029900": "Outras bebidas não alcoólicas",
  "22041090": "Outros vinhos espumantes e vinhos espumosos",
  "22042100": "Vinhos em recipientes de capacidade não superior a 2 l",
  "22083020": "Uísques em recipientes de capacidade não superior a 2 l",
  "22085000": "Gim e genebra",
  "22086000": "Vodca",
  "22087000": "Licores",
  "22089000": "Outras bebidas espirituosas",
  "24022000": "Cigarros que contenham tabaco",
  "30049099": "Outros medicamentos em doses",
  "33030010": "Perfumes (extratos)",
  "33030020": "Águas-de-colônia",
  "33079000": "Outros produtos de perfumaria ou de toucador preparados",
  "39269090": "Outras obras de plástico",
  "42022100": "Bolsas com a superfície exterior de couro natural",
  "42023100": "Artigos de bolso ou de bolsa com a superfície exterior de couro natural",
  "42029200": "Outros artigos com a superfície exterior de folhas de plástico ou de matérias têxteis",
  "42033000": "Cintos, cinturões e bandoleiras, de couro natural",
  "62014000": "Anoraques, blusões e artigos semelhantes, de fibras sintéticas ou artificiais",
  "63023100": "Roupas de cama de algodão",
  "63062200": "Barracas de fibras sintéticas",
  "64039990": "Outros calçados com parte superior de couro natural",
  "64041100": "Calçados para esporte com parte superior de matérias têxteis",
  "65050090": "Outros chapéus e artefatos de uso semelhante",
  "70071900": "Outros vidros temperados",
  "76151000": "Artefatos de uso doméstico de alumínio",
  "84713012": "Máquinas portáteis para processamento de dados, de peso inferior a 3,5 kg (tablets)",
  "84713019": "Outras máquinas automáticas portáteis para processamento de dados, de peso não superior a 10 kg",
  "84716052": "Teclados",
  "84716053": "Indicadores ou apontadores (mouse e track-ball, por exemplo)",
  "84733042": "Módulos de memória com superfície inferior ou igual a 50 cm²",
  "84733049": "Outras partes e acessórios de máquinas para processamento de dados",
  "85044010": "Carregadores de acumuladores",
  "85081100": "Aspiradores com motor elétrico incorporado, de potência não superior a 1.500 W",
  "85094010": "Liquidificadores",
  "85166000": "Outros fornos; fogareiros, grelhas e assadeiras",
  "85167100": "Aparelhos para preparação de café ou de chá",
  "85171300": "Smartphones",
  "85176241": "Roteadores digitais, em redes com ou sem fio",
  "85176299": "Outros aparelhos para recepção, conversão e transmissão de voz, imagens ou outros dados",
  "85182200": "Alto-falantes múltiplos montados no mesmo receptáculo",
  "85183000": "Fones de ouvido, mesmo combinados com um microfone",
  "85258929": "Outras câmeras de televisão, câmeras fotográficas digitais e câmeras de vídeo",
  "85285200": "Monitores capazes de ser conectados a máquinas automáticas para processamento de dados",
  "85285900": "Outros monitores",
  "85287200": "Outros aparelhos receptores de televisão, em cores",
  "90041000": "Óculos de sol",
  "90064000": "Câmeras fotográficas de revelação e cópia instantâneas",
  "91021110": "Relógios de pulso elétricos, com mostrador analógico e caixa de metal comum",
  "93040000": "Outras armas",
  "94052100": "Luminárias elétricas de mesa, de escritório ou de cabeceira, para LED",
  "95062900": "Outros artigos e equipamentos para esportes aquáticos",
  "95066200": "Bolas infláveis",
  "95069100": "Artigos e equipamentos para cultura física, ginástica ou atletismo",
};

/** Capítulos proibidos em remessa nesta plataforma, com o motivo. */
const PROHIBITED_CHAPTERS: Record<string, string> = {
  "24": "Tabaco e cigarros não podem ser importados por remessa.",
  "30": "Medicamentos dependem de autorização da Anvisa e não são vendidos aqui.",
  "36": "Pólvoras, explosivos e fogos de artifício são proibidos em remessa.",
  "93": "Armas e munições são proibidas em remessa.",
};

/** Capítulos aceitos por categoria (slug). Categoria fora do mapa aceita qualquer capítulo permitido. */
const CATEGORY_CHAPTERS: Record<string, string[]> = {
  eletronicos: ["84", "85", "90", "91", "95"],
  perfumes: ["33", "34"],
  informatica: ["84", "85", "90"],
  celulares: ["84", "85", "39", "40", "42", "70", "90"],
  bebidas: ["20", "21", "22"],
  casa: ["39", "44", "63", "69", "70", "73", "76", "82", "84", "85", "94"],
  esportes: ["42", "61", "62", "63", "64", "65", "85", "87", "89", "90", "91", "95"],
  moda: ["42", "43", "61", "62", "63", "64", "65", "71", "90", "91"],
};

export const formatNcm = (code: string) =>
  code.length === 8 ? `${code.slice(0, 4)}.${code.slice(4, 6)}.${code.slice(6)}` : code;

const isWellFormedNcm = (code: string) =>
  /^\d{8}$/.test(code) && Number(code.slice(0, 2)) >= 1 && Number(code.slice(0, 2)) <= 97;

export function lookupNcm(raw: string): NcmLookupDto | "invalid" | "not-found" {
  const code = raw.replace(/\D/g, "");
  if (!isWellFormedNcm(code)) return "invalid";
  const description = NCM_TABLE[code];
  return description ? { code, formatted: formatNcm(code), description, official: true } : "not-found";
}

export function searchNcm(q: string): NcmLookupDto[] {
  const term = fold(q);
  const digits = q.replace(/\D/g, "");
  if (!term && !digits) return [];
  return Object.entries(NCM_TABLE)
    .filter(([code, description]) => (digits && code.startsWith(digits)) || (term && fold(description).includes(term)))
    .slice(0, 20)
    .map(([code, description]) => ({ code, formatted: formatNcm(code), description, official: true }));
}

/** Mesmas mensagens da API: obrigatório para publicar, formato, capítulo proibido, categoria e tabela oficial. */
export function validateNcm(
  raw: string | null | undefined,
  categorySlug: string,
  required: boolean,
): { code: string | null } | { error: string } {
  const code = (raw ?? "").replace(/\D/g, "");
  if (!code)
    return required
      ? { error: "Informe o NCM do produto (8 dígitos). Ele vai na declaração de importação." }
      : { code: null };
  if (!isWellFormedNcm(code)) return { error: "O NCM tem 8 dígitos, ex.: 8517.13.00." };
  const chapter = code.slice(0, 2);
  if (PROHIBITED_CHAPTERS[chapter]) return { error: PROHIBITED_CHAPTERS[chapter] };
  const chapters = CATEGORY_CHAPTERS[categorySlug];
  if (chapters && !chapters.includes(chapter))
    return {
      error: `O NCM ${formatNcm(code)} (capítulo ${chapter}) não corresponde à categoria escolhida.`,
    };
  if (!NCM_TABLE[code]) return { error: `O NCM ${formatNcm(code)} não existe na tabela oficial vigente.` };
  return { code };
}

// ---------------------------------------------------------------------------
// Marcas protegidas, faixas dos indicadores e código S10
// ---------------------------------------------------------------------------

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Marca protegida no texto, como palavra inteira, sem acento e sem caixa. */
export function findProtectedBrand(text: string, brandsCsv: string): string | null {
  const haystack = ` ${fold(text)} `;
  for (const brand of brandsCsv.split(/[,;\n]/).map((b) => b.trim())) {
    const needle = fold(brand);
    if (needle.length >= 2 && haystack.includes(` ${needle} `)) return brand;
  }
  return null;
}

export const SEAL_MINIMUM_SHIPMENTS = 100_000;

/** Proporção de remessas sem ocorrência, em centésimos de % (9970 = 99,70%). */
export function compliancePermyriad(shipments: number, occurrences: number): number {
  if (shipments <= 0) return 10_000;
  return Math.floor((Math.max(0, shipments - occurrences) * 10_000) / shipments);
}

export function bandOf(permyriad: number): ComplianceBand {
  if (permyriad >= 9970) return "Ouro";
  if (permyriad >= 9940) return "Prata";
  if (permyriad >= 9900) return "Bronze";
  if (permyriad >= 9800) return "Advertencia";
  return "Exclusao";
}

export const BAND_CONSEQUENCE: Record<ComplianceBand, string> = {
  Ouro: "Monitoramento ordinário.",
  Prata: "Comunicação para aprimorar controles internos.",
  Bronze: "Monitoramento reforçado e plano de ação em 30 dias.",
  Advertencia: "Advertência e plano de ação em 30 dias.",
  Exclusao: "Procedimento de exclusão do programa, com contraditório.",
};

/** Ano em que começa o ciclo (julho a junho) que contém a data. */
export const cycleStartYear = (date: Date) =>
  date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;

const S10_WEIGHTS = [8, 6, 4, 2, 3, 5, 9, 7];

/** Código de objeto UPU S10: 2 letras + 8 dígitos + dígito verificador + país (ex.: LB701234565PY). */
export function s10(service: string, serial: number, country: string): string {
  const digits = String(Math.abs(Math.trunc(serial)) % 100_000_000).padStart(8, "0");
  const total = [...digits].reduce((acc, d, i) => acc + Number(d) * S10_WEIGHTS[i], 0);
  const check = 11 - (total % 11);
  return `${service}${digits}${check === 10 ? 0 : check === 11 ? 5 : check}${country}`;
}

// ---------------------------------------------------------------------------
// Admissão das lojas (Portaria Coana 130/2023, art. 8º, V)
// ---------------------------------------------------------------------------

export interface SellerKyc {
  legalAddress: string | null;
  responsibleName: string | null;
  responsibleDocumentType: SellerDocumentType | null;
  /** Documento completo (só o mock guarda; a API devolve mascarado). */
  responsibleDocument: string | null;
  identityDocumentUrl: string | null;
  rucCertificateUrl: string | null;
  verifiedAt: string | null;
  suspensionReason: string | null;
}

const RESPONSIBLES = [
  "Carlos Benítez",
  "María Fernanda Ortiz",
  "Jorge Duarte",
  "Ana Lucía Giménez",
  "Hiroshi Tanaka",
  "Rodrigo Acosta",
  "Paula Villalba",
  "Diego Cáceres",
];

const STREETS: Record<string, string> = {
  "Ciudad del Este": "Av. Monseñor Rodríguez",
  Asunción: "Av. Mariscal López",
  "Salto del Guairá": "Av. Paraguay",
  "Pedro Juan Caballero": "Calle Teniente Herrero",
};

export const KYC_IDENTITY_URL = "/images/kyc/documento-responsavel.svg";
export const KYC_RUC_URL = "/images/kyc/constancia-ruc.svg";

/** Lojas fixas nascem com documentos conferidos (como no seed da API). */
export function seedSellerKyc(seller: SellerDto, index: number): SellerKyc {
  const verified = new Date(seller.memberSince);
  verified.setDate(verified.getDate() + 1);
  return {
    legalAddress: `${STREETS[seller.city] ?? "Av. Mcal. López"} ${120 + index * 85}, Microcentro`,
    responsibleName: RESPONSIBLES[index % RESPONSIBLES.length],
    responsibleDocumentType: "CedulaPy",
    responsibleDocument: String(3_100_000 + index * 271_113),
    identityDocumentUrl: KYC_IDENTITY_URL,
    rucCertificateUrl: KYC_RUC_URL,
    verifiedAt: verified.toISOString(),
    suspensionReason: null,
  };
}

export const EMPTY_KYC: SellerKyc = {
  legalAddress: null,
  responsibleName: null,
  responsibleDocumentType: null,
  responsibleDocument: null,
  identityDocumentUrl: null,
  rucCertificateUrl: null,
  verifiedAt: null,
  suspensionReason: null,
};

/** "52998224725" → "***.982.247-**"; outros documentos mantêm os 3 últimos caracteres. */
export function maskDocument(document: string | null): string | null {
  if (!document) return null;
  const d = document.trim();
  if (/^\d{11}$/.test(d)) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  return d.length <= 3 ? "*".repeat(d.length) : `${"*".repeat(d.length - 3)}${d.slice(-3)}`;
}

/** CPF com dígito verificador, cédula paraguaia (5 a 9 dígitos) ou passaporte (6 a 12 letras/dígitos). */
export function normalizeResponsibleDocument(
  type: SellerDocumentType,
  raw: string | null | undefined,
  isValidCpf: (cpf: string) => boolean,
): string | null {
  const value = (raw ?? "").trim().toUpperCase();
  const digits = value.replace(/\D/g, "");
  if (type === "Cpf") return isValidCpf(digits) ? digits : null;
  if (type === "CedulaPy") return digits.length >= 5 && digits.length <= 9 ? digits : null;
  const passport = value.replace(/[\s-]/g, "");
  return /^[A-Z0-9]{6,12}$/.test(passport) ? passport : null;
}

/** Repasse dos tributos de uma remessa ao operador (no sandbox, confirmado na hora). */
export function remittanceFromTaxes(
  taxes: ImportTaxBreakdownDto,
  at: string,
  reference: string,
): TaxRemittanceDto {
  return {
    status: "Confirmado",
    importDuty: taxes.importDuty,
    icms: taxes.icms,
    ibsState: taxes.ibsState,
    ibsMunicipal: taxes.ibsMunicipal,
    cbs: taxes.cbs,
    total: taxes.totalTaxes,
    reference,
    createdAt: at,
    sentAt: at,
    confirmedAt: at,
    lastError: null,
  };
}
