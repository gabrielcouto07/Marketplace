import type { AddressDto, UserProfileDto } from "@marketplace/contracts";

import { guid, isoDaysAgo } from "./base";

/** Usuário de demonstração: demo@mktpy.com / 123456 */
export const DEMO_CREDENTIALS = { email: "demo@mktpy.com", password: "123456" } as const;

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
  },
];
