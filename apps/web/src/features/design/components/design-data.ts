import type {
  OrderTimelineEventDto,
  ProductSummaryDto,
  SellerSummaryDto,
} from "@marketplace/contracts";

/* Dados de exemplo do styleguide — estáticos, sem MSW. */

export const SELLER: SellerSummaryDto = {
  id: "seller-demo",
  slug: "tecnocentro-cde",
  name: "TecnoCentro CDE",
  logoUrl: null,
  reputationLevel: 5,
  isOfficialStore: true,
  city: "Ciudad del Este",
};

const base: Omit<ProductSummaryDto, "id" | "slug" | "name" | "thumbnailUrl"> = {
  price: { amount: 97425, currency: "BRL" },
  compareAtPrice: null,
  referencePrice: { amount: 1_420_000, currency: "PYG" },
  discountPercent: 0,
  rating: 4.7,
  reviewCount: 128,
  soldCount: 1540,
  stock: 12,
  freeShipping: true,
  isNew: false,
  isOffer: false,
  categoryId: "eletronicos",
  seller: SELLER,
  createdAt: "2025-09-01T10:00:00.000Z",
};

export const PRODUCT_NORMAL: ProductSummaryDto = {
  ...base,
  id: "p-1",
  slug: "fone-bluetooth-anc",
  name: "Fone de ouvido Bluetooth com cancelamento de ruído e estojo de carga",
  thumbnailUrl: "/images/products/eletronicos-1-1.webp",
  isNew: true,
};

export const PRODUCT_DISCOUNT: ProductSummaryDto = {
  ...base,
  id: "p-2",
  slug: "perfume-importado-100ml",
  name: "Perfume importado 100 ml eau de parfum",
  thumbnailUrl: "/images/products/perfumes-1-1.webp",
  price: { amount: 38990, currency: "BRL" },
  compareAtPrice: { amount: 51990, currency: "BRL" },
  referencePrice: { amount: 568_000, currency: "PYG" },
  discountPercent: 25,
  isOffer: true,
  freeShipping: false,
  categoryId: "perfumes",
};

export const PRODUCT_SOLD_OUT: ProductSummaryDto = {
  ...base,
  id: "p-3",
  slug: "notebook-14-i5",
  name: 'Notebook 14" Core i5 16 GB RAM 512 GB SSD',
  thumbnailUrl: "/images/products/informatica-1-1.webp",
  price: { amount: 329900, currency: "BRL" },
  referencePrice: { amount: 4_810_000, currency: "PYG" },
  stock: 0,
  reviewCount: 42,
  soldCount: 310,
  categoryId: "informatica",
};

export const TIMELINE_EVENTS: OrderTimelineEventDto[] = [
  {
    status: "AguardandoPagamento",
    occurredAt: "2025-09-18T14:02:00.000Z",
    description: null,
    location: null,
  },
  {
    status: "Pago",
    occurredAt: "2025-09-18T14:05:00.000Z",
    description: "Pix confirmado",
    location: null,
  },
  {
    status: "EmPreparacao",
    occurredAt: "2025-09-19T12:30:00.000Z",
    description: null,
    location: "Ciudad del Este, PY",
  },
  {
    status: "Enviado",
    occurredAt: "2025-09-20T09:10:00.000Z",
    description: "Objeto postado",
    location: "Ciudad del Este, PY",
  },
  {
    status: "EmTransitoInternacional",
    occurredAt: "2025-09-21T18:40:00.000Z",
    description: "Objeto encaminhado para o Brasil",
    location: "Foz do Iguaçu, PR",
  },
];

export interface Swatch {
  name: string;
  hex: string;
}

type ScaleName =
  "vermelho" | "azul" | "verde" | "amarelo" | "laranja" | "tinta" | "papel" | "avulsos";

/** Escalas vivas: 500 (400 no Amarelo e no Laranja) = cor da marca; 600+ = tons de texto e ícone. */
export const SCALES: Record<ScaleName, Swatch[]> = {
  vermelho: [
    ["50", "#FFF1F2"],
    ["100", "#FFE0E3"],
    ["200", "#FFC2C8"],
    ["300", "#FF94A0"],
    ["400", "#FF5468"],
    ["500", "#F2263E"],
    ["600", "#D3102E"],
    ["700", "#AD0B25"],
    ["800", "#89051B"],
    ["900", "#640311"],
  ].map(([name, hex]) => ({ name, hex })),
  azul: [
    ["50", "#F0F5FF"],
    ["100", "#E0EBFF"],
    ["200", "#C2D6FF"],
    ["300", "#94B8FF"],
    ["400", "#5C8FFF"],
    ["500", "#2E6BFF"],
    ["600", "#1552EB"],
    ["700", "#0B44C8"],
    ["800", "#0634A0"],
    ["900", "#06267A"],
    ["950", "#0A1733"],
  ].map(([name, hex]) => ({ name, hex })),
  verde: [
    ["50", "#EBFFF0"],
    ["100", "#CCF8D8"],
    ["200", "#9EEDB4"],
    ["300", "#5EDB86"],
    ["400", "#1FC762"],
    ["500", "#00B852"],
    ["600", "#038539"],
    ["700", "#026F2F"],
    ["800", "#065724"],
    ["900", "#003F17"],
  ].map(([name, hex]) => ({ name, hex })),
  amarelo: [
    ["50", "#FFFBEB"],
    ["100", "#FFF3C2"],
    ["200", "#FFE98A"],
    ["300", "#FFDD47"],
    ["400", "#FFD20A"],
    ["500", "#F0BE00"],
    ["600", "#C79A00"],
    ["700", "#8A6B00"],
    ["800", "#6B5300"],
    ["900", "#4D3B00"],
  ].map(([name, hex]) => ({ name, hex })),
  laranja: [
    ["50", "#FFF6EB"],
    ["100", "#FFE8CC"],
    ["200", "#FFD199"],
    ["300", "#FFB55C"],
    ["400", "#FF9500"],
    ["500", "#F07E00"],
    ["600", "#C76400"],
    ["700", "#9C4D00"],
    ["800", "#7A3C00"],
    ["900", "#592B00"],
  ].map(([name, hex]) => ({ name, hex })),
  tinta: [
    ["0", "#FFFFFF"],
    ["50", "#F7F8FA"],
    ["100", "#EFF1F4"],
    ["200", "#E1E5EA"],
    ["300", "#CDD3DA"],
    ["400", "#98A1AD"],
    ["500", "#5A6575"],
    ["600", "#4A5563"],
    ["700", "#353F4D"],
    ["800", "#1F2937"],
    ["900", "#0F1729"],
    ["950", "#080D1A"],
  ].map(([name, hex]) => ({ name, hex })),
  papel: [
    ["50", "#EAEDF0"],
    ["100", "#E1E5E9"],
    ["200", "#D5DAE0"],
    ["300", "#BCC3CC"],
  ].map(([name, hex]) => ({ name, hex })),
  avulsos: [
    ["marinho claro", "#15284D"],
    ["gold", "#FFA41C"],
  ].map(([name, hex]) => ({ name, hex })),
};

export interface SemanticPair {
  token: string;
  role: string;
  fg: string;
  bg: string;
  /** Classes para renderizar a amostra. */
  className: string;
  /** Texto grande/ícone: aceita AA-large. */
  large?: boolean;
}

/** Pares texto/fundo do tema light com as classes que os produzem. */
export const SEMANTIC_PAIRS: SemanticPair[] = [
  {
    token: "text / surface",
    role: "texto principal em cards",
    fg: "#0F1729",
    bg: "#FFFFFF",
    className: "bg-surface text-foreground",
  },
  {
    token: "text / background",
    role: "texto principal na página (Papel)",
    fg: "#0F1729",
    bg: "#EAEDF0",
    className: "bg-background text-foreground",
  },
  {
    token: "text-secondary / background",
    role: "metadados sobre o fundo cinza",
    fg: "#4A5563",
    bg: "#EAEDF0",
    className: "bg-background text-foreground-secondary",
  },
  {
    token: "text-muted / surface",
    role: "legendas",
    fg: "#5A6575",
    bg: "#FFFFFF",
    className: "bg-surface text-foreground-muted",
  },
  {
    token: "text-muted / surface-muted",
    role: "placeholder e inputs",
    fg: "#5A6575",
    bg: "#EFF1F4",
    className: "bg-surface-muted text-foreground-muted",
  },
  {
    token: "on-primary / primary",
    role: "botão primário (Azul 600)",
    fg: "#FFFFFF",
    bg: "#1552EB",
    className: "bg-primary text-primary-foreground",
  },
  {
    token: "primary / primary-soft",
    role: "chips e badges Azul",
    fg: "#1552EB",
    bg: "#E0EBFF",
    className: "bg-primary-soft text-primary",
  },
  {
    token: "primary / background",
    role: "links “Ver tudo” sobre o fundo cinza",
    fg: "#1552EB",
    bg: "#EAEDF0",
    className: "bg-background text-primary",
  },
  {
    token: "on-cta / cta",
    role: "CTA Laranja com texto Tinta",
    fg: "#0F1729",
    bg: "#FF9500",
    className: "bg-cta text-cta-foreground",
  },
  {
    token: "on-cta / cta-hover",
    role: "CTA em hover/pressionado",
    fg: "#0F1729",
    bg: "#F07E00",
    className: "bg-cta-hover text-cta-foreground",
  },
  {
    token: "on-cart / cart",
    role: "Adicionar ao carrinho (Amarelo)",
    fg: "#0F1729",
    bg: "#FFD20A",
    className: "bg-cart text-cart-foreground",
  },
  {
    token: "on-deal / deal",
    role: "selo “Oferta” e “-25%” chapado",
    fg: "#FFFFFF",
    bg: "#D3102E",
    className: "bg-deal text-deal-foreground",
  },
  {
    token: "deal / surface",
    role: "“-25%” ao lado do preço",
    fg: "#D3102E",
    bg: "#FFFFFF",
    className: "bg-surface text-deal",
  },
  {
    token: "success / surface",
    role: "frete grátis",
    fg: "#026F2F",
    bg: "#FFFFFF",
    className: "bg-surface text-success",
  },
  {
    token: "success / success-soft",
    role: "badges de sucesso",
    fg: "#026F2F",
    bg: "#CCF8D8",
    className: "bg-success-soft text-success",
  },
  {
    token: "warning / warning-soft",
    role: "estoque baixo",
    fg: "#6B5300",
    bg: "#FFF3C2",
    className: "bg-warning-soft text-warning",
  },
  {
    token: "danger / danger-soft",
    role: "erros (ícone + texto)",
    fg: "#AD0B25",
    bg: "#FFF1F2",
    className: "bg-danger-soft text-danger",
  },
  {
    token: "white / brand-deep",
    role: "barra Marinho, footer, painel, scrim",
    fg: "#FFFFFF",
    bg: "#0A1733",
    className: "bg-brand-deep text-white",
  },
  {
    token: "white / brand-deep-raised",
    role: "faixa de departamentos, “Voltar ao início”",
    fg: "#FFFFFF",
    bg: "#15284D",
    className: "bg-brand-deep-raised text-white",
  },
  {
    token: "brand-amarelo / brand-deep",
    role: "“IMPORTS” do wordmark, foco no Marinho",
    fg: "#FFD20A",
    bg: "#0A1733",
    className: "bg-brand-deep text-brand-amarelo",
  },
  {
    token: "white / brand-azul",
    role: "ícone em círculo Azul (≥ 3:1)",
    fg: "#FFFFFF",
    bg: "#2E6BFF",
    className: "bg-brand-azul text-white",
    large: true,
  },
  {
    token: "white / brand-vermelho",
    role: "ícone em círculo Vermelho (≥ 3:1)",
    fg: "#FFFFFF",
    bg: "#F2263E",
    className: "bg-brand-vermelho text-white",
    large: true,
  },
  {
    token: "on-bright / brand-verde",
    role: "ícone em círculo Verde",
    fg: "#0F1729",
    bg: "#00B852",
    className: "bg-brand-verde text-on-bright",
    large: true,
  },
  {
    token: "on-bright / brand-amarelo",
    role: "ícone em círculo Amarelo",
    fg: "#0F1729",
    bg: "#FFD20A",
    className: "bg-brand-amarelo text-on-bright",
    large: true,
  },
  {
    token: "gold / surface",
    role: "estrelas (ícone, nunca texto)",
    fg: "#FFA41C",
    bg: "#FFFFFF",
    className: "bg-surface text-gold",
    large: true,
  },
];

export interface TypeStep {
  name: string;
  className: string;
  spec: string;
  sample: string;
}

export const TYPE_SCALE: TypeStep[] = [
  {
    name: "hero-lg",
    className: "font-heading text-hero-lg",
    spec: "44/48 · Bricolage 800 · -0.02em · manchete do banner ≥ md",
    sample: "Ofertas de tecnologia",
  },
  {
    name: "hero",
    className: "font-heading text-hero",
    spec: "32/36 · Bricolage 800 · -0.02em · manchete do banner",
    sample: "Ofertas de tecnologia",
  },
  {
    name: "título de seção",
    className: "text-title-2 font-bold",
    spec: "20/28 · Figtree 700 · SectionHeader e quad cards",
    sample: "Ofertas do dia",
  },
  {
    name: "display",
    className: "text-display",
    spec: "30/36 · Figtree 600 · -0.02em · valores",
    sample: "R$ 1.974,25",
  },
  {
    name: "title-1",
    className: "text-title-1",
    spec: "24/32 · Figtree 600 · -0.015em",
    sample: "Meus pedidos",
  },
  {
    name: "title-2",
    className: "text-title-2",
    spec: "20/28 · Figtree 600 · -0.01em",
    sample: "Ofertas do dia",
  },
  {
    name: "title-3",
    className: "text-title-3",
    spec: "17/24 · 600",
    sample: "Fone Bluetooth com cancelamento de ruído",
  },
  {
    name: "body",
    className: "text-body",
    spec: "16/24 · 400",
    sample: "Compre do Paraguai com preço, frete e impostos claros antes de pagar.",
  },
  {
    name: "body-sm",
    className: "text-body-sm",
    spec: "14/20 · 400",
    sample: "12x R$ 81,19 sem juros · Enviado de Ciudad del Este",
  },
  {
    name: "caption",
    className: "text-caption",
    spec: "12/16 · 500 · +0.01em",
    sample: "FRETE GRÁTIS · ≈ ₲ 1.420.000",
  },
];
