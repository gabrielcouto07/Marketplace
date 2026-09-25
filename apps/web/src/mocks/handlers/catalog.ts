import type {
  AskQuestionRequest,
  BannerDto,
  HomeDto,
  ProductSearchResultDto,
  ProductSort,
  ProductSummaryDto,
  QuestionDto,
  ReviewDto,
  ReviewSummaryDto,
} from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { db, persistDb } from "../db";
import { CATEGORIES, SELLERS, categoryBySlug, guid, sellerBySlug, toSellerSummary } from "../fixtures/base";
import { PRODUCTS, productById, productBySlug, toSummary } from "../fixtures/products";
import { API, bool, notFound, num, paginate, serverError, shouldFailRandomly, simulateLatency, validation } from "./utils";

const BANNERS: BannerDto[] = [
  {
    id: guid("banner:1"),
    title: "Semana da Tecnologia",
    subtitle: "Até 40% off em smartphones e notebooks",
    imageUrl: "/images/banners/tech.svg",
    href: "/busca?onlyOffers=true&categorySlug=celulares",
    tone: "blue",
  },
  {
    id: guid("banner:2"),
    title: "Perfumes originais",
    subtitle: "Importadora oficial com lote verificável",
    imageUrl: "/images/banners/perfumes.svg",
    href: "/categoria/perfumes",
    tone: "red",
  },
  {
    id: guid("banner:3"),
    title: "Frete grátis acima de R$ 300",
    subtitle: "Nas lojas participantes, com rastreio ponta a ponta",
    imageUrl: "/images/banners/frete.svg",
    href: "/busca?freeShipping=true",
    tone: "neutral",
  },
];

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function sortProducts(items: ProductSummaryDto[], sort: ProductSort): ProductSummaryDto[] {
  const copy = [...items];
  switch (sort) {
    case "priceAsc":
      return copy.sort((a, b) => a.price.amount - b.price.amount);
    case "priceDesc":
      return copy.sort((a, b) => b.price.amount - a.price.amount);
    case "newest":
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "bestSelling":
      return copy.sort((a, b) => b.soldCount - a.soldCount);
    case "rating":
      return copy.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    default:
      return copy.sort((a, b) => b.soldCount * b.rating - a.soldCount * a.rating);
  }
}

export const catalogHandlers = [
  // ----- Home -----
  http.get(`${API}/home`, async () => {
    await simulateLatency();
    const all = PRODUCTS.map(toSummary);
    const body: HomeDto = {
      banners: BANNERS,
      categories: CATEGORIES,
      offers: sortProducts(
        all.filter((p) => p.isOffer),
        "bestSelling",
      ).slice(0, 12),
      newArrivals: sortProducts(all, "newest").slice(0, 12),
      bestSellers: sortProducts(all, "bestSelling").slice(0, 12),
      featuredSellers: SELLERS.filter((s) => s.reputationLevel >= 4).map(toSellerSummary),
    };
    return HttpResponse.json(body);
  }),

  // ----- Categorias -----
  http.get(`${API}/categories`, async () => {
    await simulateLatency();
    return HttpResponse.json(CATEGORIES);
  }),

  http.get(`${API}/categories/:slug`, async ({ params }) => {
    await simulateLatency();
    const category = categoryBySlug(String(params.slug));
    return category ? HttpResponse.json(category) : notFound("Categoria");
  }),

  // ----- Busca / listagem -----
  http.get(`${API}/products`, async ({ request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    if (normalize(q) === "erro") return serverError(); // gatilho determinístico de erro
    if (shouldFailRandomly()) return serverError();

    const categorySlug = url.searchParams.get("categorySlug");
    const sellerSlug = url.searchParams.get("sellerSlug");
    const minPrice = num(url.searchParams.get("minPrice"));
    const maxPrice = num(url.searchParams.get("maxPrice"));
    const freeShipping = bool(url.searchParams.get("freeShipping"));
    const onlyOffers = bool(url.searchParams.get("onlyOffers"));
    const minRating = num(url.searchParams.get("minRating"));
    const sort = (url.searchParams.get("sort") ?? "relevance") as ProductSort;
    const page = num(url.searchParams.get("page"), 1)!;
    const pageSize = num(url.searchParams.get("pageSize"), 20)!;

    let items = PRODUCTS.map(toSummary);
    const category = categorySlug ? categoryBySlug(categorySlug) : undefined;
    const seller = sellerSlug ? sellerBySlug(sellerSlug) : undefined;

    if (categorySlug && !category) return notFound("Categoria");
    if (sellerSlug && !seller) return notFound("Loja");

    if (q) {
      const terms = normalize(q).split(/\s+/).filter(Boolean);
      items = items.filter((p) => {
        const hay = normalize(`${p.name} ${p.seller.name}`);
        return terms.every((t) => hay.includes(t));
      });
    }
    if (category) items = items.filter((p) => p.categoryId === category.id);
    if (seller) items = items.filter((p) => p.seller.id === seller.id);

    // Facetas calculadas antes dos filtros numéricos (para o usuário ver o universo)
    const facetSource = items;
    const facets: ProductSearchResultDto["facets"] = {
      categories: CATEGORIES.map((c) => ({
        slug: c.slug,
        name: c.name,
        count: facetSource.filter((p) => p.categoryId === c.id).length,
      })).filter((f) => f.count > 0),
      sellers: SELLERS.map((s) => ({
        slug: s.slug,
        name: s.name,
        count: facetSource.filter((p) => p.seller.id === s.id).length,
      })).filter((f) => f.count > 0),
      priceRange: {
        min: { amount: Math.min(...facetSource.map((p) => p.price.amount), 0), currency: "BRL" },
        max: { amount: Math.max(...facetSource.map((p) => p.price.amount), 0), currency: "BRL" },
      },
    };

    if (minPrice !== undefined) items = items.filter((p) => p.price.amount >= minPrice);
    if (maxPrice !== undefined) items = items.filter((p) => p.price.amount <= maxPrice);
    if (freeShipping) items = items.filter((p) => p.freeShipping);
    if (onlyOffers) items = items.filter((p) => p.isOffer);
    if (minRating !== undefined) items = items.filter((p) => p.rating >= minRating);

    const sorted = sortProducts(items, sort);
    const body: ProductSearchResultDto = { ...paginate(sorted, page, pageSize), facets };
    return HttpResponse.json(body);
  }),

  http.get(`${API}/products/suggestions`, async ({ request }) => {
    await simulateLatency();
    const q = normalize(new URL(request.url).searchParams.get("q") ?? "");
    if (q.length < 2) return HttpResponse.json([]);
    const names = PRODUCTS.filter((p) => normalize(p.name).includes(q))
      .slice(0, 6)
      .map((p) => ({ slug: p.slug, name: p.name, thumbnailUrl: p.thumbnailUrl }));
    return HttpResponse.json(names);
  }),

  http.get(`${API}/products/:slug`, async ({ params }) => {
    await simulateLatency();
    const record = productBySlug(String(params.slug));
    return record ? HttpResponse.json(record.detail) : notFound("Produto");
  }),

  http.get(`${API}/products/:id/reviews`, async ({ params, request }) => {
    await simulateLatency();
    const record = productById(String(params.id));
    if (!record) return notFound("Produto");
    const url = new URL(request.url);
    const page = num(url.searchParams.get("page"), 1)!;
    const pageSize = num(url.searchParams.get("pageSize"), 5)!;
    return HttpResponse.json(paginate<ReviewDto>(record.reviews, page, pageSize));
  }),

  http.get(`${API}/products/:id/reviews/summary`, async ({ params }) => {
    await simulateLatency();
    const record = productById(String(params.id));
    if (!record) return notFound("Produto");
    const body: ReviewSummaryDto = record.reviewSummary;
    return HttpResponse.json(body);
  }),

  http.get(`${API}/products/:id/questions`, async ({ params, request }) => {
    await simulateLatency();
    const record = productById(String(params.id));
    if (!record) return notFound("Produto");
    const url = new URL(request.url);
    const page = num(url.searchParams.get("page"), 1)!;
    const pageSize = num(url.searchParams.get("pageSize"), 10)!;
    const userQuestions = db.questions.filter((q) => q.productId === record.detail.id);
    return HttpResponse.json(paginate<QuestionDto>([...userQuestions, ...record.questions], page, pageSize));
  }),

  http.post(`${API}/products/:id/questions`, async ({ params, request }) => {
    await simulateLatency();
    const record = productById(String(params.id));
    if (!record) return notFound("Produto");
    const body = (await request.json()) as AskQuestionRequest;
    if (!body.question || body.question.trim().length < 10) {
      return validation({ question: ["A pergunta deve ter pelo menos 10 caracteres."] });
    }
    const question: QuestionDto = {
      id: crypto.randomUUID(),
      productId: record.detail.id,
      question: body.question.trim(),
      askedBy: db.user.fullName.split(" ")[0] + " " + (db.user.fullName.split(" ")[1]?.[0] ?? "") + ".",
      askedAt: new Date().toISOString(),
      answer: null,
    };
    db.questions.unshift(question);
    persistDb();
    return HttpResponse.json(question, { status: 201 });
  }),
];
