# Convenções de código e sintaxes usadas

## Ferramentas

| Ferramenta | Config | Comando |
| --- | --- | --- |
| TypeScript strict, sem `any` (`@typescript-eslint/no-explicit-any: error`) | `apps/web/tsconfig.json` | `pnpm typecheck` |
| ESLint 9 flat config (`eslint-config-next` core-web-vitals + typescript + prettier) | `apps/web/eslint.config.mjs` | `pnpm lint` / `pnpm lint:fix` |
| Prettier + `prettier-plugin-tailwindcss` (ordena classes) | `.prettierrc` na raiz | `pnpm format` |
| pnpm 12 workspaces | `pnpm-workspace.yaml` (`allowBuilds` para sharp/msw/esbuild/swc) | `pnpm install` |

Regra ESLint customizada: `fetch` é proibido fora de `src/lib/api`, `src/mocks`, `src/sw.ts` e `scripts/`.

## Estrutura por feature

```
features/<dominio>/
  api/index.ts        → xxxApi (rotas) + hooks TanStack Query ("use client")
  components/*.tsx    → UI "use client" (views, formulários, cards)
  store.ts            → Zustand quando há estado de cliente (cart, auth, favorites)
  types.ts            → tipos locais (os DTOs ficam em @marketplace/contracts)
```
Páginas em `app/[locale]/(grupo)/rota/page.tsx` são Server Components mínimos:

```tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { … }

export default async function Page({ params }: { params: Promise<{ locale: AppLocale; slug: string }> }) {
  const { locale, slug } = await params;      // Next 16: params é Promise
  setRequestLocale(locale);
  return <StoreShell title="…" showBack><ProductView slug={slug} /></StoreShell>;
}
```
`searchParams` também é `Promise`; componentes client que usam `useSearchParams` devem estar dentro de `<Suspense>`.

## Nomenclatura

- Arquivos `kebab-case.tsx`; componentes `PascalCase`; hooks `useXxx`; stores `useXxxStore`.
- Rotas em português: `/produto/[slug]`, `/categoria/[slug]`, `/loja/[slug]`, `/busca`, `/carrinho`, `/checkout`,
  `/pagamento/[paymentId]`, `/pedido/confirmado`, `/conta/*`, `/entrar`, `/cadastrar`, `/recuperar-senha`,
  `/favoritos`, `/instalar`, `/offline`, `/vendedor/*`, `/admin/*`.
- Chaves de tradução `camelCase` agrupadas por namespace.
- Query keys: `queryKeys.<dominio>.<recurso>(params)`.

## Padrões de UI

- **Base UI (shadcn v4)**: sem `asChild`. Composição por `render`:
  ```tsx
  <Button variant="cta" render={<Link href="/carrinho" />}>Ver carrinho</Button>
  <Sheet open={open} onOpenChange={setOpen}><SheetContent side="bottom">…</SheetContent></Sheet>
  ```
- Ícones `lucide-react`; em botões, `data-icon="inline-start|inline-end"` ajusta o padding.
- Estados: `Skeleton` durante `isPending`; `ErrorState` com `onRetry={refetch}`; `EmptyState` com CTA.
- Toasts com `sonner` (`toast.success(...)`, ação "Desfazer").
- Formulários: `react-hook-form` + `zodResolver(schema)`; erros exibidos com `aria-invalid` e `aria-describedby`;
  mensagens do Zod são chaves do namespace `validation`.
- Dinheiro: `Money` + `formatMoney`/`PriceTag`; nunca `toFixed` em float; parcelas com `splitInstallments`.
- Datas: `useFormatter().dateTime(new Date(iso), "short" | "long" | "dateTime")`.
- Imagens: `next/image` com `fill` + `sizes` em cards; `priority` só acima da dobra.
- Cliente/servidor: não passe funções (ícones lucide, callbacks) de Server Component para Client Component —
  marque o componente como `"use client"` ou passe uma string/`iconKey`.

## Git

Commits pequenos, mensagens no imperativo (pt-BR ou en). Artefatos gerados (`public/sw.js`, `.next`, `*.tsbuildinfo`)
estão no `.gitignore`.
