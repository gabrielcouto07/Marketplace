// Gera os assets vetoriais que não vêm de fotografia: monogramas das lojas e o placeholder
// genérico de produto (usado pela API quando um anúncio ainda não tem imagem).
// As fotos de produto, categoria, banner e capa de loja vêm de scripts/fetch-product-images.mjs.
// Uso: node scripts/generate-product-images.mjs   (idempotente; sobrescreve os arquivos)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = (rel) => join(root, "public", rel);

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Monograma da loja: tile arredondado em tom escuro por matiz e iniciais em branco. */
function sellerLogoSvg(name, hue) {
  const initials = name
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="${esc(name)}">
<rect width="200" height="200" rx="48" fill="hsl(${hue} 45% 28%)"/>
<text x="100" y="124" text-anchor="middle" font-family="Geist, Inter, Arial, sans-serif" font-size="76" font-weight="600" letter-spacing="-2" fill="#fff">${esc(initials)}</text>
</svg>`;
}

/** Placeholder neutro de produto (sacola em traço) sobre surface-muted. */
const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600" role="img" aria-label="Sem imagem">
<rect width="600" height="600" fill="#F1F1F3"/>
<g fill="none" stroke="#A3A3AD" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">
<path d="M190 230h220l22 230H168z"/><path d="M245 230v-30a55 55 0 0 1 110 0v30"/>
</g>
</svg>`;

mkdirSync(out("images/sellers"), { recursive: true });
mkdirSync(out("images/products"), { recursive: true });

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
  writeFileSync(out(`images/sellers/${slug}.svg`), sellerLogoSvg(name, hue));
}
writeFileSync(out("images/products/placeholder.svg"), placeholderSvg);

console.log(
  `Gerados ${sellers.length} monogramas de loja + placeholder de produto em public/images`,
);
