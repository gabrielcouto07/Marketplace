import type { CSSProperties } from "react";

/**
 * Cores "vivas" da interface: tintas por categoria (oklch com matiz variável) e
 * cor de marca por loja (avatar com iniciais). Tudo determinístico a partir do slug,
 * então funciona igual no servidor, no cliente e offline, sem campo novo na API.
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

/** Cores de marca das lojas conhecidas; slugs novos recebem uma cor estável a partir do hash. */
const SELLER_COLORS: Record<string, string> = {
  "tecnocentro-cde": "#0038a8",
  "perfumaria-del-este": "#b8325e",
  "casa-nova-import": "#0e8a74",
  "megastore-paraguay": "#5b3fc4",
  "nippon-center": "#d52b1e",
  "bebidas-del-puente": "#9a5b12",
  "sport-house-py": "#1f8a3b",
  "moda-guarani": "#c0561b",
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

export function sellerColor(slug: string): string {
  return SELLER_COLORS[slug] ?? `oklch(0.5 0.15 ${hash(slug) % 360})`;
}

/** Estilo inline que alimenta os utilitários tint-* (globals.css). */
export function hueStyle(hue: number): CSSProperties {
  return { "--hue": hue } as CSSProperties;
}

/** Cor de fundo sólida (deep) da matiz — para elementos decorativos. */
export function hueDeep(hue: number): string {
  return `oklch(0.6 0.15 ${hue})`;
}

/** Iniciais de um nome ("TecnoCentro CDE" → "TC"). */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const letters = words.filter((w) => /^[A-ZÀ-Ý]/.test(w)).slice(0, 2);
  const picked = letters.length ? letters : words.slice(0, 2);
  return picked.map((w) => w[0]!.toUpperCase()).join("");
}
