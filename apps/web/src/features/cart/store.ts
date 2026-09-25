"use client";

import type { Money, ProductSummaryDto, SellerSummaryDto } from "@marketplace/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { sum } from "@/lib/money";

/**
 * Carrinho persistido em localStorage (funciona offline).
 * Guarda um "snapshot" do produto para renderizar sem rede; preços são
 * reconfirmados pela cotação de checkout (CheckoutQuoteDto).
 */
export interface CartLine {
  /** Chave única: `${productId}:${variantId ?? "default"}` */
  key: string;
  productId: string;
  variantId: string | null;
  variantLabel: string | null;
  slug: string;
  name: string;
  thumbnailUrl: string;
  unitPrice: Money;
  referencePrice: Money;
  quantity: number;
  maxQuantity: number;
  freeShipping: boolean;
  seller: SellerSummaryDto;
  addedAt: string;
}

export interface CartSellerGroup {
  seller: SellerSummaryDto;
  lines: CartLine[];
  subtotal: Money;
  itemCount: number;
}

export interface AddToCartInput {
  product: Pick<
    ProductSummaryDto,
    | "id"
    | "slug"
    | "name"
    | "thumbnailUrl"
    | "price"
    | "referencePrice"
    | "stock"
    | "freeShipping"
    | "seller"
  >;
  variantId?: string | null;
  variantLabel?: string | null;
  unitPrice?: Money;
  quantity?: number;
  maxQuantity?: number;
}

interface CartState {
  lines: CartLine[];
  lastUpdatedAt: string | null;
  add: (input: AddToCartInput) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  removeSeller: (sellerId: string) => void;
  clear: () => void;
}

export function cartLineKey(productId: string, variantId: string | null | undefined): string {
  return `${productId}:${variantId ?? "default"}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      lastUpdatedAt: null,
      add: ({
        product,
        variantId = null,
        variantLabel = null,
        unitPrice,
        quantity = 1,
        maxQuantity,
      }) =>
        set((state) => {
          const key = cartLineKey(product.id, variantId);
          const max = maxQuantity ?? product.stock ?? 99;
          const existing = state.lines.find((l) => l.key === key);
          const now = new Date().toISOString();
          if (existing) {
            return {
              lastUpdatedAt: now,
              lines: state.lines.map((l) =>
                l.key === key
                  ? { ...l, quantity: Math.min(l.quantity + quantity, max), maxQuantity: max }
                  : l,
              ),
            };
          }
          const line: CartLine = {
            key,
            productId: product.id,
            variantId,
            variantLabel,
            slug: product.slug,
            name: product.name,
            thumbnailUrl: product.thumbnailUrl,
            unitPrice: unitPrice ?? product.price,
            referencePrice: product.referencePrice,
            quantity: Math.min(quantity, max),
            maxQuantity: max,
            freeShipping: product.freeShipping,
            seller: product.seller,
            addedAt: now,
          };
          return { lastUpdatedAt: now, lines: [...state.lines, line] };
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          lastUpdatedAt: new Date().toISOString(),
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.key !== key)
              : state.lines.map((l) =>
                  l.key === key ? { ...l, quantity: Math.min(quantity, l.maxQuantity) } : l,
                ),
        })),
      remove: (key) =>
        set((state) => ({
          lastUpdatedAt: new Date().toISOString(),
          lines: state.lines.filter((l) => l.key !== key),
        })),
      removeSeller: (sellerId) =>
        set((state) => ({
          lastUpdatedAt: new Date().toISOString(),
          lines: state.lines.filter((l) => l.seller.id !== sellerId),
        })),
      clear: () => set({ lines: [], lastUpdatedAt: new Date().toISOString() }),
    }),
    {
      name: "mktpy.cart.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ lines: s.lines, lastUpdatedAt: s.lastUpdatedAt }),
    },
  ),
);

// ----- Seletores derivados (puros) -----

export function selectItemCount(lines: CartLine[]): number {
  return lines.reduce((acc, l) => acc + l.quantity, 0);
}

export function selectSubtotal(lines: CartLine[]): Money {
  return sum(
    lines.map((l) => ({ amount: l.unitPrice.amount * l.quantity, currency: l.unitPrice.currency })),
    "BRL",
  );
}

/** Agrupa linhas por vendedor preservando a ordem de inserção. */
export function groupBySeller(lines: CartLine[]): CartSellerGroup[] {
  const groups = new Map<string, CartSellerGroup>();
  for (const line of lines) {
    let g = groups.get(line.seller.id);
    if (!g) {
      g = {
        seller: line.seller,
        lines: [],
        subtotal: { amount: 0, currency: "BRL" },
        itemCount: 0,
      };
      groups.set(line.seller.id, g);
    }
    g.lines.push(line);
    g.subtotal = {
      amount: g.subtotal.amount + line.unitPrice.amount * line.quantity,
      currency: "BRL",
    };
    g.itemCount += line.quantity;
  }
  return [...groups.values()];
}

/** Hook seguro para hidratação: retorna 0 no servidor e o valor real após montar. */
export function useCartHydrated(): boolean {
  return useCartStore.persist.hasHydrated();
}
