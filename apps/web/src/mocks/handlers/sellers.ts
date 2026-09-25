import type { PagedResult, ReviewDto, SellerSummaryDto } from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { SELLERS, sellerBySlug, toSellerSummary } from "../fixtures/base";
import { PRODUCT_RECORDS } from "../fixtures/products";
import { API, notFound, num, paginate, simulateLatency } from "./utils";

export const sellerHandlers = [
  http.get(`${API}/sellers`, async () => {
    await simulateLatency();
    const body: SellerSummaryDto[] = SELLERS.map(toSellerSummary);
    return HttpResponse.json(body);
  }),

  http.get(`${API}/sellers/:slug`, async ({ params }) => {
    await simulateLatency();
    const seller = sellerBySlug(String(params.slug));
    return seller ? HttpResponse.json(seller) : notFound("Loja");
  }),

  http.get(`${API}/sellers/:slug/reviews`, async ({ params, request }) => {
    await simulateLatency();
    const seller = sellerBySlug(String(params.slug));
    if (!seller) return notFound("Loja");
    const url = new URL(request.url);
    const page = num(url.searchParams.get("page"), 1)!;
    const pageSize = num(url.searchParams.get("pageSize"), 5)!;
    const reviews = PRODUCT_RECORDS.filter((r) => r.detail.seller.id === seller.id)
      .flatMap((r) => r.reviews)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const body: PagedResult<ReviewDto> = paginate(reviews, page, pageSize);
    return HttpResponse.json(body);
  }),
];
