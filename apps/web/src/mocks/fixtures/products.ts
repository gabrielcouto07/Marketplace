import type {
  Money,
  ProductDetailDto,
  ProductSummaryDto,
  ProductVariantDto,
  ProductVariantOptionDto,
  QuestionDto,
  ReviewDto,
  ReviewSummaryDto,
} from "@marketplace/contracts";

import { convert } from "@/lib/money";

import { CATEGORIES, SELLERS, getRate, guid, hashString, isoDaysAgo, seeded, slugify, toSellerSummary } from "./base";
import templatesJson from "./product-templates.json";

interface Template {
  name: string;
  price: number;
  compareAt: number | null;
  attrs: Array<[string, string]>;
  variants: Record<string, string[]> | null;
  warranty: number | null;
}

const templates = templatesJson as unknown as Record<string, Template[]>;
const brlToPyg = getRate("BRL", "PYG");

/** Vendedores elegíveis por categoria (com fallback para lojas generalistas). */
function pickSeller(categorySlug: string, index: number) {
  const eligible = SELLERS.filter((s) => s.categories.some((c) => c.slug === categorySlug));
  const pool = eligible.length > 0 ? eligible : SELLERS;
  return pool[index % pool.length];
}

function cartesian(options: ProductVariantOptionDto[]): Array<Record<string, string>> {
  return options.reduce<Array<Record<string, string>>>(
    (acc, opt) => acc.flatMap((combo) => opt.values.map((v) => ({ ...combo, [opt.name]: v }))),
    [{}],
  );
}

function buildVariants(
  productKey: string,
  base: Money,
  compareAt: Money | null,
  options: ProductVariantOptionDto[],
  rnd: () => number,
): ProductVariantDto[] {
  if (options.length === 0) return [];
  const combos = cartesian(options);
  return combos.map((attributes, i) => {
    // Variantes "maiores" (2ª, 3ª opção) custam mais: +0%, +18%, +36%...
    const firstOpt = options[0];
    const idx = firstOpt.values.indexOf(attributes[firstOpt.name]);
    const bump = firstOpt.name === "Cor" || firstOpt.name === "Sabor" || firstOpt.name === "Fragrância" ? 0 : idx * 18;
    const price: Money = { amount: Math.round((base.amount * (100 + bump)) / 100), currency: "BRL" };
    const cmp: Money | null = compareAt
      ? { amount: Math.round((compareAt.amount * (100 + bump)) / 100), currency: "BRL" }
      : null;
    const stock = rnd() < 0.12 ? 0 : 1 + Math.floor(rnd() * 25);
    return {
      id: guid(`${productKey}:variant:${i}`),
      sku: `${productKey.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}-${String(i + 1).padStart(2, "0")}`,
      attributes,
      price,
      compareAtPrice: cmp,
      stock,
      imageId: null,
    };
  });
}

function buildDescription(name: string, categoryName: string, attrs: Array<[string, string]>, sellerCity: string): string {
  const specs = attrs.map(([k, v]) => `• ${k}: ${v}`).join("\n");
  return (
    `${name} — produto novo, lacrado e original, enviado diretamente de ${sellerCity} (Paraguai).\n\n` +
    `Categoria: ${categoryName}.\n\n` +
    `Principais características:\n${specs}\n\n` +
    `O envio internacional é feito com rastreio ponta a ponta. Os prazos exibidos consideram dias úteis e o desembaraço aduaneiro. ` +
    `Os impostos de importação são estimados no checkout e podem variar conforme a fiscalização.`
  );
}

export interface ProductRecord {
  detail: ProductDetailDto;
  reviews: ReviewDto[];
  reviewSummary: ReviewSummaryDto;
  questions: QuestionDto[];
}

const REVIEW_AUTHORS = [
  "Mariana S.",
  "Carlos E.",
  "Juliana P.",
  "Rafael M.",
  "Fernanda L.",
  "Bruno A.",
  "Patrícia R.",
  "Lucas T.",
  "Camila F.",
  "Diego N.",
  "Aline C.",
  "Thiago V.",
];

const REVIEW_TEXTS: Array<{ rating: number; title: string; comment: string }> = [
  { rating: 5, title: "Chegou antes do prazo", comment: "Produto original, lacrado e chegou 5 dias antes da estimativa. Recomendo a loja." },
  { rating: 5, title: "Excelente custo-benefício", comment: "Mesmo com o imposto ficou bem mais barato do que no Brasil. Embalagem impecável." },
  { rating: 4, title: "Muito bom", comment: "Produto conforme o anúncio. Só o rastreio demorou alguns dias para atualizar na alfândega." },
  { rating: 4, title: "Gostei", comment: "Funciona perfeitamente. A caixa veio um pouco amassada, mas o produto estava intacto." },
  { rating: 3, title: "Ok, mas demorou", comment: "Chegou dentro da faixa de prazo, mas no limite. Produto bom." },
  { rating: 5, title: "Perfeito", comment: "Segunda compra com esse vendedor, sempre entrega certinho e responde rápido." },
  { rating: 2, title: "Veio com defeito", comment: "Veio com um problema, mas a loja resolveu a troca sem burocracia. Por isso não dou 1." },
  { rating: 5, title: "Recomendo", comment: "Atendimento excelente, tiraram todas as dúvidas antes da compra." },
];

const QUESTION_TEXTS: Array<{ q: string; a: string | null }> = [
  { q: "Vem com nota fiscal e garantia no Brasil?", a: "Olá! Enviamos com invoice e a garantia é de fábrica, atendida por assistência credenciada no Brasil." },
  { q: "Qual o prazo real de entrega para São Paulo?", a: "Em média 12 a 18 dias úteis, já contando o desembaraço." },
  { q: "O imposto já está incluso no preço?", a: "O imposto de importação é estimado no checkout e exibido separadamente antes de você pagar." },
  { q: "Aceita parcelamento no cartão?", a: "Sim, em até 12x com juros da operadora ou à vista no Pix com desconto." },
  { q: "Tem estoque disponível para envio imediato?", a: null },
  { q: "É bivolt?", a: "Sim, 110/220 V automático." },
];

function buildReviews(productKey: string, rnd: () => number): { reviews: ReviewDto[]; summary: ReviewSummaryDto } {
  const count = 3 + Math.floor(rnd() * 4);
  const reviews: ReviewDto[] = Array.from({ length: count }, (_, i) => {
    const text = REVIEW_TEXTS[Math.floor(rnd() * REVIEW_TEXTS.length)];
    return {
      id: guid(`${productKey}:review:${i}`),
      productId: guid(productKey),
      authorName: REVIEW_AUTHORS[Math.floor(rnd() * REVIEW_AUTHORS.length)],
      rating: text.rating,
      title: text.title,
      comment: text.comment,
      createdAt: isoDaysAgo(2 + Math.floor(rnd() * 120)),
      helpfulCount: Math.floor(rnd() * 40),
      verifiedPurchase: rnd() > 0.15,
    };
  });
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const r of reviews) distribution[r.rating - 1] += 1;
  const total = reviews.length;
  const average = total ? reviews.reduce((a, r) => a + r.rating, 0) / total : 0;
  return { reviews, summary: { average: Math.round(average * 10) / 10, total, distribution } };
}

function buildQuestions(productKey: string, rnd: () => number): QuestionDto[] {
  const count = 1 + Math.floor(rnd() * 4);
  return Array.from({ length: count }, (_, i) => {
    const q = QUESTION_TEXTS[(hashString(productKey) + i) % QUESTION_TEXTS.length];
    const askedAt = isoDaysAgo(1 + Math.floor(rnd() * 60));
    return {
      id: guid(`${productKey}:question:${i}`),
      productId: guid(productKey),
      question: q.q,
      askedBy: REVIEW_AUTHORS[(i * 5 + hashString(productKey)) % REVIEW_AUTHORS.length],
      askedAt,
      answer: q.a ? { text: q.a, answeredAt: askedAt } : null,
    };
  });
}

function buildAll(): ProductRecord[] {
  const records: ProductRecord[] = [];
  let global = 0;
  for (const category of CATEGORIES) {
    const list = templates[category.slug] ?? [];
    list.forEach((t, i) => {
      global += 1;
      const seller = pickSeller(category.slug, i + global);
      const key = `product:${category.slug}:${i + 1}`;
      const rnd = seeded(hashString(key));
      const slug = `${slugify(t.name)}-${category.slug.slice(0, 3)}${i + 1}`;
      const price: Money = { amount: t.price, currency: "BRL" };
      const compareAt: Money | null = t.compareAt ? { amount: t.compareAt, currency: "BRL" } : null;
      const options: ProductVariantOptionDto[] = t.variants
        ? Object.entries(t.variants).map(([name, values]) => ({ name, values }))
        : [];
      const variants = buildVariants(key, price, compareAt, options, rnd);
      const stock = variants.length ? variants.reduce((a, v) => a + v.stock, 0) : rnd() < 0.08 ? 0 : 3 + Math.floor(rnd() * 40);
      const { reviews, summary } = buildReviews(key, rnd);
      const questions = buildQuestions(key, rnd);
      const createdDaysAgo = Math.floor(rnd() * 200);
      const discount = compareAt ? Math.round(((compareAt.amount - price.amount) / compareAt.amount) * 100) : 0;
      const images = [1, 2, 3].map((n) => ({
        id: guid(`${key}:image:${n}`),
        url: `/images/products/${category.slug}-${i + 1}-${n}.svg`,
        alt: `${t.name} — imagem ${n}`,
        sortOrder: n,
      }));

      const detail: ProductDetailDto = {
        id: guid(key),
        slug,
        name: t.name,
        thumbnailUrl: images[0].url,
        price,
        compareAtPrice: compareAt,
        referencePrice: convert(price, brlToPyg),
        discountPercent: discount,
        rating: summary.average,
        reviewCount: summary.total + Math.floor(rnd() * 300),
        soldCount: Math.floor(rnd() * 2500),
        stock,
        freeShipping: price.amount >= 30000 && rnd() > 0.35,
        isNew: createdDaysAgo < 30,
        isOffer: discount >= 15,
        categoryId: category.id,
        seller: toSellerSummary(seller),
        createdAt: isoDaysAgo(createdDaysAgo),
        description: buildDescription(t.name, category.name, t.attrs, seller.city),
        images,
        variantOptions: options,
        variants,
        attributes: t.attrs.map(([name, value]) => ({ name, value })),
        categoryPath: [{ id: category.id, slug: category.slug, name: category.name }],
        originCity: seller.city,
        handlingDays: { min: 1, max: 3 },
        warrantyMonths: t.warranty,
        questionCount: questions.length,
      };
      records.push({ detail, reviews, reviewSummary: summary, questions });
    });
  }
  return records;
}

export const PRODUCT_RECORDS: ProductRecord[] = buildAll();
export const PRODUCTS: ProductDetailDto[] = PRODUCT_RECORDS.map((r) => r.detail);

// Atualiza a contagem de produtos por vendedor/categoria.
for (const seller of SELLERS) {
  seller.productCount = PRODUCTS.filter((p) => p.seller.id === seller.id).length;
}
for (const category of CATEGORIES) {
  category.productCount = PRODUCTS.filter((p) => p.categoryId === category.id).length;
}

export function toSummary(p: ProductDetailDto): ProductSummaryDto {
  const {
    description: _d,
    images: _i,
    variantOptions: _vo,
    variants: _v,
    attributes: _a,
    categoryPath: _cp,
    originCity: _oc,
    handlingDays: _hd,
    warrantyMonths: _wm,
    questionCount: _qc,
    ...summary
  } = p;
  return summary;
}

export const productBySlug = (slug: string) => PRODUCT_RECORDS.find((r) => r.detail.slug === slug);
export const productById = (id: string) => PRODUCT_RECORDS.find((r) => r.detail.id === id);
