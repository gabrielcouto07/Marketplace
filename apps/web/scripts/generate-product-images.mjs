// Gera imagens SVG placeholder (sem marcas) para produtos, categorias, banners e lojas.
// Uso: pnpm images   (idempotente; sobrescreve os arquivos)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const templates = JSON.parse(
  readFileSync(join(root, "src/mocks/fixtures/product-templates.json"), "utf8"),
);

const CATEGORY = {
  eletronicos: { label: "Eletrônicos", hue: 222, icon: "tv" },
  perfumes: { label: "Perfumes", hue: 330, icon: "bottle" },
  informatica: { label: "Informática", hue: 200, icon: "laptop" },
  celulares: { label: "Celulares", hue: 250, icon: "phone" },
  bebidas: { label: "Bebidas", hue: 30, icon: "glass" },
  casa: { label: "Casa", hue: 160, icon: "house" },
  esportes: { label: "Esportes", hue: 100, icon: "ball" },
  moda: { label: "Moda", hue: 355, icon: "shirt" },
};

const ICONS = {
  tv: `<rect x="120" y="170" width="360" height="220" rx="18"/><path d="M240 430h120M300 390v40" stroke-width="22"/>`,
  bottle: `<rect x="255" y="150" width="90" height="60" rx="8"/><path d="M225 230h150l25 40v190a30 30 0 0 1-30 30H230a30 30 0 0 1-30-30V270z"/>`,
  laptop: `<rect x="140" y="170" width="320" height="200" rx="14"/><path d="M100 400h400l-20 40H120z"/>`,
  phone: `<rect x="205" y="120" width="190" height="360" rx="34"/><circle cx="300" cy="440" r="14" fill="#fff" opacity=".6"/>`,
  glass: `<path d="M200 140h200l-30 190a70 70 0 0 1-140 0z"/><path d="M300 330v110M240 450h120" stroke-width="22"/>`,
  house: `<path d="M300 130 130 290h50v170h120v-110h60v110h120V290h50z"/>`,
  ball: `<circle cx="300" cy="300" r="150"/><path d="M300 150v300M150 300h300" stroke="#fff" stroke-width="16" opacity=".5"/>`,
  shirt: `<path d="M215 130l85 40 85-40 95 70-50 70-40-20v230H210V250l-40 20-50-70z"/>`,
};

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text, max = 26) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      lines.push(cur.trim());
      cur = w;
    } else cur = `${cur} ${w}`;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 3);
}

function productSvg(catKey, name, index, variant) {
  const c = CATEGORY[catKey];
  const hue = (c.hue + variant * 14) % 360;
  const bg1 = `hsl(${hue} 70% 96%)`;
  const bg2 = `hsl(${hue} 60% 88%)`;
  const fg = `hsl(${hue} 55% 42%)`;
  const lines = wrap(name);
  const rotate = variant === 1 ? 0 : variant === 2 ? -8 : 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="${esc(name)}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
<rect width="600" height="600" fill="url(#g)"/>
<circle cx="${variant * 150}" cy="80" r="140" fill="${fg}" opacity=".07"/>
<g transform="translate(0 -40) rotate(${rotate} 300 300)" fill="${fg}" stroke="${fg}" stroke-linecap="round" stroke-linejoin="round" opacity=".9">${ICONS[c.icon]}</g>
<text x="300" y="520" text-anchor="middle" font-family="Plus Jakarta Sans, Inter, Arial, sans-serif" font-size="22" font-weight="600" fill="${fg}">${lines.map((l, i) => `<tspan x="300" dy="${i === 0 ? 0 : 26}">${esc(l)}</tspan>`).join("")}</text>
<text x="560" y="580" text-anchor="end" font-family="Plus Jakarta Sans, Inter, Arial, sans-serif" font-size="16" fill="${fg}" opacity=".7">${index}/${variant}</text>
</svg>`;
}

function categorySvg(catKey) {
  const c = CATEGORY[catKey];
  const fg = `hsl(${c.hue} 55% 42%)`;
  const bg = `hsl(${c.hue} 70% 94%)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="${esc(c.label)}">
<rect width="600" height="600" rx="80" fill="${bg}"/>
<g transform="translate(0 0)" fill="${fg}" stroke="${fg}" stroke-linecap="round" stroke-linejoin="round">${ICONS[c.icon]}</g>
</svg>`;
}

function bannerSvg(key, title, subtitle, tone) {
  const palette = {
    blue: ["#0038A8", "#2456C4", "#FFFFFF"],
    red: ["#D52B1E", "#E55A4B", "#FFFFFF"],
    neutral: ["#F1F5F9", "#E2E8F0", "#0F172A"],
  }[tone];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 480" width="1200" height="480" role="img" aria-label="${esc(title)}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient></defs>
<rect width="1200" height="480" fill="url(#g)"/>
<circle cx="1000" cy="240" r="260" fill="${palette[2]}" opacity=".08"/>
<circle cx="1100" cy="120" r="140" fill="${palette[2]}" opacity=".08"/>
<rect x="0" y="464" width="400" height="16" fill="#D52B1E"/><rect x="400" y="464" width="400" height="16" fill="#FFFFFF"/><rect x="800" y="464" width="400" height="16" fill="#0038A8"/>
<text x="72" y="220" font-family="Plus Jakarta Sans, Inter, Arial, sans-serif" font-size="64" font-weight="800" fill="${palette[2]}">${esc(title)}</text>
<text x="72" y="290" font-family="Plus Jakarta Sans, Inter, Arial, sans-serif" font-size="30" fill="${palette[2]}" opacity=".85">${esc(subtitle)}</text>
</svg>`;
}

function sellerLogoSvg(slug, name, hue) {
  const initials = name
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="${esc(name)}">
<rect width="200" height="200" rx="48" fill="hsl(${hue} 60% 40%)"/>
<text x="100" y="122" text-anchor="middle" font-family="Plus Jakarta Sans, Inter, Arial, sans-serif" font-size="72" font-weight="800" fill="#fff">${esc(initials)}</text>
</svg>`;
}

function sellerBannerSvg(slug, name, hue) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 360" width="1200" height="360" role="img" aria-label="${esc(name)}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="hsl(${hue} 60% 30%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 60% 45%)"/></linearGradient></defs>
<rect width="1200" height="360" fill="url(#g)"/>
<circle cx="950" cy="180" r="220" fill="#fff" opacity=".06"/>
<circle cx="1120" cy="60" r="120" fill="#fff" opacity=".06"/>
</svg>`;
}

const out = (rel) => join(root, "public", rel);
for (const dir of ["images/products", "images/categories", "images/banners", "images/sellers"])
  mkdirSync(out(dir), { recursive: true });

let count = 0;
for (const [catKey, list] of Object.entries(templates)) {
  list.forEach((t, i) => {
    for (const v of [1, 2, 3]) {
      writeFileSync(
        out(`images/products/${catKey}-${i + 1}-${v}.svg`),
        productSvg(catKey, t.name, i + 1, v),
      );
      count++;
    }
  });
  writeFileSync(out(`images/categories/${catKey}.svg`), categorySvg(catKey));
  count++;
}

const banners = [
  ["tech", "Semana da Tecnologia", "Até 40% off em smartphones e notebooks", "blue"],
  ["perfumes", "Perfumes originais", "Importadora oficial com lote verificável", "red"],
  [
    "frete",
    "Frete grátis acima de R$ 300",
    "Nas lojas participantes, com rastreio ponta a ponta",
    "neutral",
  ],
];
for (const [key, title, subtitle, tone] of banners) {
  writeFileSync(out(`images/banners/${key}.svg`), bannerSvg(key, title, subtitle, tone));
  count++;
}

const sellers = [
  ["tecnocentro-cde", "TecnoCentro CDE", 222],
  ["perfumaria-del-este", "Perfumaria del Este", 330],
  ["casa-nova-import", "Casa Nova Import", 160],
  ["megastore-paraguay", "MegaStore Paraguay", 262],
  ["nippon-center", "Nippon Center", 200],
  ["bebidas-del-puente", "Bebidas del Puente", 30],
  ["sport-house-py", "Sport House PY", 100],
  ["moda-guarani", "Moda Guaraní", 355],
];
for (const [slug, name, hue] of sellers) {
  writeFileSync(out(`images/sellers/${slug}.svg`), sellerLogoSvg(slug, name, hue));
  writeFileSync(out(`images/banners/seller-${slug}.svg`), sellerBannerSvg(slug, name, hue));
  count += 2;
}

console.log(`Geradas ${count} imagens em public/images`);
