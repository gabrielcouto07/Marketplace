import type { ExchangeRateDto, ShippingQuoteDto, ShippingQuoteRequest } from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { EXCHANGE_RATES, sellerById } from "../fixtures/base";
import { productById } from "../fixtures/products";
import { lookupPostalCode, quoteShipping } from "../fixtures/shipping";
import { API, notFound, serverError, simulateLatency, validation } from "./utils";

export const shippingHandlers = [
  http.get(`${API}/postal-codes/:cep`, async ({ params }) => {
    await simulateLatency();
    const cep = String(params.cep).replace(/\D/g, "");
    if (cep === "99999999") return serverError();
    if (cep.length !== 8) return validation({ postalCode: ["CEP deve ter 8 dígitos."] });
    const result = lookupPostalCode(cep);
    return result ? HttpResponse.json(result) : notFound("CEP");
  }),

  http.post(`${API}/shipping/quotes`, async ({ request }) => {
    await simulateLatency();
    const body = (await request.json()) as ShippingQuoteRequest;
    const cep = body.postalCode?.replace(/\D/g, "") ?? "";
    if (cep.length !== 8) return validation({ postalCode: ["CEP inválido."] });
    if (cep === "00000000") return notFound("CEP");
    const seller = sellerById(body.sellerId);
    if (!seller) return notFound("Loja");
    const destination = lookupPostalCode(cep);
    if (!destination) return notFound("CEP");

    // Frete grátis quando todos os itens da loja têm freeShipping e subtotal >= R$ 300
    const products = body.items.map((i) => productById(i.productId)?.detail).filter(Boolean);
    const subtotal = body.items.reduce((acc, i) => {
      const p = productById(i.productId)?.detail;
      const variant = i.variantId ? p?.variants.find((v) => v.id === i.variantId) : null;
      return acc + (variant?.price.amount ?? p?.price.amount ?? 0) * i.quantity;
    }, 0);
    const freeShipping = products.length > 0 && products.every((p) => p!.freeShipping) && subtotal >= 30000;

    const quote: ShippingQuoteDto = {
      postalCode: cep,
      destination: { city: destination.city, state: destination.state },
      sellerId: seller.id,
      options: quoteShipping(cep, seller.id, body.items, freeShipping),
    };
    return HttpResponse.json(quote);
  }),

  http.get(`${API}/exchange-rates`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const rates: ExchangeRateDto[] = EXCHANGE_RATES.filter((r) => (!from || r.from === from) && (!to || r.to === to));
    return HttpResponse.json(rates);
  }),
];
