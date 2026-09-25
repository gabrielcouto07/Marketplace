// Gera os ícones PNG do manifest, favicon, apple-touch-icon e a imagem OG a partir de
// public/logo.svg (versão vetorial do ícone principal, ver DESIGN.md › Apêndice A).
// Uso: pnpm icons
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const logo = readFileSync(join(root, "public/logo.svg"), "utf8");
const outDir = join(root, "public/icons");
mkdirSync(outDir, { recursive: true });

/** Cores da marca (DESIGN.md): navy do ícone, azul-marinho profundo e faixa tricolor. */
const TILE = "#0E1B3D";
const BLUE_950 = "#061333";
const FLAG_RED = "#D52B1E";
const FLAG_BLUE = "#0038A8";

/** Mesmo desenho, sem os cantos arredondados: iOS e ícones maskable aplicam a própria máscara. */
const fullBleed = Buffer.from(logo.replace('rx="228"', 'rx="0"'));
const tile = Buffer.from(logo);

/** Ícone "any": o tile com cantos arredondados e fundo transparente fora dele. */
async function plain(size) {
  const buf = await sharp(tile, { density: 300 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  writeFileSync(join(outDir, `icon-${size}.png`), buf);
}

/** Maskable: navy até a borda e a sacola dentro da zona segura (80 % central). */
async function maskable(size) {
  const inner = Math.round(size * 0.8);
  const bag = await sharp(fullBleed, { density: 300 }).resize(inner, inner).png().toBuffer();
  const buf = await sharp({ create: { width: size, height: size, channels: 4, background: TILE } })
    .composite([{ input: bag, gravity: "center" }])
    .png()
    .toBuffer();
  writeFileSync(join(outDir, `icon-maskable-${size}.png`), buf);
}

/** Apple touch icon: full-bleed (o iOS arredonda os cantos). */
async function apple(size) {
  const buf = await sharp(fullBleed, { density: 300 }).resize(size, size).png().toBuffer();
  writeFileSync(join(outDir, "apple-touch-icon.png"), buf);
}

/** OG / screenshot do manifest: tile sobre azul-marinho profundo com a assinatura tricolor. */
async function splash() {
  const w = 1200;
  const h = 630;
  const icon = await sharp(tile, { density: 300 }).resize(220, 220).png().toBuffer();
  const stripe = Buffer.from(
    `<svg width="${w}" height="6"><rect width="400" height="6" fill="${FLAG_RED}"/><rect x="400" width="400" height="6" fill="#FFFFFF"/><rect x="800" width="400" height="6" fill="${FLAG_BLUE}"/></svg>`,
  );
  const text = Buffer.from(
    `<svg width="${w}" height="${h}"><text x="600" y="440" text-anchor="middle" font-family="Geist, Inter, Arial, sans-serif" font-size="52" font-weight="600" letter-spacing="-1" fill="#FFFFFF">Marketplace Paraguai</text><text x="600" y="492" text-anchor="middle" font-family="Geist, Inter, Arial, sans-serif" font-size="26" fill="#8AAAEA">Do Paraguai para a sua casa, com preço, frete e impostos claros</text></svg>`,
  );
  const buf = await sharp({ create: { width: w, height: h, channels: 4, background: BLUE_950 } })
    .composite([
      { input: icon, top: 150, left: 490 },
      { input: text, top: 0, left: 0 },
      { input: stripe, top: h - 6, left: 0 },
    ])
    .png()
    .toBuffer();
  writeFileSync(join(root, "public/og-default.png"), buf);
}

await Promise.all([plain(192), plain(512), maskable(192), maskable(512), apple(180), splash()]);
const fav = await sharp(tile, { density: 300 })
  .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
writeFileSync(join(root, "public/favicon-32.png"), fav);
console.log("Ícones gerados em public/icons, public/favicon-32.png e public/og-default.png");
