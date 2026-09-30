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

type ScaleName = "coral" | "pervinca" | "menta" | "manteiga" | "tinta" | "papel" | "avulsos";

/** 400 = cor da identidade; 100 = tom suave da identidade; 600+ = tons para texto e ícone. */
export const SCALES: Record<ScaleName, Swatch[]> = {
  coral: [
    ["50", "#FEEFEC"],
    ["100", "#FFE1DB"],
    ["200", "#FEC7BE"],
    ["300", "#FFAB9E"],
    ["400", "#FF8B7B"],
    ["500", "#EA7869"],
    ["600", "#C45C4F"],
    ["700", "#A0463B"],
    ["800", "#7F362D"],
    ["900", "#5D2821"],
  ].map(([name, hex]) => ({ name, hex })),
  pervinca: [
    ["50", "#EEF2FE"],
    ["100", "#E1E8FF"],
    ["200", "#C0D0FE"],
    ["300", "#A0B6FE"],
    ["400", "#7F9BFF"],
    ["500", "#6E88EA"],
    ["600", "#455BB3"],
    ["700", "#364895"],
    ["800", "#283775"],
    ["900", "#1C2754"],
  ].map(([name, hex]) => ({ name, hex })),
  menta: [
    ["50", "#EBFAF1"],
    ["100", "#D6F4E4"],
    ["200", "#ABE9C6"],
    ["300", "#81DCAB"],
    ["400", "#5DCB94"],
    ["500", "#48B882"],
    ["600", "#1E905F"],
    ["700", "#0E764C"],
    ["800", "#075C3A"],
    ["900", "#0A432A"],
  ].map(([name, hex]) => ({ name, hex })),
  manteiga: [
    ["50", "#FFFAEE"],
    ["100", "#FFF1C9"],
    ["200", "#FFE6AD"],
    ["300", "#FFDC89"],
    ["400", "#FFD15C"],
    ["500", "#EBBD46"],
    ["600", "#9F7A00"],
    ["700", "#836400"],
    ["800", "#684F00"],
    ["900", "#4E3A00"],
  ].map(([name, hex]) => ({ name, hex })),
  tinta: [
    ["0", "#FFFFFF"],
    ["50", "#F7F7FC"],
    ["100", "#F1F0F8"],
    ["200", "#E2E2EC"],
    ["300", "#CACBD9"],
    ["400", "#9C9CB1"],
    ["500", "#6A6880"],
    ["600", "#5E5C72"],
    ["700", "#45445F"],
    ["800", "#35344C"],
    ["900", "#26253A"],
    ["950", "#171626"],
  ].map(([name, hex]) => ({ name, hex })),
  papel: [
    ["50", "#F7F6F2"],
    ["100", "#F0EEE9"],
    ["200", "#E4E2DA"],
    ["300", "#D0CEC4"],
  ].map(([name, hex]) => ({ name, hex })),
  avulsos: [
    ["lilás", "#E6E3FF"],
    ["céu", "#E8F1FF"],
    ["gold", "#FFC53D"],
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
/** Pares texto/fundo do tema light com as classes que os produzem. */
export const SEMANTIC_PAIRS: SemanticPair[] = [
  {
    token: "text / surface",
    role: "texto principal em cards",
    fg: "#26253A",
    bg: "#FFFFFF",
    className: "bg-surface text-foreground",
  },
  {
    token: "text / background",
    role: "texto principal na página (Papel)",
    fg: "#26253A",
    bg: "#F7F6F2",
    className: "bg-background text-foreground",
  },
  {
    token: "text-secondary / surface",
    role: "metadados, descrições",
    fg: "#5E5C72",
    bg: "#FFFFFF",
    className: "bg-surface text-foreground-secondary",
  },
  {
    token: "text-muted / surface",
    role: "legendas",
    fg: "#6A6880",
    bg: "#FFFFFF",
    className: "bg-surface text-foreground-muted",
  },
  {
    token: "text-muted / surface-muted",
    role: "placeholder da busca e inputs",
    fg: "#6A6880",
    bg: "#F1F0F8",
    className: "bg-surface-muted text-foreground-muted",
  },
  {
    token: "on-primary / primary",
    role: "botão primário (Pervinca 600)",
    fg: "#FFFFFF",
    bg: "#455BB3",
    className: "bg-primary text-primary-foreground",
  },
  {
    token: "primary / primary-soft",
    role: "chips e badges Pervinca",
    fg: "#455BB3",
    bg: "#E1E8FF",
    className: "bg-primary-soft text-primary",
  },
  {
    token: "primary / surface",
    role: "links e ícones ativos",
    fg: "#455BB3",
    bg: "#FFFFFF",
    className: "bg-surface text-primary",
  },
  {
    token: "on-cta / cta",
    role: "CTA Coral com texto Tinta",
    fg: "#26253A",
    bg: "#FF8B7B",
    className: "bg-cta text-cta-foreground",
  },
  {
    token: "on-cta / cta-hover",
    role: "CTA em hover/pressionado",
    fg: "#26253A",
    bg: "#EA7869",
    className: "bg-cta-hover text-cta-foreground",
  },
  {
    token: "success / success-soft",
    role: "frete grátis, desconto",
    fg: "#0E764C",
    bg: "#D6F4E4",
    className: "bg-success-soft text-success",
  },
  {
    token: "success / surface",
    role: "% de desconto no preço",
    fg: "#0E764C",
    bg: "#FFFFFF",
    className: "bg-surface text-success",
  },
  {
    token: "warning / warning-soft",
    role: "estoque baixo",
    fg: "#684F00",
    bg: "#FFF1C9",
    className: "bg-warning-soft text-warning",
  },
  {
    token: "danger / danger-soft",
    role: "erros (ícone + texto)",
    fg: "#A0463B",
    bg: "#FEEFEC",
    className: "bg-danger-soft text-danger",
  },
  {
    token: "text / brand-ceu",
    role: "hero da home",
    fg: "#26253A",
    bg: "#E8F1FF",
    className: "bg-brand-ceu text-foreground",
  },
  {
    token: "text / brand-lilas",
    role: "ícone do atalho da conta",
    fg: "#26253A",
    bg: "#E6E3FF",
    className: "bg-brand-lilas text-foreground",
  },
  {
    token: "text / brand-manteiga-soft",
    role: "atalho do carrinho, contagem de ofertas",
    fg: "#26253A",
    bg: "#FFF1C9",
    className: "bg-brand-manteiga-soft text-foreground",
  },
  {
    token: "white / brand-deep",
    role: "painel, barra escura, scrim de foto",
    fg: "#FFFFFF",
    bg: "#26253A",
    className: "bg-brand-deep text-white",
  },
  {
    token: "brand-coral-strong / surface",
    role: "ícone do pin do CEP (≥ 3:1)",
    fg: "#C45C4F",
    bg: "#FFFFFF",
    className: "bg-surface text-brand-coral-strong",
    large: true,
  },
  {
    token: "gold / surface",
    role: "estrelas (ícone, nunca texto)",
    fg: "#FFC53D",
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
    spec: "44/48 · Bricolage 800 · -0.02em · saudação ≥ md",
    sample: "Boa tarde!",
  },
  {
    name: "hero",
    className: "font-heading text-hero",
    spec: "32/36 · Bricolage 800 · -0.02em · saudação mobile",
    sample: "Boa tarde!",
  },
  {
    name: "título de seção",
    className: "font-heading text-title-2 font-extrabold tracking-[-0.02em]",
    spec: "20/28 · Bricolage 800 · -0.02em · SectionHeader",
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
