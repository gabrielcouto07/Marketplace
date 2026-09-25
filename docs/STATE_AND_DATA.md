# Estado, dados e cache

## Camadas

| Tipo de estado | Ferramenta | Persistência | Exemplos |
| --- | --- | --- | --- |
| Servidor (remoto) | TanStack Query v5 | memória (`gcTime` 24 h) + SW cache HTTP | catálogo, pedidos, cotações |
| Cliente (local) | Zustand v5 + `persist` | `localStorage` | carrinho, favoritos, sessão |
| URL | `searchParams` | link compartilhável | filtros/ordenação da busca |
| Mock DB | módulo + `localStorage` | só com MSW | pedidos criados na demo |

## TanStack Query — `lib/api/query-client.tsx`

```ts
staleTime: 60 s · gcTime: 24 h · refetchOnWindowFocus: false
retry: 4xx → nunca; outros → até 2 tentativas com backoff (1 s, 2 s, máx. 4 s)
```
- `QueryProvider` cria um client por navegador (`getQueryClient`) e novo por request no servidor.
- Devtools disponíveis em desenvolvimento (botão no canto superior direito).
- Listas paginadas usam `useInfiniteQuery` (`getNextPageParam` a partir de `page*pageSize < totalCount`);
  buscas usam `placeholderData: keepPreviousData` para não piscar ao trocar filtros.
- Polling: `usePayment` refaz a cada 5 s enquanto `status === "Pendente"`.
- Invalidação: mutações invalidam pelas chaves de `lib/api/query-keys.ts` (ex.: perguntar invalida
  `products/{id}/questions`; criar pedido invalida `["orders"]`).

## Zustand — stores

| Store | Chave localStorage | Conteúdo |
| --- | --- | --- |
| `features/cart/store.ts` | `mktpy.cart.v1` | `lines: CartLine[]` (snapshot do produto + variante + qty + loja), `lastUpdatedAt` |
| `features/catalog/favorites-store.ts` | `mktpy.favorites.v1` | `items: { productId, createdAt, snapshot }` |
| `features/auth/store.ts` | `mktpy.session.v1` | `user`, `accessToken`, `refreshToken`, `expiresAt` |

Seletores derivados (puros): `selectItemCount`, `selectSubtotal`, `groupBySeller`. Hidratação: renderizar conteúdo
dependente da store só após `useXxxStore.persist.hasHydrated()` (ou flag `mounted`) para evitar mismatch SSR.
O token é injetado no `http()` via `setAccessTokenProvider` (sem acoplar `lib/api` à store).

Versionamento: ao mudar o formato, incremente o sufixo `.v1` → `.v2` (ou use `migrate` do `persist`).

## Câmbio e totais

1. A **página de produto** exibe `referencePrice` (PYG) já calculado pela API e a cotação vigente (`/exchange-rates`).
2. O **carrinho** mostra total de referência convertendo com a taxa atual (`convert`), informativo.
3. O **checkout** recebe `CheckoutQuoteDto.exchangeRate` + `lockedUntil`: a taxa fica **travada** por 15 min e o
   `exchangeRateId` vai no pedido; a UI mostra "Câmbio travado: R$ 1,00 = ₲ 1.389 · válido até HH:MM" e bloqueia a
   confirmação quando expira até o usuário atualizar a cotação.
4. O **pedido** guarda a taxa usada (`OrderDto.exchangeRate`) para exibição posterior.

## Impostos de importação

`estimatedImportTax = round((subtotal + frete − desconto) × 6000 / 10000)` (60%, parametrizável no backend). Sempre
rotulado como **estimado** na UI (checkout, confirmação e detalhe do pedido).

## Offline

- Leituras de catálogo vêm do cache do React Query e do SW (`StaleWhileRevalidate`).
- Escritas (adicionar ao carrinho, favoritar) são locais e imediatas.
- Mutações remotas (login, pedido) falham com `NetworkError` → `ErrorState` offline; não há fila de sincronização
  nesta versão (futuro: Background Sync para `PUT /me/cart`).
