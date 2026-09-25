import type { AddressDto, OrderDto, PaymentDto, QuestionDto, UserProfileDto } from "@marketplace/contracts";

import { DEMO_ADDRESSES, DEMO_USER } from "./fixtures/account";
import { SEED_DATA } from "./fixtures/orders";

/**
 * "Banco de dados" do mock. Vive em memória e, no navegador, é espelhado em
 * localStorage para que pedidos criados sobrevivam a um refresh.
 * NUNCA importar isto fora de src/mocks.
 */
interface MockDb {
  user: UserProfileDto;
  addresses: AddressDto[];
  orders: OrderDto[];
  payments: PaymentDto[];
  questions: QuestionDto[];
  /** Tokens de sessão válidos emitidos pelo mock. */
  tokens: string[];
}

const STORAGE_KEY = "mktpy.mockdb.v1";

function defaults(): MockDb {
  return {
    user: structuredClone(DEMO_USER),
    addresses: structuredClone(DEMO_ADDRESSES),
    orders: structuredClone(SEED_DATA.orders),
    payments: structuredClone(SEED_DATA.payments),
    questions: [],
    tokens: [],
  };
}

function load(): MockDb {
  if (typeof window === "undefined") return defaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<MockDb>;
    const base = defaults();
    // Mantém os pedidos seed e acrescenta os criados pelo usuário.
    const seedIds = new Set(base.orders.map((o) => o.id));
    const userOrders = (parsed.orders ?? []).filter((o) => !seedIds.has(o.id));
    const seedPayIds = new Set(base.payments.map((p) => p.id));
    const userPayments = (parsed.payments ?? []).filter((p) => !seedPayIds.has(p.id));
    return {
      user: parsed.user ?? base.user,
      addresses: parsed.addresses ?? base.addresses,
      orders: [...userOrders, ...base.orders],
      payments: [...userPayments, ...base.payments],
      questions: parsed.questions ?? [],
      tokens: parsed.tokens ?? [],
    };
  } catch {
    return defaults();
  }
}

export const db: MockDb = load();

export function persistDb(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // quota / modo privado — ignora
  }
}

export function resetDb(): void {
  Object.assign(db, defaults());
  persistDb();
}
