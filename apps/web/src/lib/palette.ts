import type { CSSProperties } from "react";

/**
 * Cores "vivas" da interface: tintas por categoria (oklch com matiz variável), determinísticas a
 * partir do slug, então funcionam igual no servidor, no cliente e offline, sem campo novo na API.
 * Uso: <span style={hueStyle(categoryHue(slug))} className="tint-bg tint-fg" />
 */

/** Matizes fixas das categorias conhecidas; slugs novos caem no hash. */
const CATEGORY_HUES: Record<string, number> = {
  eletronicos: 255,
  perfumes: 350,
  informatica: 220,
  celulares: 295,
  bebidas: 50,
  casa: 175,
  esportes: 145,
  moda: 25,
};

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function categoryHue(slug: string): number {
  return CATEGORY_HUES[slug] ?? hash(slug) % 360;
}

/** Estilo inline que alimenta os utilitários tint-* (globals.css). */
export function hueStyle(hue: number): CSSProperties {
  return { "--hue": hue } as CSSProperties;
}

/** Iniciais de um nome ("TecnoCentro CDE" → "TC"). */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.filter((w) => /^[A-ZÀ-Ý]/.test(w)).slice(0, 2);
  const picked = letters.length ? letters : words.slice(0, 2);
  return picked.map((w) => w[0]!.toUpperCase()).join("");
}
