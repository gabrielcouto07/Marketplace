import {
  SELLER_VERIFICATION_ITEMS,
  type ComplianceBand,
  type ImportTaxBreakdownDto,
  type Money,
  type NcmLookupDto,
  type PlatformSettingsDto,
  type SellerDocumentType,
  type SellerDto,
  type SellerPayoutMethod,
  type TaxRemittanceDto,
  type UsdRateDto,
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
  | "importDutyLowTierBasisPoints"
  | "importDutyHighTierBasisPoints"
  | "importDutyHighTierDeductionUsdCents"
>;

/** Versão inicial da Política de Admissão e de Monitoramento de Vendedores (PlatformSettings.InitialSellerPolicyVersion). */
export const INITIAL_SELLER_POLICY_VERSION = "2026-10-09";

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
  // Faixas do II (Portaria MF 1.342/2026): 0% até US$ 50 e 60% − US$ 30 acima.
  importDutyLowTierBasisPoints: 0,
  importDutyHighTierBasisPoints: 6000,
  importDutyHighTierDeductionUsdCents: 3000,
  sellerStrikeLimit: 3,
  strikeWindowDays: 365,
  priceFloorPercent: 40,
  protectedBrands: DEFAULT_PROTECTED_BRANDS,
  requirePlatformLabel: true,
  // Programa de Conformidade e Política de Vendedores (versão inicial igual à da API).
  sellerPolicyVersion: INITIAL_SELLER_POLICY_VERSION,
  sellerPolicyApprovedAt: null,
  complianceProgramApprovedAt: null,
  programOwnerName: "",
  programOwnerEmail: "",
  abruptIncreaseFactor: 3,
  abruptIncreaseMinShipments: 20,
  concentrationThreshold: 5,
  auditSamplePercent: 10,
  platformLabelLocked: false,
} as const satisfies Partial<PlatformSettingsDto>;

// ---------------------------------------------------------------------------
// Tributos (Portaria MF 1.342/2026, LC 214/2025)
// ---------------------------------------------------------------------------

const LOW_TIER_LIMIT_USD_CENTS = 50_00;
const SIMPLIFIED_LIMIT_USD_CENTS = 3_000_00;

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
 * II pelas faixas configuradas (Portaria MF 1.342/2026: 0% até US$ 50 e 60% com dedução de US$ 30 acima); ICMS "por
 * dentro" sobre valor aduaneiro + II; IBS e CBS sobre a mesma base. No modo Flat, alíquota única apresentada como
 * estimativa. Configurações gravadas antes das faixas (banco do mock antigo) caem nos padrões.
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
  let deductionUsd: Money | null = null;
  let dutyBasisPoints: number;
  if (usdCents <= LOW_TIER_LIMIT_USD_CENTS) {
    dutyBasisPoints = settings.importDutyLowTierBasisPoints ?? REMESSA_SETTINGS_DEFAULTS.importDutyLowTierBasisPoints;
    duty = applyBasisPoints(customs, dutyBasisPoints);
  } else {
    dutyBasisPoints = settings.importDutyHighTierBasisPoints ?? REMESSA_SETTINGS_DEFAULTS.importDutyHighTierBasisPoints;
    const deductionUsdCents = Math.max(
      0,
      settings.importDutyHighTierDeductionUsdCents ?? REMESSA_SETTINGS_DEFAULTS.importDutyHighTierDeductionUsdCents,
    );
    const gross = applyBasisPoints(customs, dutyBasisPoints);
    deduction = Math.min(Math.round((deductionUsdCents * rate.numerator) / rate.denominator), gross);
    deductionUsd = { amount: deductionUsdCents, currency: "USD" };
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
    importDutyDeductionUsd: deductionUsd,
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

/** Soma das remessas de uma compra (resumo do checkout). Alíquotas que variam entre remessas viram 0 (no II, −1). */
export function sumImportTaxes(parts: ImportTaxBreakdownDto[]): ImportTaxBreakdownDto | null {
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const total = (pick: (p: ImportTaxBreakdownDto) => Money) => brl(parts.reduce((acc, p) => acc + pick(p).amount, 0));
  const same = (pick: (p: ImportTaxBreakdownDto) => number, varies = 0) =>
    new Set(parts.map(pick)).size === 1 ? pick(first) : varies;
  const deductionsUsd = parts.filter((p) => p.importDutyDeductionUsd).map((p) => p.importDutyDeductionUsd!.amount);
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
    importDutyBasisPoints: same((p) => p.importDutyBasisPoints, -1),
    importDutyDeduction: total((p) => p.importDutyDeduction),
    importDutyDeductionUsd: deductionsUsd.length
      ? { amount: deductionsUsd.reduce((a, b) => a + b, 0), currency: "USD" }
      : null,
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
  "94013900": "Outros assentos giratórios de altura ajustável",
  "94054200": "Outros luminárias e aparelhos de iluminação, elétricos, para LED",
  "95045000": "Consoles e máquinas de jogos de vídeo, exceto os da subposição 9504.30",
  "85181090": "Outros microfones e seus suportes",
  "94052100": "Luminárias elétricas de mesa, de escritório ou de cabeceira, para LED",
  "95062900": "Outros artigos e equipamentos para esportes aquáticos",
  "95066200": "Bolas infláveis",
  "95069100": "Artigos e equipamentos para cultura física, ginástica ou atletismo",
};

// ---------------------------------------------------------------------------
// Anexo I da Política de Vendedores: produtos de oferta vedada (espelha ProhibitedGoods da API)
// ---------------------------------------------------------------------------

export type RestrictionLevel = "Bloqueio" | "Analise";
export interface RestrictionHit {
  level: RestrictionLevel;
  annexItem: string;
  reason: string;
  term?: string;
}

export const ANNEX_ITEMS: Array<{ letter: string; title: string }> = [
  { letter: "a", title: "armas de fogo, suas peças, munições, explosivos e agentes de guerra química" },
  { letter: "b", title: "brinquedos, réplicas e simulacros de armas de fogo que com elas se possam confundir" },
  { letter: "c", title: "substâncias entorpecentes ou drogas afins" },
  { letter: "d", title: "cigarro eletrônico" },
  { letter: "e", title: "cigarros, fumo e produtos de tabacaria" },
  { letter: "f", title: "bebidas alcoólicas" },
  {
    letter: "g",
    title:
      "produtos cuja importação dependa de autorização de órgão de controle sanitário, metrológico, de segurança pública ou ambiental, sem essa autorização",
  },
  { letter: "h", title: "animais e vegetais da vida silvestre, espécies ameaçadas de extinção e seus derivados, e animal morto" },
  { letter: "i", title: "bens usados ou recondicionados" },
  { letter: "j", title: "diamantes" },
  { letter: "k", title: "dinheiro em espécie" },
  { letter: "l", title: "substâncias perecíveis, como alimentos de origem animal e frutas" },
  {
    letter: "m",
    title: "resíduos e rejeitos sólidos perigosos, poluentes orgânicos persistentes e produtos que destroem a camada de ozônio",
  },
  { letter: "n", title: "mercadorias atentatórias à moral, aos bons costumes, à saúde ou à ordem pública" },
  { letter: "o", title: "produtos contrafeitos ou que infrinjam direito de propriedade intelectual" },
  { letter: "p", title: "bens cujo transporte seja proibido pelos Correios" },
];

/** Prefixos de NCM sem exceção possível: o anúncio não é publicado. */
const BLOCKED_NCM: Array<[prefix: string, item: string, reason: string]> = [
  ["93", "a", "Armas, munições e suas partes não podem ser vendidas."],
  ["3601", "a", "Pólvoras não podem ser vendidas."],
  ["3602", "a", "Explosivos não podem ser vendidos."],
  ["3603", "a", "Estopins, detonadores e cápsulas fulminantes não podem ser vendidos."],
  ["12113", "c", "Folha de coca não pode ser vendida."],
  ["12114", "c", "Palha de papoula não pode ser vendida."],
  ["130211", "c", "Ópio não pode ser vendido."],
  ["293911", "c", "Alcaloides do ópio não podem ser vendidos."],
  ["293971", "c", "Cocaína e derivados não podem ser vendidos."],
  ["854340", "d", "Cigarros eletrônicos e vaporizadores não podem ser vendidos."],
  ["24", "e", "Cigarros, fumo e produtos com nicotina não podem ser vendidos."],
  ["9614", "e", "Cachimbos, narguilés e piteiras (tabacaria) não podem ser vendidos."],
  ["2203", "f", "Bebidas alcoólicas não podem ser vendidas (cerveja)."],
  ["2204", "f", "Bebidas alcoólicas não podem ser vendidas (vinho)."],
  ["2205", "f", "Bebidas alcoólicas não podem ser vendidas (vermute)."],
  ["2206", "f", "Bebidas alcoólicas não podem ser vendidas (fermentados)."],
  ["2207", "f", "Álcool etílico não pode ser vendido."],
  ["2208", "f", "Bebidas alcoólicas não podem ser vendidas (destilados e licores)."],
  ["30", "g", "Medicamentos dependem de autorização da Anvisa e não são vendidos aqui."],
  ["3808", "g", "Agrotóxicos e saneantes dependem de registro (Anvisa, Mapa, Ibama) e não são vendidos aqui."],
  ["1209", "g", "Sementes para semeadura dependem de autorização fitossanitária e não são vendidas aqui."],
  ["01", "h", "Animais vivos não podem ser vendidos."],
  ["06", "h", "Plantas vivas não podem ser vendidas."],
  ["0507", "h", "Marfim, carapaças de tartaruga e chifres não podem ser vendidos."],
  ["0508", "h", "Corais e conchas não podem ser vendidos."],
  ["9705", "h", "Peças de coleção de interesse zoológico, botânico ou arqueológico não podem ser vendidas."],
  ["6309", "i", "Artigos têxteis usados não podem ser vendidos."],
  ["4012", "i", "Pneus usados ou recauchutados não podem ser vendidos."],
  ["7102", "j", "Diamantes não podem ser vendidos."],
  ["4907", "k", "Papel-moeda, cheques e títulos não podem ser vendidos."],
  ["7118", "k", "Moedas não podem ser vendidas."],
  ["02", "l", "Carnes são perecíveis e não podem ser vendidas."],
  ["03", "l", "Peixes e frutos do mar são perecíveis e não podem ser vendidos."],
  ["04", "l", "Laticínios, ovos e mel são perecíveis e não podem ser vendidos."],
  ["07", "l", "Hortaliças são perecíveis e não podem ser vendidas."],
  ["08", "l", "Frutas são perecíveis e não podem ser vendidas."],
  ["16", "l", "Preparações de carne e de pescado são perecíveis e não podem ser vendidas."],
  ["2524", "m", "Amianto não pode ser vendido."],
  ["29037", "m", "Gases que destroem a camada de ozônio (HCFC) não podem ser vendidos."],
  ["3825", "m", "Resíduos químicos não podem ser vendidos."],
  ["8549", "m", "Sucata e resíduos elétricos e eletrônicos não podem ser vendidos."],
  ["2711", "p", "Gases inflamáveis não podem ser enviados pelos Correios."],
  ["2844", "p", "Material radioativo não pode ser enviado pelos Correios."],
  ["2845", "p", "Isótopos não podem ser enviados pelos Correios."],
  ["3604", "p", "Fogos de artifício não podem ser enviados pelos Correios."],
  ["3605", "p", "Fósforos não podem ser enviados pelos Correios."],
  ["3606", "p", "Combustíveis para isqueiro e artigos inflamáveis não podem ser enviados pelos Correios."],
  ["3813", "p", "Cargas de extintores não podem ser enviadas pelos Correios."],
  ["842410", "p", "Extintores pressurizados não podem ser enviados pelos Correios."],
  ["9613", "p", "Isqueiros não podem ser enviados pelos Correios."],
];

/** Prefixos de NCM que pedem conferência da equipe antes da vitrine. */
const REVIEW_NCM: Array<[prefix: string, item: string, reason: string]> = [
  ["9503", "b", "Brinquedo: a equipe confere se não é réplica ou simulacro de arma de fogo."],
  ["2106", "g", "Preparação alimentícia ou suplemento: a equipe confere se depende de registro na Anvisa."],
  ["2936", "g", "Vitaminas: a equipe confere se dependem de registro na Anvisa."],
  ["9018", "g", "Aparelho médico: a equipe confere o registro na Anvisa."],
  ["9019", "g", "Aparelho de terapia: a equipe confere o registro na Anvisa."],
  ["9021", "g", "Artigo ortopédico: a equipe confere o registro na Anvisa."],
  ["9022", "g", "Aparelho de raios X: a equipe confere as autorizações."],
  ["4301", "h", "Peles: a equipe confere se não são de animal silvestre."],
  ["4302", "h", "Peles: a equipe confere se não são de animal silvestre."],
  ["4303", "h", "Artigos de peles: a equipe confere se não são de animal silvestre."],
  ["7113", "j", "Joia: a equipe confere se não tem diamantes."],
  ["2710", "p", "Óleos e combustíveis: a equipe confere as restrições de transporte dos Correios."],
  ["8506", "p", "Pilhas avulsas: a equipe confere as restrições dos Correios para baterias de lítio."],
  ["8507", "p", "Baterias avulsas: a equipe confere as restrições dos Correios para baterias de lítio."],
];

/** Termos no anúncio: [termo já normalizado, item, só no título/natureza/material]. */
const ANNEX_TERMS: Array<[phrase: string, item: string, titleOnly?: boolean]> = [
  ["arma de fogo", "a"], ["revolver", "a", true], ["fuzil", "a"], ["municao", "a"], ["municoes", "a"], ["polvora", "a"],
  ["explosivo", "a"], ["explosivos", "a"], ["granada", "a", true],
  ["airsoft", "b"], ["simulacro", "b"], ["arma de brinquedo", "b"], ["replica de arma", "b"], ["arma de pressao", "b"],
  ["arma de chumbinho", "b"],
  ["maconha", "c"], ["cannabis", "c"], ["thc", "c", true], ["cbd", "c", true], ["cocaina", "c"], ["anabolizante", "c"],
  ["esteroide", "c"], ["sibutramina", "c"],
  ["vape", "d"], ["vaper", "d"], ["pod descartavel", "d"], ["cigarro eletronico", "d"], ["e cig", "d"],
  ["essencia para pod", "d"], ["juice para vape", "d"],
  ["cigarro", "e", true], ["cigarros", "e", true], ["tabaco", "e"], ["fumo", "e", true], ["charuto", "e"], ["narguile", "e"],
  ["tabacaria", "e"], ["piteira", "e"],
  ["whisky", "f"], ["whiskey", "f"], ["uisque", "f"], ["vodka", "f"], ["vodca", "f"], ["tequila", "f"], ["cachaca", "f"],
  ["conhaque", "f"], ["aguardente", "f"], ["bebida alcoolica", "f"], ["gin", "f", true], ["rum", "f", true],
  ["licor", "f", true], ["vinho", "f", true], ["espumante", "f", true], ["champagne", "f", true], ["cerveja", "f", true],
  ["sake", "f", true],
  ["medicamento", "g", true], ["remedio", "g", true], ["antibiotico", "g"], ["agrotoxico", "g"], ["pesticida", "g"],
  ["marfim", "h"], ["casco de tartaruga", "h"], ["animal empalhado", "h"], ["taxidermia", "h"], ["especie ameacada", "h"],
  ["pele de onca", "h"],
  ["usado", "i", true], ["usada", "i", true], ["usados", "i", true], ["seminovo", "i"], ["seminova", "i"], ["semi novo", "i"],
  ["recondicionado", "i"], ["recondicionada", "i"], ["refurbished", "i"], ["remanufaturado", "i"], ["open box", "i"],
  ["segunda mao", "i"], ["de vitrine", "i"], ["mostruario", "i"],
  ["diamante", "j"], ["diamantes", "j"],
  ["papel moeda", "k"], ["cedulas", "k", true], ["moedas antigas", "k"], ["dinheiro em especie", "k"],
  ["carne", "l", true], ["queijo", "l", true], ["salame", "l", true], ["presunto", "l", true], ["fruta fresca", "l"],
  ["frutas frescas", "l"], ["frutos do mar", "l"], ["pescado", "l", true],
  ["sucata", "m"], ["residuo", "m", true], ["residuos", "m", true], ["amianto", "m"], ["gas refrigerante", "m"],
  ["pornografico", "n"], ["pornografia", "n"], ["conteudo adulto", "n"], ["nazista", "n"], ["suastica", "n"],
  ["replica", "o"], ["primeira linha", "o"], ["aaa", "o", true], ["contratipo", "o"], ["inspirado no", "o"],
  ["inspirado em", "o"], ["inspirada no", "o"], ["similar ao original", "o"], ["tipo original", "o"], ["copia", "o", true],
  ["falsificado", "o"], ["fake", "o", true], ["pirata", "o", true],
  ["aerossol", "p"], ["aerosol", "p"], ["inflamavel", "p"], ["isqueiro", "p"], ["fogos de artificio", "p"],
  ["power bank", "p"], ["powerbank", "p"], ["bateria externa", "p"], ["bateria de litio avulsa", "p"],
];

const annexTitle = (letter: string) => ANNEX_ITEMS.find((a) => a.letter === letter)?.title ?? letter;

/** Primeira restrição do NCM: bloqueio antes de análise. */
export function checkNcmRestriction(code: string | null | undefined): RestrictionHit | null {
  const ncm = (code ?? "").replace(/\D/g, "");
  if (!ncm) return null;
  for (const [prefix, item, reason] of BLOCKED_NCM)
    if (ncm.startsWith(prefix))
      return { level: "Bloqueio", annexItem: item, reason: `${reason} (Anexo I, ${item}, da Política de Vendedores)` };
  for (const [prefix, item, reason] of REVIEW_NCM)
    if (ncm.startsWith(prefix)) return { level: "Analise", annexItem: item, reason: `${reason} (Anexo I, ${item})` };
  return null;
}

/** Termos de oferta vedada: `title` = nome, natureza e material; `body` = descrição (só termos inequívocos). */
export function checkTextRestriction(title: string, body: string | null | undefined): RestrictionHit | null {
  const t = ` ${fold(title)} `;
  const b = ` ${fold(body ?? "")} `;
  for (const [phrase, item, titleOnly] of ANNEX_TERMS) {
    const hit = t.includes(` ${phrase} `) || (!titleOnly && b.includes(` ${phrase} `));
    if (!hit) continue;
    return {
      level: "Analise",
      annexItem: item,
      term: phrase,
      reason: `O anúncio cita "${phrase}", que indica produto de oferta vedada (${annexTitle(item)} — Anexo I, ${item}). A equipe confere antes de publicar.`,
    };
  }
  return null;
}

/** Capítulos aceitos por categoria (slug). Categoria fora do mapa aceita qualquer capítulo permitido. */
const CATEGORY_CHAPTERS: Record<string, string[]> = {
  eletronicos: ["84", "85", "90", "91", "95"],
  perfumes: ["33", "34"],
  informatica: ["84", "85", "90"],
  celulares: ["84", "85", "39", "40", "42", "70", "90"],
  games: ["84", "85", "94", "95"],
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
  const restriction = checkNcmRestriction(code);
  if (restriction?.level === "Bloqueio") return { error: restriction.reason };
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

/** Medidas da Receita por faixa (Programa de Conformidade 11.3). */
export const BAND_CONSEQUENCE: Record<ComplianceBand, string> = {
  Ouro: "Manutenção da certificação sem restrições e monitoramento ordinário.",
  Prata: "Monitoramento ordinário e comunicação formal para aprimoramento dos controles internos.",
  Bronze: "Monitoramento reforçado e plano de ação corretivo em 30 dias.",
  Advertencia: "Advertência formal e plano de ação corretivo em 30 dias.",
  Exclusao: "Início de procedimento para exclusão do PRC, assegurados o contraditório e a ampla defesa.",
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
  /** Política de Vendedores 3.1: denominação social, e-mail, telefone, endereço e meio de pagamento. */
  legalName: string | null;
  email: string | null;
  phone: string | null;
  legalAddress: string | null;
  payoutMethod: SellerPayoutMethod | null;
  payoutInstitution: string | null;
  /** Conta completa (só o mock guarda; a API devolve mascarada). */
  payoutAccount: string | null;
  payoutHolder: string | null;
  responsibleName: string | null;
  responsibleDocumentType: SellerDocumentType | null;
  /** Documento completo (só o mock guarda; a API devolve mascarado). */
  responsibleDocument: string | null;
  /** Política 3.2: documentos (chave privada `doc/…` ou exemplo em /images/kyc). */
  identityDocumentUrl: string | null;
  rucCertificateUrl: string | null;
  taxComplianceCertificateUrl: string | null;
  articlesOfIncorporationUrl: string | null;
  /** Itens conferidos pela equipe na aprovação (3.3). */
  checklist: string[];
  verifiedAt: string | null;
  suspensionReason: string | null;
  suspendedUntil: string | null;
  policyVersionAccepted: string | null;
  policyAcceptedAt: string | null;
  dataConfirmedAt: string | null;
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
export const KYC_TAX_CERTIFICATE_URL = "/images/kyc/certificado-cumplimiento.svg";
export const KYC_ARTICLES_URL = "/images/kyc/atos-constitutivos.svg";

const BANKS = [
  "Banco Continental",
  "Banco Itaú Paraguay",
  "ueno bank",
  "Banco Basa",
  "Banco GNB Paraguay",
  "Visión Banco",
  "Banco Atlas",
  "Banco Familiar",
];

/** "TecnoCentro CDE S.A." / "… S.R.L." (como LegalNameFor da API). */
export const legalNameFor = (storeName: string, index: number) => `${storeName} ${index % 2 === 0 ? "S.A." : "S.R.L."}`;

/** Lojas fixas nascem com cadastro completo, conferido e com a Política aceita (como no seed da API). */
export function seedSellerKyc(seller: SellerDto, index: number): SellerKyc {
  const verified = new Date(seller.memberSince);
  verified.setDate(verified.getDate() + 1);
  const confirmed = new Date(Date.UTC(2026, 8, 25, 10));
  confirmed.setUTCDate(confirmed.getUTCDate() - 20);
  const legalName = legalNameFor(seller.name, index);
  return {
    legalName,
    email: `contato@${seller.slug}.com.py`,
    phone: `+595 61 5${String(index).padStart(2, "0")} ${String(100 + index * 37).padStart(3, "0")}`,
    legalAddress: `${STREETS[seller.city] ?? "Av. Mcal. López"} ${120 + index * 85}, Microcentro`,
    payoutMethod: "ContaBancaria",
    payoutInstitution: BANKS[index % BANKS.length],
    payoutAccount: String(100_000_000 + index * 7_654_321),
    payoutHolder: legalName,
    responsibleName: RESPONSIBLES[index % RESPONSIBLES.length],
    responsibleDocumentType: "CedulaPy",
    responsibleDocument: String(3_100_000 + index * 271_113),
    identityDocumentUrl: KYC_IDENTITY_URL,
    rucCertificateUrl: KYC_RUC_URL,
    taxComplianceCertificateUrl: KYC_TAX_CERTIFICATE_URL,
    articlesOfIncorporationUrl: KYC_ARTICLES_URL,
    checklist: [...SELLER_VERIFICATION_ITEMS],
    verifiedAt: verified.toISOString(),
    suspensionReason: null,
    suspendedUntil: null,
    policyVersionAccepted: INITIAL_SELLER_POLICY_VERSION,
    policyAcceptedAt: new Date(Date.UTC(2026, 9, 9, 12)).toISOString(),
    dataConfirmedAt: confirmed.toISOString(),
  };
}

export const EMPTY_KYC: SellerKyc = {
  legalName: null,
  email: null,
  phone: null,
  legalAddress: null,
  payoutMethod: null,
  payoutInstitution: null,
  payoutAccount: null,
  payoutHolder: null,
  responsibleName: null,
  responsibleDocumentType: null,
  responsibleDocument: null,
  identityDocumentUrl: null,
  rucCertificateUrl: null,
  taxComplianceCertificateUrl: null,
  articlesOfIncorporationUrl: null,
  checklist: [],
  verifiedAt: null,
  suspensionReason: null,
  suspendedUntil: null,
  policyVersionAccepted: null,
  policyAcceptedAt: null,
  dataConfirmedAt: null,
};

/** "100123456" → "*****3456" (conta bancária ou identificador da carteira). */
export function maskAccount(account: string | null): string | null {
  if (!account) return null;
  const a = account.trim();
  return a.length <= 4 ? "*".repeat(a.length) : `${"*".repeat(a.length - 4)}${a.slice(-4)}`;
}

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
