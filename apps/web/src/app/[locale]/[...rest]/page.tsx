import { notFound } from "next/navigation";

/** Catch-all: qualquer rota desconhecida dentro do locale cai no not-found.tsx localizado. */
export default function CatchAllPage() {
  notFound();
}
