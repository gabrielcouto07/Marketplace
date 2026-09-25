import { authHandlers } from "./auth";
import { catalogHandlers } from "./catalog";
import { checkoutHandlers } from "./checkout";
import { orderHandlers } from "./orders";
import { sellerHandlers } from "./sellers";
import { shippingHandlers } from "./shipping";

/**
 * Ordem importa: rotas mais específicas (ex.: /products/suggestions) antes das
 * paramétricas (/products/:slug) dentro de cada módulo.
 */
export const handlers = [
  ...catalogHandlers,
  ...sellerHandlers,
  ...shippingHandlers,
  ...checkoutHandlers,
  ...orderHandlers,
  ...authHandlers,
];
