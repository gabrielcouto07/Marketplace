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
  thumbnailUrl: "/images/products/eletronicos-1-1.svg",
  isNew: true,
};

export const PRODUCT_DISCOUNT: ProductSummaryDto = {
  ...base,
  id: "p-2",
  slug: "perfume-importado-100ml",
  name: "Perfume importado 100 ml eau de parfum",
  thumbnailUrl: "/images/products/perfumes-1-1.svg",
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
  thumbnailUrl: "/images/products/informatica-1-1.svg",
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

export const SCALES: Record<"blue" | "red" | "neutral" | "green" | "amber", Swatch[]> = {
  blue: [
    ["50", "#EFF4FD"],
    ["100", "#DCE6FA"],
    ["200", "#BACDF4"],
    ["300", "#8AAAEA"],
    ["400", "#5580DC"],
    ["500", "#2A5DC7"],
    ["600", "#0038A8"],
    ["700", "#002F8E"],
    ["800", "#002672"],
    ["900", "#0A1F52"],
    ["950", "#061333"],
  ].map(([name, hex]) => ({ name, hex })),
  red: [
    ["50", "#FEF2F1"],
    ["100", "#FDE3E0"],
    ["200", "#FAC7C1"],
    ["300", "#F49E95"],
    ["400", "#E96A5D"],
    ["500", "#D52B1E"],
    ["600", "#BA2419"],
    ["700", "#9A1E15"],
    ["800", "#7A1912"],
    ["900", "#56130E"],
  ].map(([name, hex]) => ({ name, hex })),
  neutral: [
    ["0", "#FFFFFF"],
    ["50", "#F8F8F9"],
    ["100", "#F1F1F3"],
    ["200", "#E4E4E8"],
    ["300", "#D0D0D6"],
    ["400", "#A3A3AD"],
    ["500", "#74747F"],
    ["600", "#55555F"],
    ["700", "#3F3F48"],
    ["800", "#28282F"],
    ["900", "#18181D"],
    ["950", "#0F0F12"],
  ].map(([name, hex]) => ({ name, hex })),
  green: [
    ["50", "#F0FDF4"],
    ["600", "#15803D"],
    ["700", "#166534"],
  ].map(([name, hex]) => ({ name, hex })),
  amber: [
    ["50", "#FFFBEB"],
    ["600", "#B45309"],
    ["700", "#92400E"],
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
    fg: "#18181D",
    bg: "#FFFFFF",
    className: "bg-surface text-foreground",
  },
  {
    token: "text / background",
    role: "texto principal na página",
    fg: "#18181D",
    bg: "#F8F8F9",
    className: "bg-background text-foreground",
  },
  {
    token: "text-secondary / surface",
    role: "metadados, descrições",
    fg: "#55555F",
    bg: "#FFFFFF",
    className: "bg-surface text-foreground-secondary",
  },
  {
    token: "text-muted / surface",
    role: "legendas (só sobre surface)",
    fg: "#74747F",
    bg: "#FFFFFF",
    className: "bg-surface text-foreground-muted",
  },
  {
    token: "text-muted / surface-muted",
    role: "placeholder de input",
    fg: "#74747F",
    bg: "#F1F1F3",
    className: "bg-surface-muted text-foreground-muted",
  },
  {
    token: "on-primary / primary",
    role: "botão primário",
    fg: "#FFFFFF",
    bg: "#0038A8",
    className: "bg-primary text-primary-foreground",
  },
  {
    token: "primary / primary-soft",
    role: "chips e badges azuis",
    fg: "#0038A8",
    bg: "#EFF4FD",
    className: "bg-primary-soft text-primary",
  },
  {
    token: "on-cta / cta",
    role: "CTA vermelho",
    fg: "#FFFFFF",
    bg: "#D52B1E",
    className: "bg-cta text-cta-foreground",
  },
  {
    token: "success / success-soft",
    role: "frete grátis, desconto",
    fg: "#15803D",
    bg: "#F0FDF4",
    className: "bg-success-soft text-success",
  },
  {
    token: "success / surface",
    role: "% de desconto no preço",
    fg: "#15803D",
    bg: "#FFFFFF",
    className: "bg-surface text-success",
  },
  {
    token: "warning / warning-soft",
    role: "estoque baixo",
    fg: "#B45309",
    bg: "#FFFBEB",
    className: "bg-warning-soft text-warning",
  },
  {
    token: "danger / danger-soft",
    role: "erros (ícone + texto)",
    fg: "#9A1E15",
    bg: "#FEF2F1",
    className: "bg-danger-soft text-danger",
  },
  {
    token: "white / brand-deep",
    role: "hero, footer, painel",
    fg: "#FFFFFF",
    bg: "#061333",
    className: "bg-brand-deep text-white",
  },
  {
    token: "blue-300 / brand-deep",
    role: "texto secundário no hero",
    fg: "#8AAAEA",
    bg: "#061333",
    className: "bg-brand-deep text-blue-300",
  },
  {
    token: "primary / surface",
    role: "links e ícones ativos",
    fg: "#0038A8",
    bg: "#FFFFFF",
    className: "bg-surface text-primary",
  },
  {
    token: "gold / surface",
    role: "estrelas (ícone, nunca texto)",
    fg: "#FFC629",
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
    name: "display",
    className: "text-display",
    spec: "30/36 · 600 · -0.02em",
    sample: "R$ 1.974,25",
  },
  {
    name: "title-1",
    className: "text-title-1",
    spec: "24/32 · 600 · -0.015em",
    sample: "Meus pedidos",
  },
  {
    name: "title-2",
    className: "text-title-2",
    spec: "20/28 · 600 · -0.01em",
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
