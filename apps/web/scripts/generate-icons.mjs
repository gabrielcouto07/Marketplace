// Gera os ícones PNG do manifest, favicons, apple-touch-icon, o PNG mestre e a imagem OG a partir
// de public/logo.svg (logo "Etiqueta", ver DESIGN.md › Apêndice A).
// Uso: pnpm icons
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const logo = readFileSync(join(root, "public/logo.svg"), "utf8");
const outDir = join(root, "public/icons");
mkdirSync(outDir, { recursive: true });

/** Cores da identidade (DESIGN.md): tile Amarelo, Marinho, Amarelo do wordmark e as quatro cores da marca. */
const TILE = "#FFD20A";
const MARINHO = "#0A1733";
const AMARELO = "#FFD20A";
const WHITE_80 = "#CED1D6";
const QUARTET = ["#F2263E", "#1552EB", "#00B852", "#FFD20A"];

/** Mesmo desenho, sem os cantos arredondados: iOS e ícones maskable aplicam a própria máscara. */
const fullBleed = Buffer.from(logo.replace('rx="30"', 'rx="0"'));
const tile = Buffer.from(logo);

const render = (svg, size) =>
  sharp(svg, { density: 600 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

/** Ícone "any": o tile com cantos arredondados e fundo transparente fora dele. */
async function plain(size) {
  writeFileSync(join(outDir, `icon-${size}.png`), await render(tile, size));
}

/** Maskable: Amarelo até a borda e o desenho dentro da zona segura (80 % central). */
async function maskable(size) {
  const inner = await render(fullBleed, Math.round(size * 0.8));
  const buf = await sharp({ create: { width: size, height: size, channels: 4, background: TILE } })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toBuffer();
  writeFileSync(join(outDir, `icon-maskable-${size}.png`), buf);
}

/** Apple touch icon: full-bleed (o iOS arredonda os cantos). */
async function apple(size) {
  writeFileSync(join(outDir, "apple-touch-icon.png"), await render(fullBleed, size));
}

/** OG / screenshot do manifest: Marinho, logo, wordmark em branco e Amarelo e a faixa das quatro cores. */
async function splash() {
  const w = 1200;
  const h = 630;
  const icon = await render(tile, 220);
  const band = QUARTET.map(
    (c, i) => `<rect x="${i * (w / 4)}" width="${w / 4}" height="10" fill="${c}"/>`,
  ).join("");
  const stripe = Buffer.from(`<svg width="${w}" height="10">${band}</svg>`);
  const text = Buffer.from(
    `<svg width="${w}" height="${h}"><text x="600" y="444" text-anchor="middle" font-family="Bricolage Grotesque, Figtree, Arial, sans-serif" font-size="60" font-weight="800" letter-spacing="-1.2" fill="#FFFFFF">Paraguai <tspan fill="${AMARELO}">Já</tspan></text><text x="600" y="496" text-anchor="middle" font-family="Figtree, Arial, sans-serif" font-size="26" font-weight="500" fill="${WHITE_80}">Do Paraguai para todo o Brasil, com preço, frete e impostos claros</text></svg>`,
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
  const images = await Promise.all(sizes.map((s) => render(tile, s)));
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

mkdirSync(join(root, "public/brand"), { recursive: true });
await Promise.all([
  plain(192),
  plain(512),
  maskable(192),
  maskable(512),
  apple(180),
  splash(),
  favicon(),
  render(tile, 1024).then((buf) =>
    writeFileSync(join(root, "public/brand/app-icon-1024.png"), buf),
  ),
]);
console.log(
  "Ícones gerados em public/icons, public/brand, public/favicon-32.png, src/app/favicon.ico e public/og-default.png",
);
