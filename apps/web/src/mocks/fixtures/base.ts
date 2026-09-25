import type {
  CategoryDto,
  ExchangeRateDto,
  SellerDto,
  SellerSummaryDto,
} from "@marketplace/contracts";

/** PRNG determinístico (mulberry32) para fixtures estáveis entre servidor e cliente. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** GUID determinístico a partir de uma chave (formato v4-like). */
export function guid(key: string): string {
  const rnd = seeded(hashString(key));
  const hex = () => Math.floor(rnd() * 16).toString(16);
  const seg = (n: number) => Array.from({ length: n }, hex).join("");
  return `${seg(8)}-${seg(4)}-4${seg(3)}-a${seg(3)}-${seg(12)}`;
}

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isoDaysAgo(days: number, hour = 10): string {
  const d = new Date(Date.UTC(2026, 8, 25, hour, 0, 0)); // data-base fixa: 25/09/2026
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Câmbio: 1 BRL = 1.389 PYG ; 1 USD = 5,40 BRL
// PYG (guaranis inteiros) → BRL (centavos): 72 / 1000
// BRL (centavos) → PYG (guaranis): 1389 / 100
// ---------------------------------------------------------------------------
export const EXCHANGE_RATES: ExchangeRateDto[] = [
  {
    id: guid("rate:BRL:PYG"),
    from: "BRL",
    to: "PYG",
    numerator: 1389,
    denominator: 100,
    displayRate: "R$ 1,00 = ₲ 1.389",
    quotedAt: isoDaysAgo(0, 9),
    expiresAt: isoDaysFromNow(1),
  },
  {
    id: guid("rate:PYG:BRL"),
    from: "PYG",
    to: "BRL",
    numerator: 72,
    denominator: 1000,
    displayRate: "₲ 1.000 = R$ 0,72",
    quotedAt: isoDaysAgo(0, 9),
    expiresAt: isoDaysFromNow(1),
  },
  {
    id: guid("rate:USD:BRL"),
    from: "USD",
    to: "BRL",
    numerator: 540,
    denominator: 100,
    displayRate: "US$ 1,00 = R$ 5,40",
    quotedAt: isoDaysAgo(0, 9),
    expiresAt: isoDaysFromNow(1),
  },
];

export function getRate(from: ExchangeRateDto["from"], to: ExchangeRateDto["to"]): ExchangeRateDto {
  const rate = EXCHANGE_RATES.find((r) => r.from === from && r.to === to);
  if (!rate) throw new Error(`Sem taxa ${from}->${to}`);
  return rate;
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------
const CATEGORY_SEED: Array<Pick<CategoryDto, "slug" | "name" | "iconKey">> = [
  { slug: "eletronicos", name: "Eletrônicos", iconKey: "tv" },
  { slug: "perfumes", name: "Perfumes", iconKey: "spray-can" },
  { slug: "informatica", name: "Informática", iconKey: "laptop" },
  { slug: "celulares", name: "Celulares", iconKey: "smartphone" },
  { slug: "bebidas", name: "Bebidas", iconKey: "wine" },
  { slug: "casa", name: "Casa", iconKey: "sofa" },
  { slug: "esportes", name: "Esportes", iconKey: "dumbbell" },
  { slug: "moda", name: "Moda", iconKey: "shirt" },
];

export const CATEGORIES: CategoryDto[] = CATEGORY_SEED.map((c) => ({
  id: guid(`category:${c.slug}`),
  slug: c.slug,
  name: c.name,
  iconKey: c.iconKey,
  imageUrl: `/images/categories/${c.slug}.svg`,
  parentId: null,
  productCount: 8,
}));

export const categoryBySlug = (slug: string): CategoryDto | undefined =>
  CATEGORIES.find((c) => c.slug === slug);
export const categoryById = (id: string): CategoryDto | undefined =>
  CATEGORIES.find((c) => c.id === id);

// ---------------------------------------------------------------------------
// Vendedores (8 lojas)
// ---------------------------------------------------------------------------
interface SellerSeed {
  slug: string;
  name: string;
  city: string;
  reputationLevel: SellerSummaryDto["reputationLevel"];
  isOfficialStore: boolean;
  ruc: string;
  memberSinceDays: number;
  categories: string[];
  description: string;
  salesCount: number;
  positive: number;
  onTime: number;
  response: number;
  rating: number;
  reviewCount: number;
}

const SELLER_SEED: SellerSeed[] = [
  {
    slug: "tecnocentro-cde",
    name: "TecnoCentro CDE",
    city: "Ciudad del Este",
    reputationLevel: 5,
    isOfficialStore: true,
    ruc: "80012345-6",
    memberSinceDays: 1460,
    categories: ["eletronicos", "informatica", "celulares"],
    description:
      "Loja de eletrônicos no centro de Ciudad del Este com mais de 10 anos de experiência. Produtos lacrados, nota fiscal e garantia com assistência no Brasil.",
    salesCount: 18420,
    positive: 98,
    onTime: 97,
    response: 2,
    rating: 4.8,
    reviewCount: 6210,
  },
  {
    slug: "perfumaria-del-este",
    name: "Perfumaria del Este",
    city: "Ciudad del Este",
    reputationLevel: 5,
    isOfficialStore: true,
    ruc: "80023456-3",
    memberSinceDays: 1100,
    categories: ["perfumes"],
    description:
      "Importadora oficial de fragrâncias. Todos os perfumes são originais, lacrados e com lote verificável.",
    salesCount: 9310,
    positive: 99,
    onTime: 96,
    response: 1,
    rating: 4.9,
    reviewCount: 3120,
  },
  {
    slug: "casa-nova-import",
    name: "Casa Nova Import",
    city: "Ciudad del Este",
    reputationLevel: 4,
    isOfficialStore: false,
    ruc: "80034567-0",
    memberSinceDays: 720,
    categories: ["casa"],
    description:
      "Eletroportáteis e utilidades para o lar com voltagem bivolt e manual em português.",
    salesCount: 4120,
    positive: 95,
    onTime: 93,
    response: 4,
    rating: 4.6,
    reviewCount: 1210,
  },
  {
    slug: "megastore-paraguay",
    name: "MegaStore Paraguay",
    city: "Asunción",
    reputationLevel: 4,
    isOfficialStore: false,
    ruc: "80045678-8",
    memberSinceDays: 900,
    categories: ["eletronicos", "informatica", "celulares", "casa"],
    description:
      "Variedade em tecnologia e casa com envio de Assunção. Estoque próprio e atendimento em português.",
    salesCount: 7780,
    positive: 94,
    onTime: 92,
    response: 5,
    rating: 4.5,
    reviewCount: 2440,
  },
  {
    slug: "nippon-center",
    name: "Nippon Center",
    city: "Ciudad del Este",
    reputationLevel: 5,
    isOfficialStore: true,
    ruc: "80056789-5",
    memberSinceDays: 2000,
    categories: ["celulares", "eletronicos"],
    description:
      "Especialista em smartphones e acessórios. Aparelhos com garantia estendida e suporte pós-venda.",
    salesCount: 22150,
    positive: 97,
    onTime: 98,
    response: 1,
    rating: 4.8,
    reviewCount: 8020,
  },
  {
    slug: "bebidas-del-puente",
    name: "Bebidas del Puente",
    city: "Ciudad del Este",
    reputationLevel: 3,
    isOfficialStore: false,
    ruc: "80067890-2",
    memberSinceDays: 400,
    categories: ["bebidas"],
    description:
      "Destilados, vinhos e espumantes importados. Embalagem reforçada para transporte internacional.",
    salesCount: 1560,
    positive: 90,
    onTime: 88,
    response: 8,
    rating: 4.2,
    reviewCount: 430,
  },
  {
    slug: "sport-house-py",
    name: "Sport House PY",
    city: "Salto del Guairá",
    reputationLevel: 4,
    isOfficialStore: false,
    ruc: "80078901-9",
    memberSinceDays: 610,
    categories: ["esportes"],
    description:
      "Equipamentos de esporte e outdoor. Envio de Salto del Guairá com rastreio completo.",
    salesCount: 2980,
    positive: 96,
    onTime: 94,
    response: 3,
    rating: 4.7,
    reviewCount: 890,
  },
  {
    slug: "moda-guarani",
    name: "Moda Guaraní",
    city: "Pedro Juan Caballero",
    reputationLevel: 3,
    isOfficialStore: false,
    ruc: "80089012-7",
    memberSinceDays: 250,
    categories: ["moda"],
    description: "Acessórios, calçados e vestuário com curadoria. Troca garantida em até 30 dias.",
    salesCount: 870,
    positive: 91,
    onTime: 90,
    response: 6,
    rating: 4.3,
    reviewCount: 260,
  },
];

export const SELLERS: SellerDto[] = SELLER_SEED.map((s) => ({
  id: guid(`seller:${s.slug}`),
  slug: s.slug,
  name: s.name,
  logoUrl: `/images/sellers/${s.slug}.svg`,
  reputationLevel: s.reputationLevel,
  isOfficialStore: s.isOfficialStore,
  city: s.city,
  description: s.description,
  ruc: s.ruc,
  country: "PY",
  memberSince: isoDaysAgo(s.memberSinceDays),
  rating: s.rating,
  reviewCount: s.reviewCount,
  productCount: 0,
  metrics: {
    salesCount: s.salesCount,
    positiveRatingPercent: s.positive,
    onTimeShippingPercent: s.onTime,
    avgResponseTimeHours: s.response,
  },
  exchangePolicy:
    "Trocas e devoluções em até 30 dias após o recebimento para produtos lacrados ou com defeito de fabricação. O frete de devolução é por conta da loja em caso de defeito.",
  bannerUrl: `/images/banners/seller-${s.slug}.svg`,
  categories: s.categories
    .map((slug) => categoryBySlug(slug))
    .filter((c): c is CategoryDto => Boolean(c))
    .map((c) => ({ id: c.id, slug: c.slug, name: c.name })),
}));

export function toSellerSummary(s: SellerDto): SellerSummaryDto {
  return {
    id: s.id,
    slug: s.slug,
    name: s.name,
    logoUrl: s.logoUrl,
    reputationLevel: s.reputationLevel,
    isOfficialStore: s.isOfficialStore,
    city: s.city,
  };
}

export const sellerBySlug = (slug: string): SellerDto | undefined =>
  SELLERS.find((s) => s.slug === slug);
export const sellerById = (id: string): SellerDto | undefined => SELLERS.find((s) => s.id === id);
