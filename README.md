# Marketplace de Produtos Paraguaios — frontend PWA

Marketplace mobile-first que conecta vendedores no Paraguai a compradores no Brasil (modelo Mercado Livre).
Esta é a **primeira versão do frontend**, navegável ponta a ponta com dados mockados (MSW), pronta para receber a
API ASP.NET Core sem alterar componentes.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind CSS 4 · shadcn/ui (Base UI) ·
TanStack Query 5 · Zustand 5 (persist) · MSW 2 · React Hook Form + Zod 4 · next-intl 4 (pt-BR / es-PY) ·
Serwist 9 (PWA) · lucide-react · pnpm workspaces.

## Como rodar

Pré-requisitos: Node ≥ 20 (testado com 24) e pnpm 12 (`npm i -g pnpm` ou `corepack enable pnpm`).

```bash
pnpm install                      # na raiz (monorepo)
cp apps/web/.env.example apps/web/.env.local   # já vem com mock ativado
pnpm dev                          # http://localhost:3210
```

Outros comandos (raiz ou `apps/web`):

| Comando | Descrição |
| --- | --- |
| `pnpm build` / `pnpm start` | build de produção (gera `public/sw.js` com precache) e servidor em `:3210` |
| `pnpm typecheck` | `tsc --noEmit` em todos os pacotes |
| `pnpm lint` / `pnpm --filter web lint:fix` | ESLint |
| `pnpm format` | Prettier |
| `pnpm --filter web images` | regenera os SVGs placeholder de produtos/categorias/banners/lojas |
| `pnpm --filter web icons` | regenera ícones do manifest a partir de `public/logo.svg` |
| `pnpm --filter web sw` | reconstrói o service worker |

> A porta padrão é **3210** (3000 estava em uso na máquina de desenvolvimento). Altere em `apps/web/package.json`
> e em `NEXT_PUBLIC_SITE_URL`.

### Usuário de demonstração

`demo@mktpy.com` / `123456` (CPF 529.982.247-25, dois endereços cadastrados, 11 pedidos em todos os status).
Cupom `PARAGUAI10`. Cartão com final `0000` é recusado. Pix/boleto são aprovados após ~20 s ou pelo botão
"Simular pagamento".

## Variáveis de ambiente (`apps/web/.env.local`)

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `/api` | base da API REST (.NET). Relativa em dev; absoluta em produção |
| `NEXT_PUBLIC_API_MOCKING` | `true` | `true` ativa o MSW no navegador e no Node |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3210` | URL pública (metadata, sitemap, robots, fetch no servidor) |
| `NEXT_PUBLIC_MOCK_ERROR_RATE` | `0.03` | taxa de erro aleatório nas listagens mock |
| `NEXT_PUBLIC_SW_DEV` | — | `true` registra o service worker também em desenvolvimento |

## Estrutura

```
apps/web            Next.js (src/app, features, lib, mocks, components, i18n)  → docs/ARCHITECTURE.md
apps/api            reservado ao ASP.NET Core Web API + PostgreSQL
packages/contracts  DTOs TypeScript que espelham a API REST (@marketplace/contracts)
docs/               documentação técnica (abaixo)
```

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [apps/web/API_CONTRACTS.md](apps/web/API_CONTRACTS.md) | **especificação dos endpoints** (método, rota, request, response), incluindo frete, rastreio, pagamento com split, repasses e webhooks |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | camadas, pastas, regras da camada de API, decisões |
| [docs/FEATURES.md](docs/FEATURES.md) | o que está pronto, o que é mock, rotas e componentes por feature |
| [docs/DATA_MODELS.md](docs/DATA_MODELS.md) | DTOs, ciclo de vida do pedido, dinheiro/câmbio, mapeamento para PostgreSQL |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | tokens de cor (escalas 50–900), contraste, componentes, layout mobile |
| [docs/STATE_AND_DATA.md](docs/STATE_AND_DATA.md) | React Query, Zustand, câmbio travado, offline |
| [docs/MOCKS.md](docs/MOCKS.md) | MSW, fixtures, gatilhos de erro, como adicionar endpoints |
| [docs/PWA.md](docs/PWA.md) | manifest, service worker (Serwist + Turbopack), estratégias de cache, instalação |
| [docs/I18N.md](docs/I18N.md) | next-intl, namespaces, sintaxe ICU |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | lint/format, padrões de código, Base UI vs Radix |
| [docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md) | passo a passo para plugar o .NET (auth, pagamentos, R2, CDN) |

## Decisões de arquitetura (resumo)

- **Componentes nunca chamam `fetch`**: hooks em `features/*/api` → `lib/api/http.ts` → MSW ou API real. Regra de lint.
- **Dinheiro em inteiros** (`Money { amount, currency }`) e câmbio como fração exata; formatação via `Intl`.
- **Carrinho agrupado por vendedor**, persistido offline; uma compra gera um pedido por loja e um pagamento.
- **Câmbio travado** no checkout (15 min) e gravado no pedido; impostos de importação sempre exibidos como estimativa.
- **Serwist via CLI** (Turbopack não suporta o plugin webpack); SW desligado em dev por padrão.
- **Rotas em português sem prefixo** (`/produto/[slug]`), espanhol em `/es-PY/...`.
- **shadcn/ui v4 sobre Base UI** (sem `asChild`; use `render`).
