import { ApiError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { onlyDigits } from "@/lib/validation/documents";

/**
 * Tokenização de cartão no navegador: o PAN nunca chega à nossa API. No mock devolve um token fixo;
 * fora dele usa o SDK v2 do Mercado Pago (carregado sob demanda) com a public key pública. Sem a chave,
 * o cartão fica indisponível (erro 422 `CARD_UNAVAILABLE`) e o checkout mantém Pix e boleto.
 */

const MP_SDK_SRC = "https://sdk.mercadopago.com/js/v2";

/** Bandeiras com detecção local pelo BIN (tabela em features/checkout/components/card-utils.ts). */
export type KnownCardPaymentMethodId = "visa" | "master" | "amex" | "elo" | "hipercard";

/** `payment_method_id` do Mercado Pago: uma das conhecidas acima ou outra devolvida pelo SDK (diners, jcb, cabal…). */
export type CardPaymentMethodId = string;

export interface CardTokenInput {
  /** Número do cartão (com ou sem espaços). */
  number: string;
  holderName: string;
  /** "MM/AA". */
  expiry: string;
  cvv: string;
  /** CPF do titular, somente dígitos. */
  payerDocument: string;
  /** Bandeira detectada localmente; `null` deixa o SDK do gateway identificar pelo BIN. */
  paymentMethodId: CardPaymentMethodId | null;
}

export interface CardToken {
  token: string;
  paymentMethodId: CardPaymentMethodId;
}

interface MercadoPagoInstance {
  getPaymentMethods?: (options: { bin: string }) => Promise<{ results?: Array<{ id: string }> }>;
  createCardToken: (card: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }) => Promise<{ id: string }>;
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
  }
}

/** Cartão disponível neste ambiente? (mock, ou public key do Mercado Pago configurada). */
export const CARD_PAYMENT_ENABLED = env.apiMocking || Boolean(env.mercadoPagoPublicKey);

export const CARD_UNAVAILABLE_CODE = "CARD_UNAVAILABLE";

export function cardUnavailableError(): ApiError {
  return new ApiError({
    status: 422,
    code: CARD_UNAVAILABLE_CODE,
    message: "Pagamento com cartão indisponível neste ambiente.",
    errors: { card: ["Pagamento com cartão indisponível neste ambiente."] },
  });
}

export function isCardUnavailableError(error: unknown): boolean {
  return error instanceof ApiError && error.code === CARD_UNAVAILABLE_CODE;
}

/** Bandeira não reconhecida nem pela tabela local nem pelo gateway. A mensagem é uma chave de `validation`. */
export function unknownBrandError(): ApiError {
  return new ApiError({
    status: 422,
    code: "CARD_BRAND_UNKNOWN",
    message: "invalidCard",
    errors: { card: ["invalidCard"] },
  });
}

/** Pede ao gateway o `payment_method_id` pelo BIN (6 primeiros dígitos). `null` quando ele também não reconhece. */
async function detectWithGateway(mp: MercadoPagoInstance, number: string): Promise<string | null> {
  if (!mp.getPaymentMethods || number.length < 6) return null;
  try {
    const response = await mp.getPaymentMethods({ bin: number.slice(0, 6) });
    return response.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

let sdkLoading: Promise<MercadoPagoInstance> | null = null;

function loadMercadoPago(publicKey: string): Promise<MercadoPagoInstance> {
  if (typeof window === "undefined") return Promise.reject(cardUnavailableError());
  if (!sdkLoading) {
    sdkLoading = new Promise<MercadoPagoInstance>((resolve, reject) => {
      const instantiate = () => {
        const Ctor = window.MercadoPago;
        if (!Ctor) {
          sdkLoading = null;
          reject(cardUnavailableError());
          return;
        }
        resolve(new Ctor(publicKey, { locale: "pt-BR" }));
      };
      if (window.MercadoPago) {
        instantiate();
        return;
      }
      const script = document.createElement("script");
      script.src = MP_SDK_SRC;
      script.async = true;
      script.onload = instantiate;
      script.onerror = () => {
        sdkLoading = null;
        script.remove();
        reject(cardUnavailableError());
      };
      document.head.appendChild(script);
    });
  }
  return sdkLoading;
}

export async function tokenizeCard(input: CardTokenInput): Promise<CardToken> {
  if (env.apiMocking) {
    if (!input.paymentMethodId) throw unknownBrandError();
    return { token: "tok_mock", paymentMethodId: input.paymentMethodId };
  }
  if (!env.mercadoPagoPublicKey) throw cardUnavailableError();

  const mp = await loadMercadoPago(env.mercadoPagoPublicKey);
  const number = onlyDigits(input.number);
  // Diners, JCB, Cabal…: fora da tabela local, mas aceitas pelo gateway — ele identifica pelo BIN.
  const paymentMethodId = input.paymentMethodId ?? (await detectWithGateway(mp, number));
  if (!paymentMethodId) throw unknownBrandError();

  const [month, year] = input.expiry.split("/");
  let result: { id: string };
  try {
    result = await mp.createCardToken({
      cardNumber: number,
      cardholderName: input.holderName.trim(),
      cardExpirationMonth: month ?? "",
      cardExpirationYear: year && year.length === 2 ? `20${year}` : (year ?? ""),
      securityCode: onlyDigits(input.cvv),
      identificationType: "CPF",
      identificationNumber: onlyDigits(input.payerDocument),
    });
  } catch {
    throw new ApiError({
      status: 422,
      code: "CARD_TOKEN_FAILED",
      message: "Não foi possível validar o cartão. Confira os dados e tente de novo.",
      errors: { card: ["Não foi possível validar o cartão."] },
    });
  }
  if (!result?.id) throw cardUnavailableError();
  return { token: result.id, paymentMethodId };
}
