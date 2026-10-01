# apps/web — PWA Next.js

Frontend do Marketplace Paraguai (Next.js 16 App Router, React 19, Tailwind CSS 4, shadcn/ui sobre Base UI,
TanStack Query, Zustand, MSW, next-intl, Serwist).

A documentação vive na raiz do monorepo:

- [`../../README.md`](../../README.md) — como rodar, variáveis de ambiente, deploy.
- [`../../DESIGN.md`](../../DESIGN.md) — design system (fonte de verdade visual); styleguide vivo em `/design`.
- [`../../docs/`](../../docs) — arquitetura, convenções, estado e dados, mocks, PWA, i18n, integração com o backend.
- [`../../docs/CONTRACTS.md`](../../docs/CONTRACTS.md) — contrato REST consumido pelo front (DTOs em `packages/contracts`).

```bash
pnpm install          # na raiz
pnpm dev              # http://localhost:3210 (mock MSW ativado por .env.local)
pnpm typecheck && pnpm lint && pnpm build
```
