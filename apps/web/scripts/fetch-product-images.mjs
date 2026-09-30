// Baixa as fotografias listadas em product-images.manifest.json (Unsplash) e gera os assets
// otimizados em public/images (WebP quadrado para produtos/categorias, banners 2:1 e capas de loja),
// mais o mapa de cores dominantes usado como placeholder (src/lib/image-blur.json).
//
// Uso: pnpm --filter web images        (idempotente; usa o cache em scripts/.image-cache)
//      pnpm --filter web images --force (reprocessa mesmo com os arquivos já existentes)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(
  readFileSync(join(root, "scripts/product-images.manifest.json"), "utf8"),
);
const force = process.argv.includes("--force");
const cacheDir = join(root, "scripts/.image-cache");
const out = (rel) => join(root, "public", rel);

for (const dir of [
  cacheDir,
  "public/images/products",
  "public/images/categories",
  "public/images/banners",
  "public/images/sellers",
].map((d) => (d.startsWith("public") ? join(root, d) : d)))
  mkdirSync(dir, { recursive: true });

const SOURCE_WIDTH = 1400;

async function download(id) {
  const file = join(cacheDir, `${id}.jpg`);
  if (existsSync(file)) return file;
  const url = `https://images.unsplash.com/photo-${id}?w=${SOURCE_WIDTH}&q=85&fm=jpg&fit=max`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 5_000) throw new Error("resposta muito pequena");
      writeFileSync(file, buf);
      return file;
    } catch (err) {
      if (attempt === 3) throw new Error(`Falha ao baixar ${id}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  return file;
}

/** Recorte "de detalhe": aproxima o centro (zoom) para gerar uma 2ª/3ª imagem a partir da 1ª. */
function detailRegion(meta, variant) {
  const side = Math.min(meta.width, meta.height);
  const zoom = variant === 2 ? 0.62 : 0.5;
  const size = Math.round(side * zoom);
  const cx = Math.round(meta.width / 2 + (variant === 3 ? side * 0.08 : 0));
  const cy = Math.round(meta.height / 2 + (variant === 2 ? -side * 0.06 : side * 0.04));
  return {
    left: Math.max(0, Math.min(meta.width - size, cx - Math.round(size / 2))),
    top: Math.max(0, Math.min(meta.height - size, cy - Math.round(size / 2))),
    width: size,
    height: size,
  };
}

const colors = {};
let written = 0;
let skipped = 0;

async function dominantColor(buffer) {
  const { dominant } = await sharp(buffer).stats();
  const hex = (n) => n.toString(16).padStart(2, "0");
  return `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`;
}

async function emit(publicPath, pipeline) {
  const dest = out(publicPath);
  if (!force && existsSync(dest)) {
    skipped++;
    colors[`/${publicPath}`] = await dominantColor(dest);
    return;
  }
  const buffer = await pipeline.webp({ quality: 78, effort: 5 }).toBuffer();
  writeFileSync(dest, buffer);
  colors[`/${publicPath}`] = await dominantColor(buffer);
  written++;
}

// ----- Produtos: 3 imagens quadradas de 800 px por template -----
for (const [key, ids] of Object.entries(manifest.products)) {
  const files = [];
  for (const id of ids) files.push(await download(id));
  for (let n = 1; n <= 3; n++) {
    const publicPath = `images/products/${key}-${n}.webp`;
    if (files[n - 1]) {
      await emit(
        publicPath,
        sharp(files[n - 1]).resize(800, 800, { fit: "cover", position: "attention" }),
      );
    } else {
      const meta = await sharp(files[0]).metadata();
      await emit(publicPath, sharp(files[0]).extract(detailRegion(meta, n)).resize(800, 800));
    }
  }
}

// ----- Categorias: capa quadrada 640 px -----
for (const [slug, id] of Object.entries(manifest.categories)) {
  const file = await download(id);
  await emit(
    `images/categories/${slug}.webp`,
    sharp(file).resize(640, 640, { fit: "cover", position: "attention" }),
  );
}

// ----- Banners da home: 1200 × 600 -----
for (const [key, id] of Object.entries(manifest.banners)) {
  const file = await download(id);
  await emit(
    `images/banners/${key}.webp`,
    sharp(file).resize(1200, 600, { fit: "cover", position: "attention" }),
  );
}

// ----- Capas de loja: 1200 × 400 -----
for (const [slug, id] of Object.entries(manifest.sellers)) {
  const file = await download(id);
  await emit(
    `images/banners/seller-${slug}.webp`,
    sharp(file).resize(1200, 400, { fit: "cover", position: "attention" }),
  );
}

const sorted = Object.fromEntries(Object.entries(colors).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(join(root, "src/lib/image-blur.json"), `${JSON.stringify(sorted, null, 2)}\n`);

console.log(
  `Imagens: ${written} geradas, ${skipped} já existiam · ${Object.keys(colors).length} cores em src/lib/image-blur.json`,
);
