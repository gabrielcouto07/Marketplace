import type {
  PostalCodeLookupDto,
  ShippingOptionDto,
  ShippingQuoteItem,
} from "@marketplace/contracts";

import { guid } from "./base";

/** Região aproximada pelo primeiro dígito do CEP (mock). */
interface Region {
  state: string;
  city: string;
  /** Acréscimo em centavos e em dias úteis sobre a base. */
  surcharge: number;
  extraDays: number;
}

const REGIONS: Record<string, Region> = {
  "0": { state: "SP", city: "São Paulo", surcharge: 0, extraDays: 0 },
  "1": { state: "SP", city: "Campinas", surcharge: 300, extraDays: 1 },
  "2": { state: "RJ", city: "Rio de Janeiro", surcharge: 600, extraDays: 1 },
  "3": { state: "MG", city: "Belo Horizonte", surcharge: 700, extraDays: 1 },
  "4": { state: "BA", city: "Salvador", surcharge: 1500, extraDays: 3 },
  "5": { state: "PE", city: "Recife", surcharge: 1800, extraDays: 4 },
  "6": { state: "CE", city: "Fortaleza", surcharge: 2000, extraDays: 5 },
  "7": { state: "DF", city: "Brasília", surcharge: 1100, extraDays: 2 },
  "8": { state: "PR", city: "Curitiba", surcharge: -400, extraDays: -2 },
  "9": { state: "RS", city: "Porto Alegre", surcharge: 200, extraDays: 0 },
};

const STREETS = [
  "Rua das Palmeiras",
  "Avenida Brasil",
  "Rua Sete de Setembro",
  "Alameda dos Ipês",
  "Rua Paraguai",
];
const NEIGHBORHOODS = ["Centro", "Jardim América", "Vila Nova", "Boa Vista", "Santa Cecília"];

export function lookupPostalCode(cep: string): PostalCodeLookupDto | null {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  if (digits === "00000000") return null; // CEP inexistente (para testar erro 404)
  const region = REGIONS[digits[0]];
  const n = Number(digits.slice(1, 5));
  return {
    postalCode: digits,
    street: STREETS[n % STREETS.length],
    neighborhood: NEIGHBORHOODS[n % NEIGHBORHOODS.length],
    city: region.city,
    state: region.state,
  };
}

/** Cotação de frete por vendedor: economia (correio internacional) e expresso (courier). */
export function quoteShipping(
  cep: string,
  sellerId: string,
  items: ShippingQuoteItem[],
  freeShippingEligible: boolean,
): ShippingOptionDto[] {
  const digits = cep.replace(/\D/g, "");
  const region = REGIONS[digits[0]] ?? REGIONS["0"];
  const units = Math.max(
    1,
    items.reduce((a, i) => a + i.quantity, 0),
  );
  const weightFactor = 1 + (units - 1) * 0.35;

  const economy = Math.round((2490 + region.surcharge) * weightFactor);
  const express = Math.round((5990 + region.surcharge * 1.5) * weightFactor);

  const options: ShippingOptionDto[] = [
    {
      id: guid(`ship:${sellerId}:${digits[0]}:economy`),
      carrier: "Correo Paraguayo + Correios",
      service: "Internacional Econômico",
      price: { amount: freeShippingEligible ? 0 : economy, currency: "BRL" },
      estimatedDays: { min: 12 + region.extraDays, max: 25 + region.extraDays },
      description: freeShippingEligible
        ? "Frete grátis acima de R$ 300 nesta loja"
        : "Rastreio ponta a ponta",
    },
    {
      id: guid(`ship:${sellerId}:${digits[0]}:express`),
      carrier: "Courier Internacional",
      service: "Expresso",
      price: { amount: express, currency: "BRL" },
      estimatedDays: {
        min: 5 + Math.max(0, region.extraDays),
        max: 10 + Math.max(0, region.extraDays),
      },
      description: "Desembaraço prioritário",
    },
  ];
  return options;
}
