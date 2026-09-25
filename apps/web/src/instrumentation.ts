/**
 * Next.js instrumentation hook. Quando o mock está ativo, registra o MSW no
 * runtime Node para que fetches do servidor (generateMetadata, sitemap) também
 * sejam interceptados. Não roda no runtime Edge.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PUBLIC_API_MOCKING === "true") {
    const { server } = await import("./mocks/server");
    server.listen({ onUnhandledRequest: "bypass" });
  }
}
