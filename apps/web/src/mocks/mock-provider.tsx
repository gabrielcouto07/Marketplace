"use client";

import { useEffect, useState, type ReactNode } from "react";

import { env } from "@/lib/env";

let startPromise: Promise<void> | null = null;

/** Inicia o MSW no navegador exatamente uma vez (sobrevive a HMR). */
function startWorker(): Promise<void> {
  if (!startPromise) {
    startPromise = import("./browser")
      .then(({ worker }) =>
        worker.start({
          onUnhandledRequest: "bypass",
          quiet: !env.isDev,
          serviceWorker: { url: "/mockServiceWorker.js" },
        }),
      )
      .then(() => undefined);
  }
  return startPromise;
}

/**
 * Bloqueia a renderização dos filhos até o worker estar pronto, evitando que
 * as primeiras queries escapem para a rede antes da interceptação.
 */
export function MockProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !env.apiMocking);

  useEffect(() => {
    if (!env.apiMocking) return;
    let cancelled = false;
    startWorker().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
