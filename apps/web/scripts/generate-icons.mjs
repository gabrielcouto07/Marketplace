// Gera os ícones PNG do manifest, favicons, apple-touch-icon e a imagem OG a partir da sacola
// Mercado Paraguai (public/brand/logo-mercado-paraguai.png, ver DESIGN.md › Apêndice B, item 13).
// A fonte é um raster de 256 px com fundo branco: o 512 sai ampliado ~2×.
// Os nomes dos arquivos mudam quando a arte muda: o service worker guarda /icons/* em CacheFirst.
// Uso: pnpm icons
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public/icons");
mkdirSync(outDir, { recursive: true });

/** Cores da identidade (DESIGN.md): tile branco, Marinho e as quatro cores da marca. */
const TILE = "#FFFFFF";
const MARINHO = "#0A1733";
const WHITE_80 = "#CED1D6";
const QUARTET = ["#F2263E", "#1552EB", "#00B852", "#FFD20A"];

/** A sacola recortada rente ao desenho (o PNG tem margem branca desigual). */
const bag = await sharp(join(root, "public/brand/logo-mercado-paraguai.png"))
  .trim({ background: TILE, threshold: 12 })
  .toBuffer({ resolveWithObject: true });
const bagRatio = bag.info.width / bag.info.height;

/** A sacola com `height` px de altura, no fundo branco do próprio PNG. */
const bagAt = (height) =>
  sharp(bag.data)
    .resize({ height: Math.round(height), width: Math.round(height * bagRatio), fit: "fill" })
    .png()
    .toBuffer();

/**
 * Tile branco de `size` px com a sacola ocupando `fill` da altura. `radius` em fração do lado
 * (0.25 = o raio do tile do BrandMark); 0 = full-bleed, para quem aplica a própria máscara.
 */
async function tile(size, { fill, radius }) {
  const r = Math.round(size * radius);
  const base = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${TILE}"/></svg>`,
  );
  return sharp(base)
    .composite([{ input: await bagAt(size * fill), gravity: "center" }])
    .png()
    .toBuffer();
}

/** Ícone "any": tile com cantos arredondados e fundo transparente fora dele. */
async function plain(size) {
  writeFileSync(join(outDir, `sacola-${size}.png`), await tile(size, { fill: 0.74, radius: 0.25 }));
}

/** Maskable: branco até a borda e a sacola dentro da zona segura (círculo de 80 % central). */
async function maskable(size) {
  writeFileSync(
    join(outDir, `sacola-maskable-${size}.png`),
    await tile(size, { fill: 0.6, radius: 0 }),
  );
}

/** Apple touch icon: full-bleed (o iOS arredonda os cantos). */
async function apple(size) {
  writeFileSync(join(outDir, "sacola-apple-touch.png"), await tile(size, { fill: 0.74, radius: 0 }));
}

/** OG / screenshot do manifest: Marinho, ícone, nome em branco e a faixa das quatro cores. */
async function splash() {
  const w = 1200;
  const h = 630;
  const icon = await tile(220, { fill: 0.74, radius: 0.25 });
  const band = QUARTET.map(
    (c, i) => `<rect x="${i * (w / 4)}" width="${w / 4}" height="10" fill="${c}"/>`,
  ).join("");
  const stripe = Buffer.from(`<svg width="${w}" height="10">${band}</svg>`);
  const text = Buffer.from(
    `<svg width="${w}" height="${h}"><text x="600" y="444" text-anchor="middle" font-family="Figtree, Arial, sans-serif" font-size="60" font-style="italic" font-weight="800" letter-spacing="-1.2" fill="#FFFFFF">Mercado Paraguai</text><text x="600" y="496" text-anchor="middle" font-family="Figtree, Arial, sans-serif" font-size="26" font-weight="500" fill="${WHITE_80}">Do Paraguai para todo o Brasil, com preço, frete e impostos claros</text></svg>`,
  );
  const buf = await sharp({ create: { width: w, height: h, channels: 4, background: MARINHO } })
    .composite([
      { input: icon, top: 140, left: 490 },
      { input: text, top: 0, left: 0 },
      { input: stripe, top: h - 10, left: 0 },
    ])
    .png()
    .toBuffer();
  writeFileSync(join(root, "public/og-default.png"), buf);
}

/** favicon.ico com PNGs embutidos (16, 32 e 48 px), formato aceito por todos os navegadores. */
async function favicon() {
  const sizes = [16, 32, 48];
  // Sacola maior no tile: nos tamanhos de aba a margem só tira leitura.
  const images = await Promise.all(sizes.map((s) => tile(s, { fill: 0.9, radius: 0.25 })));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(s, 0);
    e.writeUInt8(s, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(images[i].length, 8);
    e.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return e;
  });
  writeFileSync(join(root, "src/app/favicon.ico"), Buffer.concat([header, ...entries, ...images]));
  writeFileSync(join(root, "public/favicon-32.png"), images[1]);
}

await Promise.all([
  plain(192),
  plain(512),
  maskable(192),
  maskable(512),
  apple(180),
  splash(),
  favicon(),
]);
console.log(
  "Ícones gerados em public/icons, public/favicon-32.png, src/app/favicon.ico e public/og-default.png",
);
