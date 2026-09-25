# apps/api — ASP.NET Core Web API (futuro)

Este diretório está reservado para o backend em **ASP.NET Core Web API + PostgreSQL**.

A especificação dos endpoints que o frontend já consome (e dos que ele espera no futuro)
está em [`../web/API_CONTRACTS.md`](../web/API_CONTRACTS.md). Os DTOs TypeScript que
espelham os contratos ficam em [`../../packages/contracts`](../../packages/contracts).

Sugestão de estrutura quando o backend for criado:

```
apps/api/
  src/Marketplace.Api/          → controllers/minimal APIs, DI, middlewares
  src/Marketplace.Application/  → casos de uso, DTOs, validações (FluentValidation)
  src/Marketplace.Domain/       → entidades, enums (OrderStatus), value objects (Money)
  src/Marketplace.Infrastructure/ → EF Core + Npgsql, R2 storage, gateways de pagamento
  tests/
```
