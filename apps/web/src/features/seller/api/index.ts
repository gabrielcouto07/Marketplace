"use client";

import type { PagedResult, ReviewDto, SellerDto, SellerSummaryDto } from "@marketplace/contracts";
import { queryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api/http";
import { queryKeys } from "@/lib/api/query-keys";

export const sellerApi = {
  list: () => api.get<SellerSummaryDto[]>("/sellers"),
  detail: (slug: string) => api.get<SellerDto>(`/sellers/${slug}`),
  reviews: (slug: string, page = 1, pageSize = 5) =>
    api.get<PagedResult<ReviewDto>>(`/sellers/${slug}/reviews`, { query: { page, pageSize } }),
};

export const sellerQuery = (slug: string) =>
  queryOptions({ queryKey: queryKeys.sellers.detail(slug), queryFn: () => sellerApi.detail(slug) });

export function useSellers() {
  return useQuery({ queryKey: queryKeys.sellers.all, queryFn: sellerApi.list, staleTime: 30 * 60 * 1000 });
}

export function useSeller(slug: string) {
  return useQuery({ ...sellerQuery(slug), enabled: Boolean(slug) });
}

export function useSellerReviews(slug: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.sellers.reviews(slug),
    queryFn: ({ pageParam }) => sellerApi.reviews(slug, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined),
    enabled: Boolean(slug),
  });
}
