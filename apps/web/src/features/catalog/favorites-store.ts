"use client";

import type { ProductSummaryDto } from "@marketplace/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Favoritos persistidos localmente; guarda snapshot para listar offline. */
export interface FavoriteEntry {
  productId: string;
  createdAt: string;
  snapshot: ProductSummaryDto;
}

interface FavoritesState {
  items: FavoriteEntry[];
  toggle: (product: ProductSummaryDto) => boolean;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (product) => {
        const exists = get().items.some((f) => f.productId === product.id);
        set((state) => ({
          items: exists
            ? state.items.filter((f) => f.productId !== product.id)
            : [{ productId: product.id, createdAt: new Date().toISOString(), snapshot: product }, ...state.items],
        }));
        return !exists;
      },
      remove: (productId) => set((state) => ({ items: state.items.filter((f) => f.productId !== productId) })),
      has: (productId) => get().items.some((f) => f.productId === productId),
      clear: () => set({ items: [] }),
    }),
    {
      name: "mktpy.favorites.v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function useIsFavorite(productId: string): boolean {
  return useFavoritesStore((s) => s.items.some((f) => f.productId === productId));
}
