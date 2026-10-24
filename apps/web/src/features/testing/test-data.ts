import type {
  AddressFormValues,
  ProductFormValues,
  RegisterFormValues,
  StoreFormValues,
} from "@/lib/validation/schemas";

/**
 * Dados de teste dos formulários (modo de testes). Valores válidos para a validação do site e para a homologação dos
 * Correios: o CPF é o do exemplo do guia da API Packet, porque a homologação só aceita CPFs da base dela (um CPF com
 * dígito válido, mas inventado, volta "SUA-121: CPF number is invalid").
 */
export const TEST_CPF = "33908597803";
export const TEST_PASSWORD = "Teste@1234";

const TEST_PHONE_BR = "11987654321";

/** Sufixo curto e único por clique (e-mail, nome da loja e do produto não colidem entre testes). */
function suffix(): string {
  return Date.now().toString(36).slice(-6);
}

/** example.com é reservado (RFC 2606): nenhum e-mail de teste chega a alguém de verdade. */
function testEmail(kind: string): string {
  return `teste.${kind}.${suffix()}@example.com`;
}

function randomDigits(length: number): string {
  let out = String(1 + Math.floor(Math.random() * 9));
  while (out.length < length) out += String(Math.floor(Math.random() * 10));
  return out;
}

/** RUC paraguaio válido: 7 dígitos + dígito verificador (módulo 11, o mesmo de `isValidRuc`). */
export function randomRuc(): string {
  const base = randomDigits(7);
  let k = 2;
  let total = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    if (k > 11) k = 2;
    total += Number(base[i]) * k;
    k++;
  }
  const rest = total % 11;
  return `${base}-${rest > 1 ? 11 - rest : 0}`;
}

export function testRegister(): RegisterFormValues {
  return {
    fullName: "Comprador Teste da Silva",
    email: testEmail("comprador"),
    phone: TEST_PHONE_BR,
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
    acceptTerms: true,
  };
}

export function testAddress(): AddressFormValues {
  return {
    label: "Casa (teste)",
    recipientName: "Gabriel Teste da Silva",
    postalCode: "01310100",
    street: "Avenida Paulista",
    number: "1578",
    complement: "Apto 42",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    state: "SP",
    phone: TEST_PHONE_BR,
    recipientCpf: TEST_CPF,
    isDefault: true,
  };
}

/** Loja verificável: documentos de exemplo do site (os mesmos da demonstração) e remetente em Ciudad del Este. */
export function testStore(options: { categoryIds: string[]; cities: string[] }): StoreFormValues {
  const id = suffix();
  const legalName = `Loja Teste ${id} S.A.`;
  return {
    name: `Loja Teste ${id}`,
    ruc: randomRuc(),
    city: options.cities.includes("Ciudad del Este") ? "Ciudad del Este" : (options.cities[0] ?? "Ciudad del Este"),
    description: "Loja de testes do Mania Paraguai: eletrônicos e acessórios enviados de Ciudad del Este.",
    logoUrl: null,
    bannerUrl: null,
    exchangePolicy: "Troca em até 7 dias após o recebimento, com a embalagem original.",
    categoryIds: options.categoryIds,
    originPostalCode: "7000",
    phone: "+595 61 512 300",
    legalName,
    email: testEmail("loja"),
    legalAddress: "Av. San Blas 455, Km 4, Ciudad del Este",
    payoutMethod: "ContaBancaria",
    payoutInstitution: "Banco Itaú Paraguay",
    payoutAccount: "0012345678",
    payoutOnFile: false,
    payoutHolder: legalName,
    responsibleName: "Responsável Teste da Silva",
    responsibleDocumentType: "CedulaPy",
    responsibleDocument: randomDigits(7),
    documentOnFile: false,
    identityDocumentUrl: "/images/kyc/documento-responsavel.svg",
    rucCertificateUrl: "/images/kyc/constancia-ruc.svg",
    taxComplianceCertificateUrl: "/images/kyc/certificado-cumplimiento.svg",
    articlesOfIncorporationUrl: "/images/kyc/atos-constitutivos.svg",
  };
}

/**
 * Produto pronto para publicar e enviar pelos Correios: NCM 8518.30.00 (fone de ouvido) na categoria Eletrônicos,
 * sem marca (não cai na análise de marca protegida), medidas acima do mínimo do pacote (16 × 11 × 2 cm) e preço
 * abaixo de US$ 50.
 */
export function testProduct(options: { categoryId: string }): ProductFormValues {
  return {
    name: `Fone de ouvido Bluetooth TWS (teste ${suffix()})`,
    description:
      "Fone de ouvido sem fio Bluetooth 5.3 com estojo de recarga, até 24 h de bateria e microfone embutido. Produto de teste.",
    categoryId: options.categoryId,
    priceAmount: 19990,
    compareAtAmount: null,
    stock: 50,
    freeShipping: false,
    warrantyMonths: 3,
    handlingDaysMin: 1,
    handlingDaysMax: 3,
    weightGrams: 250,
    lengthCm: 16,
    widthCm: 11,
    heightCm: 6,
    attributes: [{ name: "Conexão", value: "Bluetooth 5.3" }],
    images: [{ url: "/images/products/eletronicos-1-1.webp", alt: "Fone de ouvido Bluetooth (teste)" }],
    status: "Ativo",
    hsCode: "85183000",
    nature: "Fone de ouvido Bluetooth",
    brand: "",
    unbranded: true,
    model: "TWS-53",
    material: "Plástico ABS e componentes eletrônicos",
    packageQuantity: 1,
    originCountry: "CN",
  };
}
