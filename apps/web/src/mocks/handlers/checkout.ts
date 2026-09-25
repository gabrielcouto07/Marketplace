import type {
  CheckoutGroupDto,
  CheckoutLineDto,
  CheckoutQuoteDto,
  CheckoutQuoteRequest,
  Money,
  OrderDto,
  PlaceOrderRequest,
  PlaceOrderResponseDto,
} from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { convert, multiplyBasisPoints, sum } from "@/lib/money";
import { isValidCpf } from "@/lib/validation/documents";

import { db, persistDb } from "../db";
import { getRate, sellerById, toSellerSummary } from "../fixtures/base";
import { IMPORT_TAX_BASIS_POINTS, TIMELINE_DESCRIPTIONS, buildOrderItems, buildPayment, computeTotals, nextOrderNumber } from "../fixtures/orders";
import { productById } from "../fixtures/products";
import { lookupPostalCode, quoteShipping } from "../fixtures/shipping";
import { API, addDays, addMinutes, notFound, nowIso, simulateLatency, validation } from "./utils";

/** Cotações emitidas (para validar quoteId no place order). */
const quotes = new Map<string, CheckoutQuoteDto>();
/** Idempotência: mesma chave → mesma resposta. */
const placed = new Map<string, PlaceOrderResponseDto>();

function buildGroups(body: CheckoutQuoteRequest): CheckoutGroupDto[] | { error: ReturnType<typeof validation> } {
  const groups: CheckoutGroupDto[] = [];
  for (const g of body.groups) {
    const seller = sellerById(g.sellerId);
    if (!seller) return { error: validation({ groups: [`Loja ${g.sellerId} não encontrada.`] }) };
    const lines: CheckoutLineDto[] = [];
    for (const item of g.items) {
      const record = productById(item.productId);
      if (!record) return { error: validation({ items: [`Produto ${item.productId} não encontrado.`] }) };
      const p = record.detail;
      const variant = item.variantId ? p.variants.find((v) => v.id === item.variantId) : null;
      const unit: Money = variant?.price ?? p.price;
      lines.push({
        productId: p.id,
        variantId: item.variantId,
        name: p.name,
        variantLabel: variant ? Object.values(variant.attributes).join(" / ") : null,
        thumbnailUrl: p.thumbnailUrl,
        quantity: item.quantity,
        unitPrice: unit,
        lineTotal: { amount: unit.amount * item.quantity, currency: "BRL" },
      });
    }
    const subtotal = sum(lines.map((l) => l.lineTotal));
    const allFree = g.items.every((i) => productById(i.productId)?.detail.freeShipping);
    const options = quoteShipping(body.postalCode, seller.id, g.items, allFree && subtotal.amount >= 30000);
    const selected = options.find((o) => o.id === g.shippingOptionId) ?? options[0];
    groups.push({
      seller: toSellerSummary(seller),
      lines,
      subtotal,
      shippingOptions: options,
      selectedShippingOptionId: selected.id,
      shipping: selected.price,
    });
  }
  return groups;
}

export const checkoutHandlers = [
  http.post(`${API}/checkout/quotes`, async ({ request }) => {
    await simulateLatency();
    const body = (await request.json()) as CheckoutQuoteRequest;
    const cep = body.postalCode?.replace(/\D/g, "") ?? "";
    if (cep.length !== 8 || !lookupPostalCode(cep)) return validation({ postalCode: ["CEP inválido."] });
    if (!body.groups?.length) return validation({ groups: ["Carrinho vazio."] });

    const result = buildGroups({ ...body, postalCode: cep });
    if ("error" in result) return result.error;

    const subtotal = sum(result.map((g) => g.subtotal));
    const shippingTotal = sum(result.map((g) => g.shipping));
    const discount: Money = body.couponCode?.toUpperCase() === "PARAGUAI10" ? multiplyBasisPoints(subtotal, 1000) : { amount: 0, currency: "BRL" };
    const taxable: Money = { amount: subtotal.amount + shippingTotal.amount - discount.amount, currency: "BRL" };
    const estimatedImportTax = multiplyBasisPoints(taxable, IMPORT_TAX_BASIS_POINTS);
    const total: Money = { amount: taxable.amount + estimatedImportTax.amount, currency: "BRL" };
    const rate = getRate("BRL", "PYG");
    const now = nowIso();

    const quote: CheckoutQuoteDto = {
      quoteId: crypto.randomUUID(),
      groups: result,
      subtotal,
      shippingTotal,
      estimatedImportTax,
      importTaxRateBasisPoints: IMPORT_TAX_BASIS_POINTS,
      discount,
      total,
      totalReference: convert(total, rate),
      exchangeRate: { ...rate, quotedAt: now },
      lockedUntil: addMinutes(now, 15),
    };
    quotes.set(quote.quoteId, quote);
    return HttpResponse.json(quote);
  }),

  http.post(`${API}/orders`, async ({ request }) => {
    await simulateLatency();
    const body = (await request.json()) as PlaceOrderRequest;

    const cached = placed.get(body.idempotencyKey);
    if (cached) return HttpResponse.json(cached, { status: 201 });

    const quote = quotes.get(body.quoteId);
    if (!quote) return validation({ quoteId: ["Cotação expirada. Atualize o resumo do pedido."] });
    const address = db.addresses.find((a) => a.id === body.addressId);
    if (!address) return notFound("Endereço");
    if (!isValidCpf(body.payment.payerDocument ?? "")) return validation({ payerDocument: ["CPF inválido."] });
    if (body.payment.method === "Cartao" && !body.payment.card) return validation({ card: ["Dados do cartão obrigatórios."] });

    const now = nowIso();
    const purchaseId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const rate = quote.exchangeRate;
    const cardApproved = body.payment.method === "Cartao" && body.payment.card?.last4 !== "0000";
    const status: OrderDto["status"] = cardApproved ? "Pago" : "AguardandoPagamento";

    const orders: OrderDto[] = quote.groups.map((group) => {
      const groupInput = body.groups.find((g) => g.sellerId === group.seller.id);
      const shippingOption = group.shippingOptions.find((o) => o.id === groupInput?.shippingOptionId) ?? group.shippingOptions[0];
      const items = buildOrderItems(
        group.lines.map((l) => ({ product: productById(l.productId)!.detail, quantity: l.quantity, variantId: l.variantId })),
      );
      const totals = computeTotals(items, shippingOption.price);
      const timeline: OrderDto["timeline"] = [
        { status: "AguardandoPagamento", occurredAt: now, description: TIMELINE_DESCRIPTIONS.AguardandoPagamento, location: null },
      ];
      if (status === "Pago") timeline.push({ status: "Pago", occurredAt: now, description: TIMELINE_DESCRIPTIONS.Pago, location: null });
      return {
        id: crypto.randomUUID(),
        number: nextOrderNumber(),
        purchaseId,
        status,
        createdAt: now,
        updatedAt: now,
        seller: group.seller,
        items,
        shippingAddress: address,
        shippingOption,
        trackingCode: null,
        trackingEvents: [],
        estimatedDelivery: {
          min: addDays(now, shippingOption.estimatedDays.min + 2),
          max: addDays(now, shippingOption.estimatedDays.max + 4),
        },
        totals,
        exchangeRate: rate,
        payment: { id: paymentId, method: body.payment.method, status: cardApproved ? "Aprovado" : "Pendente" },
        timeline,
      };
    });

    const payment = buildPayment({
      id: paymentId,
      purchaseId,
      method: body.payment.method,
      amount: quote.total,
      createdAt: now,
      status: cardApproved ? "Aprovado" : body.payment.method === "Cartao" ? "Recusado" : "Pendente",
      installments: body.payment.card?.installments ?? 1,
    });

    db.orders.unshift(...orders);
    db.payments.unshift(payment);
    persistDb();

    const response: PlaceOrderResponseDto = { purchaseId, orders, payment };
    placed.set(body.idempotencyKey, response);
    quotes.delete(body.quoteId);
    return HttpResponse.json(response, { status: 201 });
  }),
];
