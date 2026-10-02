"use client";

import { SerwistProvider } from "@serwist/next/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { noopSubscribe } from "@/hooks/use-store-hydrated";
import { env } from "@/lib/env";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface PwaContextValue {
  /** Android/Chrome: prompt nativo capturado. */
  canPrompt: boolean;
  /** App já instalado (display-mode: standalone). */
  isStandalone: boolean;
  isIos: boolean;
  isOnline: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const PwaContext = createContext<PwaContextValue | null>(null);

export function usePwa(): PwaContextValue {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error("usePwa deve ser usado dentro de PwaProvider");
  return ctx;
}

/**
 * O service worker do app fica desligado em dev (salvo NEXT_PUBLIC_SW_DEV) e sempre que o mock (MSW) está
 * ativo: os dois registram o escopo "/" e o navegador só mantém um — o do app venceria, as chamadas /api
 * iriam para a rede sem backend e toda tela cairia em erro até o próximo reload.
 */
const DISABLE_SW =
  env.apiMocking ||
  (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_SW_DEV !== "true");

// ----- Fontes externas (useSyncExternalStore evita setState em effects e mismatch de hidratação) -----

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function subscribeStandalone(callback: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    mq.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

const getIsIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
const getIsStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const getIsOnline = () => navigator.onLine;

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const isIos = useSyncExternalStore(noopSubscribe, getIsIos, () => false);
  const isStandalone = useSyncExternalStore(subscribeStandalone, getIsStandalone, () => false);
  const isOnline = useSyncExternalStore(subscribeOnline, getIsOnline, () => true);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Deploy novo: o SW (skipWaiting + clientsClaim) assume as abas abertas, mas os chunks antigos já não
  // existem no servidor — a próxima navegação daria ChunkLoadError. Recarrega uma vez quando a troca é update.
  useEffect(() => {
    if (DISABLE_SW || typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const onControlling = (event: { isUpdate?: boolean }) => {
      if (event.isUpdate) window.location.reload();
    };
    const attach = () => window.serwist?.addEventListener("controlling", onControlling);
    if (window.serwist) attach();
    else window.addEventListener("load", attach, { once: true });
    return () => {
      window.removeEventListener("load", attach);
      window.serwist?.removeEventListener("controlling", onControlling);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setDeferred(null);
    return outcome;
  }, [deferred]);

  const value = useMemo<PwaContextValue>(
    () => ({ canPrompt: deferred !== null, isStandalone, isIos, isOnline, promptInstall }),
    [deferred, isStandalone, isIos, isOnline, promptInstall],
  );

  return (
    <SerwistProvider swUrl="/sw.js" disable={DISABLE_SW} cacheOnNavigation reloadOnOnline={false}>
      <PwaContext.Provider value={value}>{children}</PwaContext.Provider>
    </SerwistProvider>
  );
}
