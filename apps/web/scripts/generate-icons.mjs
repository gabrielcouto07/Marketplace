// Gera os ícones PNG do manifest, favicons, apple-touch-icon e a imagem OG a partir da identidade
// Mania Paraguai (ver DESIGN.md › Apêndice B, item 14):
//  - public/brand/icone-mania-paraguai.png: o tile Marinho com a sacola, cantos arredondados e fundo
//    transparente (512 px, recortado da folha da marca: o 512 sai do tamanho do recorte, ampliado ~2,3×);
//  - public/brand/icone-mania-paraguai-maskable.png: o mesmo tile num quadrado Marinho até a borda,
//    com a sacola dentro da zona segura (maskable e apple-touch);
//  - public/brand/logo-mania-paraguai-v2.png: a logo (sacola + "Mania Paraguai"), fundo transparente sem halo.
// Os nomes dos arquivos mudam quando a arte muda: o service worker guarda /icons/* em CacheFirst.
// Fora do prebuild: os PNGs são versionados e a imagem do Docker não tem fontes (o texto da OG
// sairia em caixinhas).
// Uso: pnpm icons
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, "public/icons");
mkdirSync(outDir, { recursive: true });

const brand = (file) => join(root, "public/brand", file);
const TILE = brand("icone-mania-paraguai.png");
const FULL_BLEED = brand("icone-mania-paraguai-maskable.png");
const LOGO = brand("logo-mania-paraguai-v2.png");

/** Cores da logo: o Marinho do contorno do wordmark, o Vermelho e o Azul da sacola. */
const MARINHO = "#041850";
const VERMELHO = "#E8202E";
const AZUL = "#1F55E0";

/** PNG com paleta (libimagequant, com dithering): a arte é raster e sem a paleta o 512 passa de 400 KB. */
const PNG = { palette: true, quality: 90, effort: 10, compressionLevel: 9 };

const resize = (file, size) => sharp(file).resize(size, size, { fit: "contain", background: "#00000000" }).png(PNG).toBuffer();

/** Ícone "any": o tile com os cantos arredondados e fundo transparente fora dele. */
async function plain(size) {
  writeFileSync(join(outDir, `mania-${size}.png`), await resize(TILE, size));
}

/** Maskable: Marinho até a borda e a sacola dentro da zona segura (círculo de 80 % central). */
async function maskable(size) {
  writeFileSync(join(outDir, `mania-maskable-${size}.png`), await resize(FULL_BLEED, size));
}

/** Apple touch icon: full-bleed (o iOS arredonda os cantos). */
async function apple(size) {
  writeFileSync(join(outDir, "mania-apple-touch.png"), await resize(FULL_BLEED, size));
}

/** OG / screenshot do manifest: fundo branco, a logo horizontal, a frase em Marinho e a faixa Vermelho/Azul. */
async function splash() {
  const w = 1200;
  const h = 630;
  const logo = await sharp(LOGO).resize({ width: 780 }).png().toBuffer();
  const { height: logoH } = await sharp(logo).metadata();
  const stripe = Buffer.from(
    `<svg width="${w}" height="12"><rect width="${w / 2}" height="12" fill="${VERMELHO}"/><rect x="${w / 2}" width="${w / 2}" height="12" fill="${AZUL}"/></svg>`,
  );
  const text = Buffer.from(
    `<svg width="${w}" height="${h}"><text x="600" y="480" text-anchor="middle" font-family="Figtree, Arial, sans-serif" font-size="30" font-weight="600" fill="${MARINHO}">Do Paraguai para todo o Brasil, com preço, frete e impostos claros</text></svg>`,
  );
  const buf = await sharp({ create: { width: w, height: h, channels: 4, background: "#FFFFFF" } })
    .composite([
      { input: logo, top: Math.round(270 - logoH / 2), left: 210 },
      { input: text, top: 0, left: 0 },
      { input: stripe, top: h - 12, left: 0 },
    ])
    .png(PNG)
    .toBuffer();
  writeFileSync(join(root, "public/og-default.png"), buf);
}

/** favicon.ico com PNGs embutidos (16, 32 e 48 px), formato aceito por todos os navegadores. */
async function favicon() {
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map((s) => resize(TILE, s)));
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
