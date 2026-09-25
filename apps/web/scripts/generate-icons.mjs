// Gera os ícones PNG do manifest a partir de public/logo.svg usando sharp.
// Uso: pnpm icons
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const logo = readFileSync(join(root, "public/logo.svg"));
const outDir = join(root, "public/icons");
mkdirSync(outDir, { recursive: true });

const THEME = "#0038A8";

async function plain(size) {
  const buf = await sharp(logo).resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  writeFileSync(join(outDir, `icon-${size}.png`), buf);
}

/** Maskable: logo ocupa a "safe zone" (80% central) sobre fundo branco. */
async function maskable(size) {
  const inner = Math.round(size * 0.66);
  const logoBuf = await sharp(logo).resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  const buf = await sharp({ create: { width: size, height: size, channels: 4, background: "#FFFFFF" } })
    .composite([{ input: logoBuf, gravity: "center" }])
    .png()
    .toBuffer();
  writeFileSync(join(outDir, `icon-maskable-${size}.png`), buf);
}

async function apple(size) {
  const inner = Math.round(size * 0.74);
  const logoBuf = await sharp(logo).resize(inner, inner, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
  const buf = await sharp({ create: { width: size, height: size, channels: 4, background: "#FFFFFF" } })
    .composite([{ input: logoBuf, gravity: "center" }])
    .png()
    .toBuffer();
  writeFileSync(join(outDir, `apple-touch-icon.png`), buf);
}

async function splash() {
  // Splash simples (usada como screenshot do manifest e imagem OG fallback)
  const w = 1200;
  const h = 630;
  const logoBuf = await sharp(logo).resize(260, 260).png().toBuffer();
  const stripe = Buffer.from(
    `<svg width="${w}" height="12"><rect width="400" height="12" fill="#D52B1E"/><rect x="400" width="400" height="12" fill="#FFFFFF"/><rect x="800" width="400" height="12" fill="${THEME}"/></svg>`,
  );
  const text = Buffer.from(
    `<svg width="${w}" height="${h}"><text x="600" y="470" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="800" fill="#0F172A">Marketplace Paraguai</text><text x="600" y="530" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#475569">Do Paraguai para a sua casa, com rastreio ponta a ponta</text></svg>`,
  );
  const buf = await sharp({ create: { width: w, height: h, channels: 4, background: "#FFFFFF" } })
    .composite([
      { input: logoBuf, top: 120, left: 470 },
      { input: text, top: 0, left: 0 },
      { input: stripe, top: h - 12, left: 0 },
    ])
    .png()
    .toBuffer();
  writeFileSync(join(root, "public/og-default.png"), buf);
}

await Promise.all([plain(192), plain(512), maskable(192), maskable(512), apple(180), splash()]);
const fav = await sharp(logo).resize(32, 32).png().toBuffer();
writeFileSync(join(root, "public/favicon-32.png"), fav);
console.log("Ícones gerados em public/icons e public/og-default.png");
