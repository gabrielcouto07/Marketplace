import type { OrderDto, OrderStatus, PaymentDto } from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { db, persistDb } from "../db";
import { TIMELINE_DESCRIPTIONS } from "../fixtures/orders";
import { API, notFound, nowIso, num, paginate, simulateLatency, unauthorized } from "./utils";

/** Pix/boleto pendentes são aprovados automaticamente após 20 s (demo de polling). */
const AUTO_APPROVE_MS = 20_000;

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const token = auth.replace(/^Bearer\s+/i, "");
  return db.tokens.includes(token);
}

function advanceOrder(order: OrderDto, status: OrderStatus): void {
  const now = nowIso();
  order.status = status;
  order.updatedAt = now;
  order.payment = { ...order.payment, status: status === "Pago" ? "Aprovado" : order.payment.status };
  order.timeline.push({ status, occurredAt: now, description: TIMELINE_DESCRIPTIONS[status], location: null });
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
      if (order.purchaseId === payment.purchaseId && order.status === "AguardandoPagamento") advanceOrder(order, "Pago");
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
    const page = num(url.searchParams.get("page"), 1)!;
    const pageSize = num(url.searchParams.get("pageSize"), 10)!;
    const items = db.orders
      .filter((o) => !status || o.status === status)
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
    return HttpResponse.json({ trackingCode: order.trackingCode, events: order.trackingEvents });
  }),

  http.post(`${API}/orders/:id/cancel`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const order = db.orders.find((o) => o.id === params.id);
    if (!order) return notFound("Pedido");
    if (!["AguardandoPagamento", "Pago", "EmPreparacao"].includes(order.status)) {
      return HttpResponse.json(
        { status: 409, code: "ORDER_NOT_CANCELLABLE", message: "Este pedido não pode mais ser cancelado." },
        { status: 409 },
      );
    }
    advanceOrder(order, "Cancelado");
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

  // ----- Pagamentos -----
  http.get(`${API}/payments/:id`, async ({ params }) => {
    await simulateLatency();
    settlePendingPayments();
    const payment = db.payments.find((p) => p.id === params.id);
    return payment ? HttpResponse.json(payment) : notFound("Pagamento");
  }),

  /** Endpoint de conveniência só do mock: força aprovação imediata (botão "Simular pagamento"). */
  http.post(`${API}/payments/:id/simulate-approval`, async ({ params }) => {
    await simulateLatency();
    const payment = db.payments.find((p) => p.id === params.id);
    if (!payment) return notFound("Pagamento");
    payment.status = "Aprovado";
    payment.paidAt = nowIso();
    for (const order of db.orders) {
      if (order.purchaseId === payment.purchaseId && order.status === "AguardandoPagamento") advanceOrder(order, "Pago");
    }
    persistDb();
    const body: PaymentDto = payment;
    return HttpResponse.json(body);
  }),
];
