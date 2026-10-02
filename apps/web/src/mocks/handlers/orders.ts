import type { OrderDto, OrderStatus, OrderTrackingDto, PaymentDto } from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { db, persistDb } from "../db";
import { TIMELINE_DESCRIPTIONS } from "../fixtures/orders";
import { buildBoletoPdf } from "../pdf";
import {
  API,
  isAuthorized,
  notFound,
  nowIso,
  num,
  paginate,
  problem,
  simulateLatency,
  unauthorized,
} from "./utils";

/** Pix/boleto pendentes são aprovados automaticamente após 20 s (demo de polling). */
const AUTO_APPROVE_MS = 20_000;

/** Página pública de rastreio (Correios) — o backend real monta a URL conforme a transportadora. */
export function trackingUrlFor(code: string | null): string | null {
  return code ? `https://rastreamento.correios.com.br/app/index.php?objetos=${code}` : null;
}

/** Avança o pedido de status registrando o evento na linha do tempo (painéis e webhooks simulados). */
export function advanceOrder(order: OrderDto, status: OrderStatus, description?: string): void {
  const now = nowIso();
  order.status = status;
  order.updatedAt = now;
  order.payment = {
    ...order.payment,
    status: status === "Pago" ? "Aprovado" : order.payment.status,
  };
  order.timeline.push({
    status,
    occurredAt: now,
    description: description ?? TIMELINE_DESCRIPTIONS[status],
    location: null,
  });
}

/** Simula o webhook do PSP: aprova pagamentos pendentes com mais de 20 s e move pedidos para Pago. */
export function settlePendingPayments(): void {
  const now = Date.now();
  let changed = false;
  for (const payment of db.payments) {
    if (payment.status !== "Pendente") continue;
    if (now - new Date(payment.createdAt).getTime() < AUTO_APPROVE_MS) continue;
    payment.status = "Aprovado";
    payment.paidAt = nowIso();
    for (const order of db.orders) {
      if (order.purchaseId === payment.purchaseId && order.status === "AguardandoPagamento")
        advanceOrder(order, "Pago");
    }
    changed = true;
  }
  if (changed) persistDb();
}

export const orderHandlers = [
  http.get(`${API}/orders`, async ({ request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    settlePendingPayments();
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as OrderStatus | null;
    const group = url.searchParams.get("group");
    const page = num(url.searchParams.get("page"), 1)!;
    const pageSize = num(url.searchParams.get("pageSize"), 10)!;
    const done = (s: OrderStatus) => ["Concluido", "Cancelado", "Reembolsado"].includes(s);
    const items = db.orders
      .filter((o) => !status || o.status === status)
      .filter((o) => (group === "active" ? !done(o.status) : group === "done" ? done(o.status) : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json(paginate(items, page, pageSize));
  }),

  http.get(`${API}/orders/:id`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    settlePendingPayments();
    const order = db.orders.find((o) => o.id === params.id || o.number === params.id);
    return order ? HttpResponse.json(order) : notFound("Pedido");
  }),

  http.get(`${API}/purchases/:purchaseId/orders`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    settlePendingPayments();
    const orders = db.orders.filter((o) => o.purchaseId === params.purchaseId);
    return orders.length ? HttpResponse.json(orders) : notFound("Compra");
  }),

  http.get(`${API}/orders/:id/tracking`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const order = db.orders.find((o) => o.id === params.id);
    if (!order) return notFound("Pedido");
    const body: OrderTrackingDto = {
      trackingCode: order.trackingCode,
      carrier: order.carrier,
      trackingUrl: trackingUrlFor(order.trackingCode),
      events: order.trackingEvents,
    };
    return HttpResponse.json(body);
  }),

  http.post(`${API}/orders/:id/cancel`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const order = db.orders.find((o) => o.id === params.id);
    if (!order) return notFound("Pedido");
    if (!["AguardandoPagamento", "Pago", "EmPreparacao"].includes(order.status)) {
      return problem(409, "ORDER_NOT_CANCELLABLE", "Este pedido não pode mais ser cancelado.");
    }
    advanceOrder(order, "Cancelado");
    persistDb();
    return HttpResponse.json(order);
  }),

  /** Comprador confirma o recebimento: Entregue → Concluido. */
  http.post(`${API}/orders/:id/confirm-receipt`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const order = db.orders.find((o) => o.id === params.id);
    if (!order) return notFound("Pedido");
    if (order.status !== "Entregue") {
      return problem(
        409,
        "ORDER_NOT_DELIVERED",
        "Só pedidos entregues podem ter o recebimento confirmado.",
      );
    }
    advanceOrder(
      order,
      "Concluido",
      "Recebimento confirmado pelo comprador. Obrigado pela compra!",
    );
    persistDb();
    return HttpResponse.json(order);
  }),

  http.post(`${API}/orders/:id/disputes`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const order = db.orders.find((o) => o.id === params.id);
    if (!order) return notFound("Pedido");
    advanceOrder(order, "EmDisputa");
    persistDb();
    return HttpResponse.json(order, { status: 201 });
  }),

  // ----- Pagamentos (todas exigem sessão, como na API real) -----
  /** PDF do boleto (demonstração): o gateway real devolve o arquivo pronto em `boleto.pdfUrl`. */
  http.get(`${API}/payments/:id/boleto.pdf`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const payment = db.payments.find((p) => p.id === params.id);
    if (!payment?.boleto) return notFound("Boleto");
    return new HttpResponse(buildBoletoPdf(payment), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="boleto-${payment.id.slice(0, 8)}.pdf"`,
      },
    });
  }),

  http.get(`${API}/payments/:id`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    settlePendingPayments();
    const payment = db.payments.find((p) => p.id === params.id);
    return payment ? HttpResponse.json(payment) : notFound("Pagamento");
  }),

  /** Endpoint de conveniência só do mock: força aprovação imediata (botão "Simular pagamento"). */
  http.post(`${API}/payments/:id/simulate-approval`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const payment = db.payments.find((p) => p.id === params.id);
    if (!payment) return notFound("Pagamento");
    payment.status = "Aprovado";
    payment.paidAt = nowIso();
    for (const order of db.orders) {
      if (order.purchaseId === payment.purchaseId && order.status === "AguardandoPagamento")
        advanceOrder(order, "Pago");
    }
    persistDb();
    const body: PaymentDto = payment;
    return HttpResponse.json(body);
  }),
];
