import type {
  Money,
  OrderDto,
  OrderItemDto,
  OrderStatus,
  OrderTimelineEventDto,
  PaymentDto,
  PaymentMethod,
  ProductDetailDto,
  ShippingOptionDto,
  TrackingEventDto,
} from "@marketplace/contracts";
import { ORDER_HAPPY_PATH } from "@marketplace/contracts";

import { convert, multiplyBasisPoints, sum } from "@/lib/money";

import { DEMO_ADDRESSES } from "./account";
import { getRate, guid, isoDaysAgo } from "./base";
import { PRODUCTS } from "./products";
import { quoteShipping } from "./shipping";

/** Alíquota estimada de importação (60% imposto + ICMS simplificado ≈ 92% nas remessas; aqui 60% para demo). */
export const IMPORT_TAX_BASIS_POINTS = 6000;

export const TIMELINE_DESCRIPTIONS: Record<OrderStatus, string> = {
  AguardandoPagamento: "Pedido criado. Aguardando confirmação do pagamento.",
  Pago: "Pagamento aprovado.",
  EmPreparacao: "O vendedor está separando e embalando o pedido.",
  Enviado: "Pedido postado no Paraguai.",
  EmTransitoInternacional: "Em trânsito internacional / desembaraço aduaneiro.",
  Entregue: "Pedido entregue ao destinatário.",
  Concluido: "Pedido concluído. Obrigado pela compra!",
  Cancelado: "Pedido cancelado.",
  EmDisputa: "Disputa aberta. Nossa equipe está mediando.",
  Devolvido: "Produto devolvido ao vendedor.",
  Reembolsado: "Reembolso processado no meio de pagamento original.",
};

function buildTimeline(status: OrderStatus, createdDaysAgo: number): OrderTimelineEventDto[] {
  const path: OrderStatus[] = [];
  if (status === "Cancelado") path.push("AguardandoPagamento", "Cancelado");
  else if (status === "EmDisputa") path.push(...ORDER_HAPPY_PATH.slice(0, 6), "EmDisputa");
  else if (status === "Devolvido")
    path.push(...ORDER_HAPPY_PATH.slice(0, 6), "EmDisputa", "Devolvido");
  else if (status === "Reembolsado")
    path.push(...ORDER_HAPPY_PATH.slice(0, 6), "EmDisputa", "Devolvido", "Reembolsado");
  else path.push(...ORDER_HAPPY_PATH.slice(0, ORDER_HAPPY_PATH.indexOf(status) + 1));

  const step = Math.max(1, Math.floor(createdDaysAgo / Math.max(1, path.length)));
  return path.map((s, i) => ({
    status: s,
    occurredAt: isoDaysAgo(createdDaysAgo - i * step, 9 + i),
    description: TIMELINE_DESCRIPTIONS[s],
    location:
      s === "Enviado"
        ? "Ciudad del Este, PY"
        : s === "EmTransitoInternacional"
          ? "Curitiba, PR"
          : null,
  }));
}

function buildTracking(
  status: OrderStatus,
  createdDaysAgo: number,
  city: string,
): TrackingEventDto[] {
  const reached = (s: OrderStatus) => {
    const order: OrderStatus[] = [
      "Enviado",
      "EmTransitoInternacional",
      "Entregue",
      "Concluido",
      "EmDisputa",
      "Devolvido",
      "Reembolsado",
    ];
    return order.indexOf(status) >= order.indexOf(s);
  };
  const events: TrackingEventDto[] = [];
  if (!reached("Enviado")) return events;
  events.push({
    code: "POSTED",
    description: "Objeto postado",
    location: `${city}, PY`,
    occurredAt: isoDaysAgo(createdDaysAgo - 3, 15),
  });
  events.push({
    code: "EXPORT",
    description: "Objeto encaminhado para exportação",
    location: "Asunción, PY",
    occurredAt: isoDaysAgo(createdDaysAgo - 4, 9),
  });
  if (reached("EmTransitoInternacional")) {
    events.push({
      code: "ARRIVED_BR",
      description: "Objeto recebido no Brasil",
      location: "Curitiba, PR",
      occurredAt: isoDaysAgo(createdDaysAgo - 7, 11),
    });
    events.push({
      code: "CUSTOMS",
      description: "Em fiscalização aduaneira",
      location: "Curitiba, PR",
      occurredAt: isoDaysAgo(createdDaysAgo - 8, 14),
    });
    events.push({
      code: "CUSTOMS_RELEASED",
      description: "Liberado pela fiscalização",
      location: "Curitiba, PR",
      occurredAt: isoDaysAgo(createdDaysAgo - 10, 10),
    });
  }
  if (reached("Entregue")) {
    events.push({
      code: "OUT_FOR_DELIVERY",
      description: "Saiu para entrega",
      location: "São Paulo, SP",
      occurredAt: isoDaysAgo(createdDaysAgo - 13, 8),
    });
    events.push({
      code: "DELIVERED",
      description: "Objeto entregue ao destinatário",
      location: "São Paulo, SP",
      occurredAt: isoDaysAgo(createdDaysAgo - 13, 14),
    });
  }
  return events;
}

export function buildOrderItems(
  products: Array<{ product: ProductDetailDto; quantity: number; variantId?: string | null }>,
): OrderItemDto[] {
  return products.map(({ product, quantity, variantId = null }, i) => {
    const variant = variantId ? product.variants.find((v) => v.id === variantId) : null;
    const unit = variant?.price ?? product.price;
    return {
      id: guid(`orderitem:${product.id}:${i}`),
      productId: product.id,
      productSlug: product.slug,
      variantId,
      name: product.name,
      variantLabel: variant ? Object.values(variant.attributes).join(" / ") : null,
      thumbnailUrl: product.thumbnailUrl,
      quantity,
      unitPrice: unit,
      lineTotal: { amount: unit.amount * quantity, currency: unit.currency },
    };
  });
}

export function computeTotals(items: OrderItemDto[], shipping: Money) {
  const subtotal = sum(items.map((i) => i.lineTotal));
  const importTax = multiplyBasisPoints(
    { amount: subtotal.amount + shipping.amount, currency: "BRL" },
    IMPORT_TAX_BASIS_POINTS,
  );
  const total = sum([subtotal, shipping, importTax]);
  return {
    subtotal,
    shipping,
    importTax,
    discount: { amount: 0, currency: "BRL" } as Money,
    total,
    totalReference: convert(total, getRate("BRL", "PYG")),
  };
}

let orderSeq = 100200;
export function nextOrderNumber(): string {
  orderSeq += 1;
  return `PY-2026-${String(orderSeq).padStart(6, "0")}`;
}

interface SeedOrder {
  status: OrderStatus;
  daysAgo: number;
  productIdx: number[];
  method: PaymentMethod;
}

const SEED: SeedOrder[] = [
  { status: "AguardandoPagamento", daysAgo: 0, productIdx: [24, 27], method: "Pix" },
  { status: "Pago", daysAgo: 1, productIdx: [8], method: "Cartao" },
  { status: "EmPreparacao", daysAgo: 3, productIdx: [16, 19], method: "Pix" },
  { status: "Enviado", daysAgo: 6, productIdx: [40], method: "Boleto" },
  { status: "EmTransitoInternacional", daysAgo: 12, productIdx: [1, 7], method: "Cartao" },
  { status: "Entregue", daysAgo: 20, productIdx: [33], method: "Pix" },
  { status: "Concluido", daysAgo: 45, productIdx: [56, 58], method: "Cartao" },
  { status: "Cancelado", daysAgo: 15, productIdx: [12], method: "Boleto" },
  { status: "EmDisputa", daysAgo: 28, productIdx: [48], method: "Pix" },
  { status: "Devolvido", daysAgo: 60, productIdx: [3], method: "Cartao" },
  { status: "Reembolsado", daysAgo: 90, productIdx: [9], method: "Pix" },
];

function paymentStatusFor(status: OrderStatus): PaymentDto["status"] {
  if (status === "AguardandoPagamento") return "Pendente";
  if (status === "Cancelado") return "Expirado";
  if (status === "Reembolsado") return "Estornado";
  return "Aprovado";
}

export function buildPayment(input: {
  id: string;
  purchaseId: string;
  method: PaymentMethod;
  amount: Money;
  createdAt: string;
  status: PaymentDto["status"];
  installments?: number;
}): PaymentDto {
  const { id, purchaseId, method, amount, createdAt, status, installments = 1 } = input;
  const expires = new Date(createdAt);
  expires.setMinutes(expires.getMinutes() + 30);
  const due = new Date(createdAt);
  due.setDate(due.getDate() + 3);
  const digits = amount.amount.toString().padStart(10, "0");
  return {
    id,
    purchaseId,
    method,
    status,
    amount,
    createdAt,
    paidAt: status === "Aprovado" ? createdAt : null,
    pix:
      method === "Pix"
        ? {
            qrCodePayload: `00020126580014br.gov.bcb.pix0136${purchaseId}52040000530398654${digits.length.toString().padStart(2, "0")}${digits}5802BR5915MKTPY PAGAMENTOS6009SAO PAULO62070503***6304ABCD`,
            qrCodeImageUrl: null,
            expiresAt: expires.toISOString(),
          }
        : null,
    boleto:
      method === "Boleto"
        ? {
            barcode: `23790${digits}00000000000000000000000000000000`.slice(0, 44),
            digitableLine: `23790.${digits.slice(0, 5)} ${digits.slice(5, 10)}.000000 00000.000000 1 ${digits}`,
            pdfUrl: `/api/payments/${id}/boleto.pdf`,
            dueDate: due.toISOString(),
          }
        : null,
    card:
      method === "Cartao"
        ? {
            brand: "Visa",
            last4: "4242",
            installments,
            installmentAmount: {
              amount: Math.ceil(amount.amount / installments),
              currency: amount.currency,
            },
          }
        : null,
  };
}

function buildSeedOrders(): { orders: OrderDto[]; payments: PaymentDto[] } {
  const orders: OrderDto[] = [];
  const payments: PaymentDto[] = [];
  const address = DEMO_ADDRESSES[0];

  SEED.forEach((seed, idx) => {
    const products = seed.productIdx.map((i) => PRODUCTS[i % PRODUCTS.length]);
    const seller = products[0].seller;
    const items = buildOrderItems(products.map((p) => ({ product: p, quantity: 1 })));
    const options = quoteShipping(
      address.postalCode,
      seller.id,
      items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.quantity })),
      products.every((p) => p.freeShipping),
    );
    const shippingOption: ShippingOptionDto = options[idx % 2];
    const totals = computeTotals(items, shippingOption.price);
    const createdAt = isoDaysAgo(seed.daysAgo, 10);
    const purchaseId = guid(`purchase:seed:${idx}`);
    const paymentId = guid(`payment:seed:${idx}`);
    const min = new Date(createdAt);
    min.setDate(min.getDate() + shippingOption.estimatedDays.min + 2);
    const max = new Date(createdAt);
    max.setDate(max.getDate() + shippingOption.estimatedDays.max + 4);
    const timeline = buildTimeline(seed.status, seed.daysAgo);

    orders.push({
      id: guid(`order:seed:${idx}`),
      number: `PY-2026-${String(100100 + idx).padStart(6, "0")}`,
      purchaseId,
      status: seed.status,
      createdAt,
      updatedAt: timeline[timeline.length - 1]?.occurredAt ?? createdAt,
      seller,
      items,
      shippingAddress: address,
      shippingOption,
      trackingCode: [
        "Enviado",
        "EmTransitoInternacional",
        "Entregue",
        "Concluido",
        "EmDisputa",
        "Devolvido",
        "Reembolsado",
      ].includes(seed.status)
        ? `PY${String(700000 + idx * 137).padStart(9, "0")}BR`
        : null,
      trackingEvents: buildTracking(seed.status, seed.daysAgo, seller.city),
      estimatedDelivery: { min: min.toISOString(), max: max.toISOString() },
      totals,
      exchangeRate: getRate("BRL", "PYG"),
      payment: { id: paymentId, method: seed.method, status: paymentStatusFor(seed.status) },
      timeline,
    });

    payments.push(
      buildPayment({
        id: paymentId,
        purchaseId,
        method: seed.method,
        amount: totals.total,
        createdAt,
        status: paymentStatusFor(seed.status),
        installments: seed.method === "Cartao" ? 6 : 1,
      }),
    );
  });

  return { orders, payments };
}

export const SEED_DATA = buildSeedOrders();
