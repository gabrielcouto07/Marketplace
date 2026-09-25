import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

/**
 * Sitemap com as rotas públicas principais. Quando o backend existir,
 * buscar /products e /categories aqui (server-side) para listar slugs dinâmicos.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.siteUrl;
  const categories = ["eletronicos", "perfumes", "informatica", "celulares", "bebidas", "casa", "esportes", "moda"];
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/busca`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/categorias`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/instalar`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    ...categories.map((slug) => ({
      url: `${base}/categoria/${slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
