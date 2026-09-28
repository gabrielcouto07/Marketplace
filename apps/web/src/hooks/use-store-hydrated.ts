"use client";

import { useSyncExternalStore } from "react";

interface PersistApi {
  hasHydrated(): boolean;
  onFinishHydration(callback: () => void): () => void;
}

/**
 * `true` depois que uma store Zustand com `persist` reidratou do localStorage.
 * Seguro no SSR: no servidor o middleware não expõe `persist` (sem localStorage) e o snapshot é `false`,
 * o que também evita mismatch na primeira renderização do cliente.
 */
export function useStoreHydrated(store: { persist?: PersistApi }): boolean {
  return useSyncExternalStore(
    (onChange) => store.persist?.onFinishHydration(onChange) ?? (() => {}),
    () => store.persist?.hasHydrated() ?? false,
    () => false,
  );
}
