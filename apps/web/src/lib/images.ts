/**
 * Placeholder blur para next/image: um SVG 8×8 na cor de surface-muted (neutral-100).
 * Mantém o layout estável e evita o "flash" branco enquanto a imagem do produto carrega.
 */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#F1F1F3"/></svg>`;

export const BLUR_DATA_URL = `data:image/svg+xml;base64,${btoa(svg)}`;
