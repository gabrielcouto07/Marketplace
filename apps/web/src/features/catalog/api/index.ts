"use client";

import type {
  AskQuestionRequest,
  CategoryDto,
  HomeDto,
  PagedResult,
  ProductDetailDto,
  ProductSearchQuery,
  ProductSearchResultDto,
  QuestionDto,
  ReviewDto,
  ReviewSummaryDto,
} from "@marketplace/contracts";
import {
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";

export interface SearchSuggestion {
  slug: string;
  name: string;
  thumbnailUrl: string;
}

// ----- Endpoints (únicos pontos que conhecem as rotas) -----
export const catalogApi = {
  home: () => api.get<HomeDto>("/home"),
  categories: () => api.get<CategoryDto[]>("/categories"),
  category: (slug: string) => api.get<CategoryDto>(`/categories/${slug}`),
  search: (query: ProductSearchQuery) => api.get<ProductSearchResultDto>("/products", { query: { ...query } }),
  suggestions: (q: string) => api.get<SearchSuggestion[]>("/products/suggestions", { query: { q } }),
  product: (slug: string) => api.get<ProductDetailDto>(`/products/${slug}`),
  reviews: (id: string, page = 1, pageSize = 5) =>
    api.get<PagedResult<ReviewDto>>(`/products/${id}/reviews`, { query: { page, pageSize } }),
  reviewSummary: (id: string) => api.get<ReviewSummaryDto>(`/products/${id}/reviews/summary`),
  questions: (id: string, page = 1, pageSize = 10) =>
    api.get<PagedResult<QuestionDto>>(`/products/${id}/questions`, { query: { page, pageSize } }),
  askQuestion: (id: string, body: AskQuestionRequest) => api.post<QuestionDto>(`/products/${id}/questions`, body),
};

// ----- Query options (reutilizáveis em prefetch no servidor) -----
export const homeQuery = () => queryOptions({ queryKey: queryKeys.home, queryFn: catalogApi.home, staleTime: 5 * 60 * 1000 });
export const categoriesQuery = () =>
  queryOptions({ queryKey: queryKeys.categories.all, queryFn: catalogApi.categories, staleTime: 30 * 60 * 1000 });
export const categoryQuery = (slug: string) =>
  queryOptions({ queryKey: queryKeys.categories.detail(slug), queryFn: () => catalogApi.category(slug) });
export const productQuery = (slug: string) =>
  queryOptions({ queryKey: queryKeys.products.detail(slug), queryFn: () => catalogApi.product(slug) });

// ----- Hooks -----
export function useHome() {
  return useQuery(homeQuery());
}

export function useCategories() {
  return useQuery(categoriesQuery());
}

export function useCategory(slug: string) {
  return useQuery({ ...categoryQuery(slug), enabled: Boolean(slug) });
}

export function useProduct(slug: string) {
  return useQuery({ ...productQuery(slug), enabled: Boolean(slug) });
}

/** Busca paginada com infinite scroll; mantém dados anteriores ao trocar filtros. */
export function useProductSearch(query: Omit<ProductSearchQuery, "page">) {
  const pageSize = query.pageSize ?? 20;
  return useInfiniteQuery({
    queryKey: queryKeys.products.search({ ...query, pageSize }),
    queryFn: ({ pageParam }) => catalogApi.search({ ...query, pageSize, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useSearchSuggestions(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: queryKeys.products.suggestions(term),
    queryFn: () => catalogApi.suggestions(term),
    enabled: term.length >= 2,
    staleTime: 60 * 1000,
  });
}

export function useProductReviews(productId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.products.reviews(productId ?? ""),
    queryFn: ({ pageParam }) => catalogApi.reviews(productId!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined),
    enabled: Boolean(productId),
  });
}

export function useReviewSummary(productId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.reviewSummary(productId ?? ""),
    queryFn: () => catalogApi.reviewSummary(productId!),
    enabled: Boolean(productId),
  });
}

export function useProductQuestions(productId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.products.questions(productId ?? ""),
    queryFn: ({ pageParam }) => catalogApi.questions(productId!, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined),
    enabled: Boolean(productId),
  });
}

export function useAskQuestion(productId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: AskQuestionRequest) => catalogApi.askQuestion(productId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.products.questions(productId) }),
  });
}
