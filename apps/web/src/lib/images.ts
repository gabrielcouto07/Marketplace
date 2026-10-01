import { getApiBaseUrl } from "./api/http";
import blurColors from "./image-blur.json";

/**
 * Placeholders para next/image (DESIGN.md › Imagem: "next/image com placeholder blur").
 *
 * `image-blur.json` é gerado por `scripts/fetch-product-images.mjs` com a cor dominante de cada
 * asset local. O placeholder é um SVG de 8×8 nessa cor: pesa ~120 bytes por imagem, mantém o layout
 * estável e faz a foto "revelar" sobre a própria tonalidade em vez de um flash branco. Para URLs que
 * não constam no mapa (uploads de vendedores, CDN), cai no cinza de surface-muted.
 */
const COLORS: Record<string, string> = blurColors;
const FALLBACK = "#F1F1F3";

function solidSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const cache = new Map<string, string>();

/** Data URL de placeholder para a imagem informada (cor dominante quando conhecida). */
export function blurDataUrlFor(src: string | null | undefined): string {
  const key = src ? src.split("?")[0] : "";
  const color = COLORS[key] ?? FALLBACK;
  let url = cache.get(color);
  if (!url) {
    url = solidSvg(color);
    cache.set(color, url);
  }
  return url;
}

/** Placeholder genérico (surface-muted), para imagens sem cor conhecida. */
export const BLUR_DATA_URL = solidSvg(FALLBACK);

/**
 * Imagens que o otimizador do next/image não consegue buscar no servidor: uploads servidos pela
 * própria API (`/api/…` relativo ou a URL absoluta de NEXT_PUBLIC_API_URL, inclusive o mock em dev)
 * e URLs `blob:`/`data:` de pré-visualização. Nesses casos o componente deve usar `unoptimized`.
 */
export function isDirectImage(src: string | null | undefined): boolean {
  if (!src) return false;
  return (
    src.startsWith("/api/") ||
    src.startsWith("blob:") ||
    src.startsWith("data:") ||
    src.startsWith(`${getApiBaseUrl()}/`)
  );
}
