"use client";

import { useEffect, useState } from "react";

function secondsUntil(untilIso: string | null | undefined): number {
  return untilIso ? Math.max(0, Math.floor((new Date(untilIso).getTime() - Date.now()) / 1000)) : 0;
}

/** Segundos restantes até `untilIso` (0 quando expirado ou sem data), atualizado a cada segundo. */
export function useCountdown(untilIso: string | null | undefined): number {
  const [state, setState] = useState(() => ({ untilIso, remaining: secondsUntil(untilIso) }));

  // Reinicia a contagem quando a data-alvo muda (padrão "derive state during render").
  if (state.untilIso !== untilIso) {
    setState({ untilIso, remaining: secondsUntil(untilIso) });
  }

  useEffect(() => {
    if (!untilIso) return;
    const timer = window.setInterval(() => setState({ untilIso, remaining: secondsUntil(untilIso) }), 1000);
    return () => window.clearInterval(timer);
  }, [untilIso]);

  return state.untilIso === untilIso ? state.remaining : secondsUntil(untilIso);
}

/** Formata segundos como mm:ss. */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
