import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: site.backgroundColor,
    theme_color: site.themeColor,
    lang: "pt-BR",
    categories: ["shopping"],
    icons: [
      { src: "/icons/mania-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/mania-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/mania-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/mania-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Buscar", url: "/busca", icons: [{ src: "/icons/mania-192.png", sizes: "192x192" }] },
      {
        name: "Carrinho",
        url: "/carrinho",
        icons: [{ src: "/icons/mania-192.png", sizes: "192x192" }],
      },
      {
        name: "Meus pedidos",
        url: "/conta/pedidos",
        icons: [{ src: "/icons/mania-192.png", sizes: "192x192" }],
      },
    ],
    screenshots: [
      { src: "/og-default.png", sizes: "1200x630", type: "image/png", form_factor: "wide" },
    ],
  };
}
