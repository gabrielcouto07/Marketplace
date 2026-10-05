import type { AddressDto, UserProfileDto } from "@marketplace/contracts";

import { guid, isoDaysAgo } from "./base";

/** Senha única das contas de demonstração. */
export const DEMO_PASSWORD = "123456";

/** Comprador de demonstração: demo@mktpy.com / 123456 */
export const DEMO_CREDENTIALS = { email: "demo@mktpy.com", password: DEMO_PASSWORD } as const;

export const DEMO_USER: UserProfileDto = {
  id: guid("user:demo"),
  fullName: "Gabriel Demo",
  email: DEMO_CREDENTIALS.email,
  phone: "11987654321",
  cpf: "52998224725",
  avatarUrl: null,
  roles: ["Comprador"],
  createdAt: isoDaysAgo(320),
};

/** Dona da loja TecnoCentro CDE: entra no painel do vendedor (/vendedor). loja@mktpy.com / 123456 */
export const SELLER_USER: UserProfileDto = {
  id: guid("user:seller"),
  fullName: "Mariana Ríos",
  email: "loja@mktpy.com",
  phone: "595981234567",
  cpf: null,
  avatarUrl: null,
  roles: ["Comprador", "Vendedor"],
  createdAt: isoDaysAgo(1460),
};

/** Operação da plataforma: entra no painel administrativo (/admin). admin@mktpy.com / 123456 */
export const ADMIN_USER: UserProfileDto = {
  id: guid("user:admin"),
  fullName: "Ana Admin",
  email: "admin@mktpy.com",
  phone: "11912345678",
  cpf: null,
  avatarUrl: null,
  roles: ["Comprador", "Admin"],
  createdAt: isoDaysAgo(700),
};

export interface DemoAccount {
  user: UserProfileDto;
  /** Loja associada (papel Vendedor). */
  sellerSlug: string | null;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { user: DEMO_USER, sellerSlug: null },
  { user: SELLER_USER, sellerSlug: "tecnocentro-cde" },
  { user: ADMIN_USER, sellerSlug: null },
];

export const DEMO_ADDRESSES: AddressDto[] = [
  {
    id: guid("address:demo:1"),
    label: "Casa",
    recipientName: "Gabriel Demo",
    postalCode: "01310100",
    street: "Avenida Paulista",
    number: "1578",
    complement: "Apto 42",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    country: "BR",
    phone: "11987654321",
    isDefault: true,
    recipientCpf: "52998224725",
  },
  {
    id: guid("address:demo:2"),
    label: "Trabalho",
    recipientName: "Gabriel Demo",
    postalCode: "80010010",
    street: "Rua XV de Novembro",
    number: "120",
    complement: null,
    neighborhood: "Centro",
    city: "Curitiba",
    state: "PR",
    country: "BR",
    phone: null,
    isDefault: false,
    recipientCpf: "39053344705",
  },
];
