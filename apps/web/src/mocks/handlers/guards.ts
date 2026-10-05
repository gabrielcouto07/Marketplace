import type { SellerDto, UserProfileDto } from "@marketplace/contracts";

import { findSellerBySlug } from "../catalog-state";
import { db } from "../db";
import { isAuthorized, nowIso, problem, unauthorized } from "./utils";

/** Guardas e auditoria compartilhados pelos handlers do vendedor, do admin e do Remessa Conforme. */

export const isResponse = (value: unknown): value is Response => value instanceof Response;

export function requireAdmin(request: Request): UserProfileDto | Response {
  if (!isAuthorized(request)) return unauthorized();
  if (!db.user.roles.includes("Admin"))
    return problem(403, "FORBIDDEN", "Acesso restrito a administradores.");
  return db.user;
}

export function currentSeller(): SellerDto | null {
  const slug = db.sellerByUser[db.user.id];
  return slug ? (findSellerBySlug(slug) ?? null) : null;
}

/** Sessão válida e loja associada; senão 401/403. */
export function requireSeller(request: Request): SellerDto | Response {
  if (!isAuthorized(request)) return unauthorized();
  return (
    currentSeller() ??
    problem(403, "SELLER_REQUIRED", "Cadastre sua loja para acessar o painel do vendedor.")
  );
}

export function audit(action: string, target: string | null): void {
  db.audit.push({
    id: (db.audit.at(-1)?.id ?? 0) + 1,
    userId: db.user.id,
    userEmail: db.user.email,
    action,
    target,
    occurredAt: nowIso(),
    ipAddress: "200.150.10.21",
  });
}
