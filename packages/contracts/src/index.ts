/**
 * @marketplace/contracts
 *
 * DTOs TypeScript que espelham a futura API REST em ASP.NET Core.
 * Convenções (ver docs/CONTRACTS.md):
 *  - camelCase em todas as propriedades (System.Text.Json default policy)
 *  - IDs como string (GUID)
 *  - datas em ISO 8601 UTC (string)
 *  - dinheiro SEMPRE em unidades mínimas inteiras + código da moeda (Money)
 *  - paginação { items, page, pageSize, totalCount }
 *  - enums serializados como string (JsonStringEnumConverter)
 */

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

export type CurrencyCode = "BRL" | "PYG" | "USD";

/** Valor monetário em unidades mínimas (centavos para BRL/USD; guaranis inteiros para PYG). */
export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface PagedQuery {
  page?: number;
  pageSize?: number;
}

/** Corpo padrão de erro (ProblemDetails simplificado). */
export interface ApiErrorDto {
  code: string;
  message: string;
  status: number;
  /** Erros de validação por campo. */
  errors?: Record<string, string[]>;
  traceId?: string;
}

export interface DayRange {
  min: number;
  max: number;
}

export interface DateRange {
  min: string;
  max: string;
}

// ---------------------------------------------------------------------------
// Câmbio
// ---------------------------------------------------------------------------

/**
 * Taxa de câmbio como fração exata para evitar ponto flutuante:
 *   toMinor = round(fromMinor * numerator / denominator)
 * Ex.: 1 guarani (PYG, sem centavos) → BRL centavos: 72/1000 → 0,072 centavo por guarani.
 */
export interface ExchangeRateDto {
  id: string;
  from: CurrencyCode;
  to: CurrencyCode;
  numerator: number;
  denominator: number;
  /** Texto pronto para exibição, ex.: "R$ 1,00 = ₲ 1.389". */
  displayRate: string;
  quotedAt: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  /** Chave de ícone (lucide) usada pelo front. */
  iconKey: string;
  imageUrl: string | null;
  parentId: string | null;
  productCount: number;
}

export interface ProductImageDto {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
}

export interface ProductVariantOptionDto {
  /** Nome da opção, ex.: "Cor", "Tamanho", "Armazenamento". */
  name: string;
  values: string[];
}

export interface ProductVariantDto {
  id: string;
  sku: string;
  /** Ex.: { "Cor": "Preto", "Armazenamento": "256 GB" } */
  attributes: Record<string, string>;
  price: Money;
  compareAtPrice: Money | null;
  stock: number;
  imageId: string | null;
}

export interface ProductAttributeDto {
  name: string;
  value: string;
}

export interface SellerSummaryDto {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  /** 1 (vermelho) a 5 (verde escuro) — termômetro de reputação. */
  reputationLevel: 1 | 2 | 3 | 4 | 5;
  isOfficialStore: boolean;
  city: string;
}

export interface ProductSummaryDto {
  id: string;
  slug: string;
  name: string;
  thumbnailUrl: string;
  price: Money;
  compareAtPrice: Money | null;
  /** Preço de referência na moeda de origem (PYG). */
  referencePrice: Money;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  soldCount: number;
  stock: number;
  freeShipping: boolean;
  isNew: boolean;
  isOffer: boolean;
  categoryId: string;
  seller: SellerSummaryDto;
  createdAt: string;
}

export interface ProductDetailDto extends ProductSummaryDto {
  description: string;
  images: ProductImageDto[];
  variantOptions: ProductVariantOptionDto[];
  variants: ProductVariantDto[];
  attributes: ProductAttributeDto[];
  categoryPath: Array<Pick<CategoryDto, "id" | "slug" | "name">>;
  originCity: string;
  handlingDays: DayRange;
  warrantyMonths: number | null;
  questionCount: number;
  /** País de fabricação (ISO alfa-2), marca e modelo informados para a declaração de importação. */
  originCountry?: string | null;
  brand?: string | null;
  model?: string | null;
}

export type ProductSort =
  "relevance" | "priceAsc" | "priceDesc" | "newest" | "bestSelling" | "rating";

export interface ProductSearchQuery extends PagedQuery {
  q?: string;
  categorySlug?: string;
  sellerSlug?: string;
  /** Em unidades mínimas de BRL. */
  minPrice?: number;
  maxPrice?: number;
  freeShipping?: boolean;
  minRating?: number;
  onlyOffers?: boolean;
  sort?: ProductSort;
}

export interface ProductSearchFacetsDto {
  categories: Array<{ slug: string; name: string; count: number }>;
  sellers: Array<{ slug: string; name: string; count: number }>;
  priceRange: { min: Money; max: Money };
}

export interface ProductSearchResultDto extends PagedResult<ProductSummaryDto> {
  facets: ProductSearchFacetsDto;
}

export interface ReviewDto {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  title: string | null;
  comment: string;
  createdAt: string;
  helpfulCount: number;
  verifiedPurchase: boolean;
}

export interface ReviewSummaryDto {
  average: number;
  total: number;
  /** Índice 0 = 1 estrela ... índice 4 = 5 estrelas. */
  distribution: [number, number, number, number, number];
}

export interface QuestionDto {
  id: string;
  productId: string;
  question: string;
  askedBy: string;
  askedAt: string;
  answer: { text: string; answeredAt: string } | null;
}

export interface AskQuestionRequest {
  question: string;
}

export interface CreateReviewRequest {
  /** 1 a 5. */
  rating: number;
  title?: string | null;
  comment?: string | null;
}

/** Sugestão de busca (autocomplete). */
export interface SearchSuggestionDto {
  slug: string;
  name: string;
  thumbnailUrl: string;
}

export interface BannerDto {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
  /** Cor de fundo (token) para fallback sem imagem. */
  tone: "blue" | "red" | "neutral";
}

export interface HomeDto {
  banners: BannerDto[];
  categories: CategoryDto[];
  offers: ProductSummaryDto[];
  newArrivals: ProductSummaryDto[];
  bestSellers: ProductSummaryDto[];
  featuredSellers: SellerSummaryDto[];
}

// ---------------------------------------------------------------------------
// Vendedor (loja)
// ---------------------------------------------------------------------------

export interface SellerMetricsDto {
  salesCount: number;
  /** 0–100 */
  positiveRatingPercent: number;
  /** 0–100 */
  onTimeShippingPercent: number;
  avgResponseTimeHours: number;
}

export interface SellerDto extends SellerSummaryDto {
  description: string;
  /** RUC paraguaio, ex.: 80012345-6 */
  ruc: string;
  country: "PY";
  memberSince: string;
  rating: number;
  reviewCount: number;
  productCount: number;
  metrics: SellerMetricsDto;
  exchangePolicy: string;
  bannerUrl: string | null;
  categories: Array<Pick<CategoryDto, "id" | "slug" | "name">>;
}

// ---------------------------------------------------------------------------
// Endereço / CEP / Frete
// ---------------------------------------------------------------------------

export interface AddressDto {
  id: string;
  label: string;
  recipientName: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  country: "BR";
  phone: string | null;
  isDefault: boolean;
  /** CPF de quem recebe (somente dígitos). Vai na declaração da remessa; só o dono do endereço vê. */
  recipientCpf: string | null;
}

export type AddressInput = Omit<AddressDto, "id" | "country">;

export interface PostalCodeLookupDto {
  postalCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

/** GET /test-mode — pagamentos fictícios: o site mostra "preencher com dados de teste" e a aprovação simulada. */
export interface TestModeDto {
  enabled: boolean;
}

export interface ShippingQuoteItem {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface ShippingQuoteRequest {
  postalCode: string;
  sellerId: string;
  items: ShippingQuoteItem[];
}

export interface ShippingOptionDto {
  id: string;
  /** Provedor que cotou (ex.: "table" para a tabela interna). */
  provider: string;
  /** Código do serviço no provedor (ex.: "economy", "express"). */
  serviceCode: string;
  carrier: string;
  service: string;
  price: Money;
  /** Faixa de dias úteis. */
  estimatedDays: DayRange;
  description: string | null;
}

export interface ShippingQuoteDto {
  postalCode: string;
  destination: { city: string; state: string };
  sellerId: string;
  options: ShippingOptionDto[];
}

// ---------------------------------------------------------------------------
// Carrinho (persistido no cliente; DTO para futura sincronização)
// ---------------------------------------------------------------------------

export interface CartLineDto {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface CartDto {
  id: string;
  lines: CartLineDto[];
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export type PaymentMethod = "Pix" | "Boleto" | "Cartao";

export interface CheckoutGroupInput {
  sellerId: string;
  items: ShippingQuoteItem[];
  shippingOptionId: string | null;
}

export interface CheckoutQuoteRequest {
  postalCode: string;
  groups: CheckoutGroupInput[];
  couponCode?: string | null;
}

export interface CheckoutLineDto {
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  thumbnailUrl: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface CheckoutGroupDto {
  seller: SellerSummaryDto;
  lines: CheckoutLineDto[];
  subtotal: Money;
  shippingOptions: ShippingOptionDto[];
  selectedShippingOptionId: string | null;
  shipping: Money;
  /** Tributos desta remessa (cada loja envia um pacote, com declaração própria). */
  taxes?: ImportTaxBreakdownDto | null;
  /** Desconto rateado para esta remessa. */
  discount?: Money | null;
}

// ---------------------------------------------------------------------------
// Tributos de importação (Remessa Conforme) — Portaria Coana 130/2023, art. 8º, II
// ---------------------------------------------------------------------------
export type ImportTaxRegime = "RemessaConforme" | "Estimativa";

export interface UsdRateDto {
  numerator: number;
  denominator: number;
  displayRate: string;
  quotedAt: string;
  source: string;
}

/** Tributos discriminados de uma remessa (ou a soma das remessas). RemessaConforme = valor definitivo, cobrado na compra. */
export interface ImportTaxBreakdownDto {
  regime: ImportTaxRegime;
  isFinal: boolean;
  products: Money;
  freight: Money;
  insurance: Money;
  otherExpenses: Money;
  discount: Money;
  /** Produtos + frete + seguro + despesas − desconto (base do II). */
  customsValue: Money;
  customsValueUsd: Money | null;
  importDuty: Money;
  /** Alíquota da faixa (Portaria MF 1.342/2026: 0 até US$ 50 e 6000 acima); −1 = varia entre remessas. */
  importDutyBasisPoints: number;
  importDutyDeduction: Money;
  /** Dedução fixa do II acima de US$ 50, em dólar; null até US$ 50 e em pedidos gravados antes do campo. */
  importDutyDeductionUsd?: Money | null;
  icms: Money;
  icmsBasisPoints: number;
  icmsState: string | null;
  ibs: Money;
  ibsBasisPoints: number;
  ibsState: Money;
  ibsStateBasisPoints: number;
  ibsMunicipal: Money;
  ibsMunicipalBasisPoints: number;
  cbs: Money;
  cbsBasisPoints: number;
  totalTaxes: Money;
  total: Money;
  effectiveBasisPoints: number;
  usdRate: UsdRateDto | null;
  exceedsSimplifiedLimit: boolean;
}

export interface CheckoutQuoteDto {
  quoteId: string;
  /** CEP cotado (somente dígitos). */
  postalCode: string;
  /** Cupom aplicado (normalizado) ou null quando nenhum desconto foi concedido. */
  couponCode: string | null;
  groups: CheckoutGroupDto[];
  subtotal: Money;
  shippingTotal: Money;
  /** Estimativa de impostos de importação (ex.: 60% + ICMS simplificado) — apenas informativa. */
  estimatedImportTax: Money;
  importTaxRateBasisPoints: number;
  discount: Money;
  total: Money;
  /** Total convertido para a moeda de referência (PYG) com a taxa travada. */
  totalReference: Money;
  exchangeRate: ExchangeRateDto;
  /** Câmbio travado até este instante. */
  lockedUntil: string;
  /** Tributos discriminados (soma das remessas). */
  taxes?: ImportTaxBreakdownDto | null;
}

export interface CardPaymentInput {
  /** Token gerado pelo SDK do gateway (nunca o PAN). */
  token: string;
  holderName: string;
  brand: string;
  last4: string;
  installments: number;
}

export interface PlaceOrderRequest {
  quoteId: string;
  addressId: string;
  groups: CheckoutGroupInput[];
  payment: {
    method: PaymentMethod;
    card?: CardPaymentInput;
    /** CPF do pagador (obrigatório para Pix/boleto). */
    payerDocument: string;
  };
  exchangeRateId: string;
  /** Chave de idempotência gerada pelo cliente (UUID). */
  idempotencyKey: string;
}

export interface PlaceOrderResponseDto {
  purchaseId: string;
  orders: OrderDto[];
  payment: PaymentDto;
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

/**
 * Ciclo de vida:
 * AguardandoPagamento → Pago → EmPreparacao → Enviado → EmTransitoInternacional → Entregue → Concluido
 * Ramificações: Cancelado; EmDisputa → Devolvido | Reembolsado
 */
export const ORDER_STATUSES = [
  "AguardandoPagamento",
  "Pago",
  "EmPreparacao",
  "Enviado",
  "EmTransitoInternacional",
  "Entregue",
  "Concluido",
  "Cancelado",
  "EmDisputa",
  "Devolvido",
  "Reembolsado",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Caminho feliz, na ordem. */
export const ORDER_HAPPY_PATH: readonly OrderStatus[] = [
  "AguardandoPagamento",
  "Pago",
  "EmPreparacao",
  "Enviado",
  "EmTransitoInternacional",
  "Entregue",
  "Concluido",
];

export type PaymentStatus = "Pendente" | "Aprovado" | "Recusado" | "Expirado" | "Estornado";

export interface OrderItemDto {
  id: string;
  productId: string;
  productSlug: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  thumbnailUrl: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface OrderTimelineEventDto {
  status: OrderStatus;
  occurredAt: string;
  description: string | null;
  location: string | null;
}

export interface TrackingEventDto {
  code: string;
  description: string;
  location: string;
  occurredAt: string;
}

export interface OrderTotalsDto {
  subtotal: Money;
  shipping: Money;
  importTax: Money;
  discount: Money;
  total: Money;
  totalReference: Money;
  /** Tributos discriminados e câmbio usados na compra (nulo em pedidos antigos). */
  taxes?: ImportTaxBreakdownDto | null;
}

export type ShipmentStatus = "Pendente" | "EtiquetaEmitida" | "Postada" | "Cancelada" | "Falhou";
export type TaxRemittanceStatus = "Pendente" | "Enviado" | "Confirmado" | "Falhou";

export interface TaxRemittanceDto {
  status: TaxRemittanceStatus;
  importDuty: Money;
  icms: Money;
  ibsState: Money;
  ibsMunicipal: Money;
  cbs: Money;
  total: Money;
  reference: string | null;
  createdAt: string;
  sentAt: string | null;
  confirmedAt: string | null;
  lastError: string | null;
}

/** Remessa no operador logístico: declaração antecipada, etiqueta da plataforma e situação aduaneira. */
export interface ShipmentDto {
  id: string;
  orderId: string;
  status: ShipmentStatus;
  provider: string;
  sandbox: boolean;
  carrier: string | null;
  trackingCode: string | null;
  declarationNumber: string | null;
  hasLabel: boolean;
  labelUrl: string | null;
  createdAt: string;
  labelIssuedAt: string | null;
  postedAt: string | null;
  lastError: string | null;
  dirNumber: string | null;
  customsStatus: string | null;
  customsCheckedAt: string | null;
  remittance: TaxRemittanceDto | null;
}

export interface OrderDto {
  id: string;
  /** Número legível, ex.: PY-2025-000123 */
  number: string;
  purchaseId: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  seller: SellerSummaryDto;
  items: OrderItemDto[];
  shippingAddress: AddressDto;
  shippingOption: ShippingOptionDto;
  trackingCode: string | null;
  /** Transportadora informada na postagem (pode diferir da cotada). */
  carrier: string | null;
  trackingEvents: TrackingEventDto[];
  estimatedDelivery: DateRange;
  totals: OrderTotalsDto;
  exchangeRate: ExchangeRateDto;
  payment: { id: string; method: PaymentMethod; status: PaymentStatus };
  timeline: OrderTimelineEventDto[];
  /** Remessa no operador (etiqueta da plataforma), quando já emitida. */
  shipment?: ShipmentDto | null;
}

export interface OrderListQuery extends PagedQuery {
  status?: OrderStatus;
}

/** GET /orders/:id/tracking — eventos consultados na transportadora. */
export interface OrderTrackingDto {
  trackingCode: string | null;
  carrier: string | null;
  /** Página pública de rastreio na transportadora, quando houver. */
  trackingUrl: string | null;
  events: TrackingEventDto[];
}

// ---------------------------------------------------------------------------
// Pagamentos
// ---------------------------------------------------------------------------

export interface PixPaymentDto {
  /** Payload EMV "copia e cola". */
  qrCodePayload: string;
  qrCodeImageUrl: string | null;
  expiresAt: string;
}

export interface BoletoPaymentDto {
  barcode: string;
  digitableLine: string;
  pdfUrl: string;
  dueDate: string;
}

export interface CardPaymentDto {
  brand: string;
  last4: string;
  installments: number;
  installmentAmount: Money;
}

export interface PaymentDto {
  id: string;
  purchaseId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: Money;
  /** Total já estornado (zero quando não houve reembolso). */
  refundedAmount: Money;
  createdAt: string;
  paidAt: string | null;
  pix: PixPaymentDto | null;
  boleto: BoletoPaymentDto | null;
  card: CardPaymentDto | null;
}

// ---------------------------------------------------------------------------
// Auth / Conta
// ---------------------------------------------------------------------------

export type UserRole = "Comprador" | "Vendedor" | "Admin";

export interface UserProfileDto {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  /** Somente dígitos, 11 caracteres. */
  cpf: string | null;
  avatarUrl: string | null;
  roles: UserRole[];
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface GoogleAuthRequest {
  idToken: string;
}

/** POST /auth/refresh e /auth/logout (o backend também aceita o cookie httpOnly). */
export interface RefreshRequest {
  refreshToken: string | null;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: UserProfileDto;
}

export interface UpdateProfileRequest {
  fullName: string;
  phone: string | null;
  cpf: string | null;
}

/** DELETE /me — exclusão/anonimização da conta (LGPD). */
export interface DeleteAccountRequest {
  password?: string | null;
  /** Texto de confirmação digitado pelo usuário. */
  confirmation?: string | null;
}

export interface ConsentInput {
  type: ConsentDto["type"];
  granted: boolean;
}

/** GET /privacy-policy — versões vigentes e finalidades de tratamento (LGPD). */
export interface PrivacyPolicyDto {
  termsVersion: string;
  privacyPolicyVersion: string;
  termsUrl: string;
  privacyPolicyUrl: string;
  dataControllerEmail: string;
  purposes: string[];
}

// ---------------------------------------------------------------------------
// Favoritos (persistido no cliente; DTO para futura sincronização)
// ---------------------------------------------------------------------------

export interface FavoriteDto {
  productId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Repasses
// ---------------------------------------------------------------------------

export type PayoutStatus = "Agendado" | "Processando" | "Pago" | "Falhou";

export interface PayoutDto {
  id: string;
  sellerId: string;
  sellerName: string;
  orderId: string;
  orderNumber: string;
  period: DateRange;
  gross: Money;
  platformFee: Money;
  paymentFee: Money;
  net: Money;
  status: PayoutStatus;
  scheduledFor: string;
  paidAt: string | null;
  failureReason: string | null;
}

// ---------------------------------------------------------------------------
// Webhooks (recebidos pelo backend; documentados aqui para o contrato)
// ---------------------------------------------------------------------------

export type WebhookEventType =
  | "payment.approved"
  | "payment.declined"
  | "payment.expired"
  | "payment.refunded"
  | "shipment.updated"
  | "dispute.opened"
  | "dispute.resolved";

export interface WebhookEventDto<TPayload = unknown> {
  id: string;
  type: WebhookEventType;
  occurredAt: string;
  payload: TPayload;
}

// ---------------------------------------------------------------------------
// Painel do vendedor (/seller/*)
// ---------------------------------------------------------------------------

/** Excluido: desligada pela Política de Vendedores (8.1 c); não volta a vender nem com novo cadastro (3.5). */
export type SellerStatus = "Pendente" | "Aprovado" | "Suspenso" | "Excluido";

export type SellerPayoutMethod = "ContaBancaria" | "CarteiraDigital" | "Outro";

/** EmAnalise e Bloqueado são aplicados pela plataforma (conformidade), nunca escolhidos pelo vendedor. */
export type ProductStatus = "Rascunho" | "Ativo" | "Arquivado" | "EmAnalise" | "Bloqueado";

export type SellerDocumentType = "CedulaPy" | "Cpf" | "Passaporte";

/**
 * Dados de admissão do vendedor (Política de Vendedores 3.1 e 3.2). Documento e conta voltam mascarados; os arquivos
 * voltam como links temporários (armazenamento privado).
 */
export interface SellerVerificationDto {
  legalAddress: string | null;
  responsibleName: string | null;
  responsibleDocumentType: SellerDocumentType | null;
  responsibleDocumentMasked: string | null;
  identityDocumentUrl: string | null;
  rucCertificateUrl: string | null;
  complete: boolean;
  verifiedAt: string | null;
  suspensionReason: string | null;
  /** Certificado de cumprimento tributário (DNIT) e atos constitutivos. */
  taxComplianceCertificateUrl?: string | null;
  articlesOfIncorporationUrl?: string | null;
  payoutMethod?: SellerPayoutMethod | null;
  payoutInstitution?: string | null;
  payoutAccountMasked?: string | null;
  payoutHolder?: string | null;
  /** Tudo o que os itens 3.1 e 3.2 pedem está preenchido. */
  admissionComplete?: boolean;
  missingAdmissionData?: string[] | null;
  /** Itens conferidos pela equipe na aprovação (Política 3.3). */
  checklist?: string[] | null;
  policyVersionAccepted?: string | null;
  policyAcceptedAt?: string | null;
  dataConfirmedAt?: string | null;
  suspendedUntil?: string | null;
  /** Chaves dos documentos privados (para reenviar o formulário sem trocar o arquivo). */
  documentKeys?: Record<string, string> | null;
}

export interface SellerProfileDto {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  city: string;
  description: string;
  ruc: string;
  exchangePolicy: string;
  status: SellerStatus;
  reputationLevel: SellerSummaryDto["reputationLevel"];
  isOfficialStore: boolean;
  rating: number;
  reviewCount: number;
  productCount: number;
  memberSince: string;
  categories: Array<Pick<CategoryDto, "id" | "slug" | "name">>;
  /** CEP/código postal de onde os pedidos saem (cotação de frete). */
  originPostalCode: string | null;
  phone: string | null;
  verification?: SellerVerificationDto | null;
  /** Denominação social (pessoa jurídica paraguaia). */
  legalName?: string | null;
  email?: string | null;
}

export interface SellerProfileInput {
  name: string;
  ruc: string;
  city: string;
  description: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  exchangePolicy: string | null;
  categoryIds: string[];
  originPostalCode?: string | null;
  phone?: string | null;
  /** Endereço completo de origem: remetente da declaração e da etiqueta. */
  legalAddress?: string | null;
  responsibleName?: string | null;
  responsibleDocumentType?: SellerDocumentType | null;
  /** Vazio no perfil mantém o documento atual (ele só volta mascarado). */
  responsibleDocument?: string | null;
  identityDocumentUrl?: string | null;
  rucCertificateUrl?: string | null;
  legalName?: string | null;
  email?: string | null;
  payoutMethod?: SellerPayoutMethod | null;
  payoutInstitution?: string | null;
  /** Vazio no perfil mantém a conta atual (ela só volta mascarada). */
  payoutAccount?: string | null;
  payoutHolder?: string | null;
  taxComplianceCertificateUrl?: string | null;
  articlesOfIncorporationUrl?: string | null;
}

export interface SellerRegisterRequest extends SellerProfileInput {
  acceptTerms: boolean;
  /** Aceite eletrônico da Política de Vendedores (Política 2.2). */
  acceptSellerPolicy: boolean;
  /** Quem aceita declara ser o representante legal da empresa. */
  representativeDeclaration: boolean;
}

export interface SellerRegisterResponseDto {
  seller: SellerProfileDto;
  session: AuthResponseDto;
}

export interface SellerDashboardDto {
  sellerId: string;
  period: DateRange;
  grossSales: Money;
  ordersCount: number;
  pendingShipments: number;
  openQuestions: number;
  activeProducts: number;
  reputationLevel: SellerSummaryDto["reputationLevel"];
}

export interface SellerProductImageDto {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  storageKey: string | null;
}

export interface SellerProductImageInput {
  url: string;
  alt?: string | null;
  storageKey?: string | null;
}

export interface SellerProductListItemDto {
  id: string;
  slug: string;
  name: string;
  thumbnailUrl: string;
  price: Money;
  compareAtPrice: Money | null;
  stock: number;
  status: ProductStatus;
  soldCount: number;
  updatedAt: string;
  /** Por que está em análise ou bloqueado (MARCA_PROTEGIDA, PRECO_ABAIXO_REFERENCIA, CONTRAFACAO…). */
  moderationReason?: string | null;
  hsCode?: string | null;
}

/** Dimensões do pacote em centímetros (comprimento × largura × altura). */
export interface ParcelDimensionsDto {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface SellerProductDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  price: Money;
  compareAtPrice: Money | null;
  stock: number;
  freeShipping: boolean;
  warrantyMonths: number | null;
  handlingDays: DayRange;
  /** Peso do pacote em gramas (cotação de frete). */
  weightGrams: number | null;
  dimensions: ParcelDimensionsDto | null;
  /** NCM de 8 dígitos (obrigatório para publicar), conferido na tabela oficial do Siscomex. */
  hsCode: string | null;
  hsCodeDescription?: string | null;
  moderationReason?: string | null;
  moderationNote?: string | null;
  /** Descrição da mercadoria na declaração (Programa 7.4 e 7.6). */
  nature?: string | null;
  brand?: string | null;
  unbranded?: boolean;
  model?: string | null;
  material?: string | null;
  packageQuantity?: number;
  /** País de fabricação, ISO alfa-2. */
  originCountry?: string | null;
  /** Como a mercadoria sai na declaração (null enquanto faltar dado). */
  declarationPreview?: string | null;
  attributes: ProductAttributeDto[];
  images: SellerProductImageDto[];
  status: ProductStatus;
  soldCount: number;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SellerProductInput {
  name: string;
  description: string;
  categoryId: string;
  priceAmount: number;
  compareAtAmount: number | null;
  stock: number;
  freeShipping: boolean;
  warrantyMonths: number | null;
  handlingDaysMin: number;
  handlingDaysMax: number;
  weightGrams?: number | null;
  dimensions?: ParcelDimensionsDto | null;
  hsCode?: string | null;
  nature?: string | null;
  brand?: string | null;
  unbranded?: boolean;
  model?: string | null;
  material?: string | null;
  packageQuantity?: number | null;
  originCountry?: string | null;
  attributes: ProductAttributeDto[];
  images: SellerProductImageInput[];
  status: "Rascunho" | "Ativo";
}

export interface SellerProductListQuery extends PagedQuery {
  status?: ProductStatus;
  q?: string;
}

export interface UploadRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignedUploadDto {
  uploadUrl: string;
  publicUrl: string;
  storageKey: string;
  headers: Record<string, string>;
}

/** Com etiqueta da plataforma o corpo vai vazio (o rastreio vem da etiqueta). */
export interface ShipOrderRequest {
  carrier?: string | null;
  trackingCode?: string | null;
}

/**
 * Como o vendedor despacha: com a etiqueta da plataforma (operador configurado) e/ou informando o rastreio, quando a
 * plataforma não exige a etiqueta (ex.: antes de contratar o operador). `GET /seller/shipping-policy`.
 */
export interface SellerShippingPolicyDto {
  requirePlatformLabel: boolean;
  carrierConfigured: boolean;
  sandbox: boolean;
  carrier: string;
}

// ---------------------------------------------------------------------------
// Painel administrativo (/admin/*) — papel Admin
// ---------------------------------------------------------------------------

export interface AdminSalesPointDto {
  date: string;
  amount: Money;
  orders: number;
}

export interface AdminStatusCountDto {
  status: OrderStatus;
  count: number;
}

export interface AdminOrderListItemDto {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  sellerId: string;
  sellerName: string;
  total: Money;
  paymentId: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  trackingCode: string | null;
  itemsCount: number;
}

export interface AdminOverviewDto {
  period: DateRange;
  totalUsers: number;
  newUsers30d: number;
  blockedUsers: number;
  totalSellers: number;
  pendingSellers: number;
  suspendedSellers: number;
  activeProducts: number;
  draftProducts: number;
  totalOrders: number;
  orders30d: number;
  ordersInTransit: number;
  ordersAwaitingShipment: number;
  openDisputes: number;
  gmv30d: Money;
  gmvTotal: Money;
  importTaxCollected30d: Money;
  platformFees30d: Money;
  pendingPayouts: Money;
  pendingPayoutsCount: number;
  ordersByStatus: AdminStatusCountDto[];
  salesByDay: AdminSalesPointDto[];
  recentOrders: AdminOrderListItemDto[];
}

export interface AdminUserListItemDto {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  roles: UserRole[];
  createdAt: string;
  blockedAt: string | null;
  anonymizedAt: string | null;
  ordersCount: number;
  totalSpent: Money;
  sellerName: string | null;
}

export interface AdminAuditLogDto {
  id: number;
  userId: string | null;
  userEmail: string | null;
  action: string;
  target: string | null;
  occurredAt: string;
  ipAddress: string | null;
}

export interface AdminUserDetailDto {
  summary: AdminUserListItemDto;
  cpf: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
  blockedReason: string | null;
  addresses: AddressDto[];
  recentOrders: AdminOrderListItemDto[];
  consents: ConsentDto[];
  recentActivity: AdminAuditLogDto[];
}

export interface ConsentDto {
  type: "TermosDeUso" | "PoliticaDePrivacidade" | "Marketing";
  version: string;
  acceptedAt: string;
  revokedAt: string | null;
}

export interface AdminUserUpdateRequest {
  fullName?: string;
  phone?: string;
  roles?: UserRole[];
}

/** POST /admin/users/:id/block */
export interface AdminBlockRequest {
  reason?: string | null;
}

export interface AdminSellerListItemDto {
  id: string;
  slug: string;
  name: string;
  ruc: string;
  city: string;
  status: SellerStatus;
  reputationLevel: SellerSummaryDto["reputationLevel"];
  isOfficialStore: boolean;
  logoUrl: string | null;
  ownerUserId: string | null;
  ownerEmail: string | null;
  memberSince: string;
  productCount: number;
  ordersCount: number;
  gross30d: Money;
  openDisputes: number;
  /** Documentos conferidos pela equipe (política de admissão). */
  verified?: boolean;
  /** Ocorrências de conformidade na janela de reincidência. */
  occurrences?: number;
  /** Infrações nos últimos 12 meses (reincidência, Política 8.3). */
  infractions12Months?: number;
  admissionComplete?: boolean;
}

export interface AdminSellerDetailDto {
  summary: AdminSellerListItemDto;
  description: string;
  exchangePolicy: string;
  bannerUrl: string | null;
  rating: number;
  reviewCount: number;
  categories: Array<Pick<CategoryDto, "id" | "slug" | "name">>;
  recentOrders: AdminOrderListItemDto[];
  recentPayouts: PayoutDto[];
  verification?: SellerVerificationDto | null;
  occurrences?: ComplianceOccurrenceDto[] | null;
  governance?: SellerGovernanceDto | null;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface AdminSellerUpdateRequest {
  name?: string;
  city?: string;
  description?: string;
  status?: SellerStatus;
  reputationLevel?: number;
  isOfficialStore?: boolean;
  /** Obrigatório ao suspender ou excluir (fica no histórico e aparece para o vendedor). */
  suspensionReason?: string | null;
  /** Suspensão temporária com fim (dias); vazio = até a revisão da equipe. */
  suspensionDays?: number | null;
}

export interface AdminProductListItemDto {
  id: string;
  slug: string;
  name: string;
  thumbnailUrl: string;
  price: Money;
  stock: number;
  status: ProductStatus;
  sellerId: string;
  sellerName: string;
  categoryName: string;
  soldCount: number;
  updatedAt: string;
  moderationReason?: string | null;
  hsCode?: string | null;
  openReports?: number;
}

export interface AdminProductUpdateRequest {
  status?: ProductStatus;
  priceAmount?: number;
  stock?: number;
  name?: string;
}

export interface AdminOrderDetailDto {
  order: OrderDto;
  buyer: AdminUserListItemDto;
  payment: PaymentDto;
  payout: PayoutDto | null;
}

export interface AdminOrderTransitionRequest {
  status: OrderStatus;
  note?: string;
  trackingCode?: string;
  carrier?: string;
}

export interface AdminDisputeResolveRequest {
  outcome: "Devolvido" | "Reembolsado" | "Concluido";
  note?: string;
}

export interface AdminPaymentListItemDto {
  id: string;
  purchaseId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: Money;
  createdAt: string;
  paidAt: string | null;
  gateway: string;
  gatewayPaymentId: string | null;
  buyerEmail: string;
  orderNumbers: string[];
  failureReason: string | null;
}

export interface CouponDto {
  id: string;
  code: string;
  discountBasisPoints: number;
  minSubtotalAmount: number | null;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
}

export interface CouponInput {
  code: string;
  discountBasisPoints: number;
  minSubtotalAmount: number | null;
  expiresAt: string | null;
  maxUses: number | null;
  active: boolean;
}

export interface ExchangeRateInput {
  from: CurrencyCode;
  to: CurrencyCode;
  numerator: number;
  denominator: number;
  expiresAt?: string | null;
}

export type ImportTaxMode = "Flat" | "RemessaConforme";

export interface PlatformSettingsDto {
  importTaxMode: ImportTaxMode;
  importTaxBasisPoints: number;
  icmsBasisPoints: number;
  platformFeeBasisPoints: number;
  paymentFeeBasisPoints: number;
  freeShippingThresholdAmount: number;
  quoteLockMinutes: number;
  pixExpirationMinutes: number;
  boletoDueDays: number;
  payoutHoldDays: number;
  autoCompleteDays: number;
  termsVersion: string;
  privacyPolicyVersion: string;
  updatedAt: string;
  /** Exceções de ICMS por UF em pontos-base, ex.: "SP=2000; RJ=2000". */
  icmsStateOverrides: string;
  ibsStateBasisPoints: number;
  ibsMunicipalBasisPoints: number;
  cbsBasisPoints: number;
  insuranceBasisPoints: number;
  /** Faixas do II no Remessa Conforme (Portaria MF 1.342/2026: 0, 6000 e US$ 30). */
  importDutyLowTierBasisPoints: number;
  importDutyHighTierBasisPoints: number;
  /** Dedução fixa do II acima de US$ 50, em centavos de dólar. */
  importDutyHighTierDeductionUsdCents: number;
  otherExpensesAmount: number;
  sellerStrikeLimit: number;
  strikeWindowDays: number;
  priceFloorPercent: number;
  protectedBrands: string;
  requirePlatformLabel: boolean;
  // Programa de Conformidade e Política de Vendedores
  sellerPolicyVersion: string;
  sellerPolicyApprovedAt: string | null;
  complianceProgramApprovedAt: string | null;
  programOwnerName: string;
  programOwnerEmail: string;
  abruptIncreaseFactor: number;
  abruptIncreaseMinShipments: number;
  concentrationThreshold: number;
  auditSamplePercent: number;
  /** Somente leitura: com o ADE configurado a etiqueta da plataforma não pode ser desligada (Programa 9.5). */
  platformLabelLocked?: boolean;
}

export interface AdminOrderListQuery extends PagedQuery {
  status?: OrderStatus;
  q?: string;
  sellerId?: string;
  userId?: string;
  inTransit?: boolean;
}

export interface AdminUserListQuery extends PagedQuery {
  q?: string;
  role?: UserRole;
  blocked?: boolean;
}

export interface AdminSellerListQuery extends PagedQuery {
  q?: string;
  status?: SellerStatus;
}

export interface AdminProductListQuery extends PagedQuery {
  q?: string;
  status?: ProductStatus;
  sellerId?: string;
}

export interface AdminPaymentListQuery extends PagedQuery {
  status?: PaymentStatus;
  q?: string;
}

export interface AdminPayoutListQuery extends PagedQuery {
  status?: PayoutStatus;
  sellerId?: string;
}

export interface AdminAuditListQuery extends PagedQuery {
  q?: string;
}

// ---------------------------------------------------------------------------
// Remessa Conforme — conformidade (Portarias Coana 130/2023 e 193/2026)
// ---------------------------------------------------------------------------
export type ComplianceIndicator = "Contrafacao" | "Subvaloracao" | "QualidadeDeclaracao";
/** "Denuncia" só aparece em registros antigos: denúncia procedente é infração da loja e não entra nos indicadores. */
export type OccurrenceSource = "Despacho" | "Siscomex" | "Ouvidoria" | "Denuncia" | "Interna";
export type OccurrenceStatus = "Confirmada" | "Contestada" | "Anulada";
export type ProductReportReason =
  | "Falsificado"
  | "PrecoSuspeito"
  | "DescricaoIncorreta"
  | "ProdutoProibido"
  | "Outro"
  | "PropriedadeIntelectual"
  | "OrigemIlicita";
/** Por onde a denúncia chegou: botão na página do produto ou canal público (/denuncia). */
export type ReportChannel = "PaginaDoProduto" | "CanalPublico";
/** Fundamentos aceitos para contestar um indicador (Programa 11.6). */
export type ContestationReason = "ErroMaterial" | "InconsistenciaSistemica" | "ImpropriedadeMetodologia";
export type ProductReportStatus = "Aberta" | "Procedente" | "Improcedente";
/** Faixa de cada indicador: Ouro ≥ 99,7% · Prata ≥ 99,4% · Bronze ≥ 99,0% · Advertência ≥ 98,0% · Exclusão abaixo. */
export type ComplianceBand = "Ouro" | "Prata" | "Bronze" | "Advertencia" | "Exclusao";

/** Denúncia pela página do produto: com ou sem login (canal aberto a qualquer pessoa, Política 6.4). */
export interface ProductReportRequest {
  reason: ProductReportReason;
  details?: string | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
  isRightsHolder?: boolean;
  rightsHolderName?: string | null;
  /** Links de evidência (http/https). */
  evidenceUrls?: string[] | null;
  /** Campo isca: preenchido só por robôs. */
  website?: string | null;
}

export interface ProductReportDto {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productStatus: ProductStatus;
  sellerId: string;
  sellerName: string;
  reason: ProductReportReason;
  details: string;
  status: ProductReportStatus;
  createdAt: string;
  reporterEmail: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  occurrenceId: string | null;
  /** Protocolo informado a quem denunciou. */
  protocol?: string | null;
  channel?: ReportChannel;
  reporterName?: string | null;
  isRightsHolder?: boolean;
  rightsHolderName?: string | null;
  evidenceUrls?: string[] | null;
  /** Prazo da decisão: 2 dias úteis (Política 6.5). */
  dueAt?: string | null;
  overdue?: boolean;
}

/** Procedente vira infração da loja (Política 6.7); a denúncia não entra nos indicadores da Receita. */
export interface ProductReportResolveRequest {
  upheld: boolean;
  blockProduct: boolean;
  note?: string | null;
}

export interface ComplianceOccurrenceDto {
  id: string;
  indicator: ComplianceIndicator;
  source: OccurrenceSource;
  status: OccurrenceStatus;
  code: string;
  description: string;
  sellerId: string | null;
  sellerName: string | null;
  productId: string | null;
  productName: string | null;
  orderId: string | null;
  orderNumber: string | null;
  externalId: string | null;
  occurredAt: string;
  registeredAt: string;
  statusReason: string | null;
  contestationReason?: ContestationReason | null;
  contestationGrounds?: string | null;
  contestedAt?: string | null;
  /** Contestação registrada no relacionamento com a Receita. */
  rfInteractionId?: string | null;
}

export interface ComplianceOccurrenceInput {
  indicator: ComplianceIndicator;
  source: OccurrenceSource;
  code: string;
  description: string;
  sellerId?: string | null;
  productId?: string | null;
  orderNumber?: string | null;
  occurredAt?: string | null;
}

/**
 * Contestação (só por erro material, inconsistência sistêmica ou impropriedade na metodologia — Programa 11.6, com
 * fundamentação e evidências — 11.7), anulação (a Receita acolheu) ou confirmação.
 */
export interface OccurrenceStatusRequest {
  status: OccurrenceStatus;
  reason?: string | null;
  contestationReason?: ContestationReason | null;
  grounds?: string | null;
  /** Chaves de documentos privados ou links. */
  evidence?: string[] | null;
  reference?: string | null;
}

export interface ComplianceIndicatorDto {
  indicator: ComplianceIndicator;
  occurrences: number;
  /** Remessas sem ocorrência em centésimos de % (9970 = 99,70%). */
  compliancePermyriad: number;
  band: ComplianceBand;
  consequence: string;
}

export interface ComplianceMonthDto {
  year: number;
  month: number;
  shipments: number;
  indicators: ComplianceIndicatorDto[];
}

/**
 * Acompanhamento da loja (Política 6.6 e 7.2): ocorrências da Receita na janela, infrações apuradas pela equipe nos
 * últimos 12 meses (reincidência, 8.3) e alerta em aberto para a equipe avaliar a medida (8.2).
 */
export interface SellerRiskDto {
  sellerId: string;
  sellerName: string;
  status: SellerStatus;
  occurrences: number;
  openReports: number;
  infractions: number;
  recidivist: boolean;
  openAlert: boolean;
}

export interface ComplianceDashboardDto {
  cycleStartYear: number;
  cycle: DateRange;
  cycleShipments: number;
  sealEligible: boolean;
  sealMinimumShipments: number;
  cycleIndicators: ComplianceIndicatorDto[];
  months: ComplianceMonthDto[];
  sellersAtRisk: SellerRiskDto[];
  openReports: number;
  productsInReview: number;
  pendingSellerVerifications: number;
  /** Ocorrências da Receita na janela que abrem alerta de acompanhamento da loja (nada é aplicado sozinho). */
  strikeLimit: number;
  strikeWindowDays: number;
}

export interface ProductModerationRequest {
  action: "aprovar" | "bloquear" | "analisar";
  reason?: string | null;
  note?: string | null;
}

export interface SellerVerificationRequest {
  approve: boolean;
  note?: string | null;
  /** Itens conferidos pela equipe (Política 3.3): aprovar exige todos de SELLER_VERIFICATION_ITEMS. */
  checks?: string[] | null;
}

/** Itens que a equipe confere antes de aprovar uma loja (Política 3.3), na ordem do formulário. */
export const SELLER_VERIFICATION_ITEMS = [
  "dados-cadastrais",
  "ruc",
  "constancia-ruc",
  "certificado-tributario",
  "atos-constitutivos",
  "documento-representante",
  "meio-de-pagamento",
  "endereco-origem",
  "aceite-politica",
] as const;
export type SellerVerificationItem = (typeof SELLER_VERIFICATION_ITEMS)[number];

export interface AdminShipmentListItemDto {
  id: string;
  orderId: string;
  orderNumber: string;
  sellerName: string;
  status: ShipmentStatus;
  provider: string;
  sandbox: boolean;
  trackingCode: string | null;
  declarationNumber: string | null;
  dirNumber: string | null;
  customsStatus: string | null;
  remittanceStatus: TaxRemittanceStatus | null;
  taxes: Money;
  createdAt: string;
  lastError: string | null;
  /** Conferências feitas antes de registrar a remessa (Programa 6.3 e 7.1 a 7.6). */
  checks?: ShipmentCheckDto[] | null;
}

export interface ShipmentCheckDto {
  /** remetente · destinatario · mercadoria:N · regime · valor */
  check: string;
  ok: boolean;
  detail: string;
}

/** Situação de cada integração (governo e operador). missing = variáveis de ambiente que faltam. */
export interface IntegrationStatusDto {
  key: "platform" | "carrier" | "siscomex" | "serpro" | "ncm" | "ptax";
  name: string;
  purpose: string;
  provider: string;
  configured: boolean;
  requiresCredential: boolean;
  mode: string;
  missing: string[];
  detail: string | null;
  docsUrl: string;
}

export interface NcmLookupDto {
  code: string;
  formatted: string;
  description: string;
  /** false = tabela oficial indisponível (só o formato foi conferido). */
  official: boolean;
}

// ---------------------------------------------------------------------------
// Programa de Conformidade Tributária e Aduaneira e Política de Admissão e de Monitoramento de Vendedores
// ---------------------------------------------------------------------------

export type SellerNoticeType = "Medida" | "SolicitacaoDocumentos" | "AtualizacaoCadastral" | "AlteracaoPolitica" | "Aviso";
export type SellerNoticeStatus = "Aberta" | "Respondida" | "Encerrada";
/** O que a plataforma pede ao vendedor (Política 6.2): autenticidade, valor real da operação ou registros. */
export type DocumentRequestKind = "Autenticidade" | "ValorDaOperacao" | "Registros";
/** Medidas da Política 8.1, aplicadas de forma gradual (8.2). */
export type SellerMeasureType = "RemocaoAnuncio" | "SuspensaoTemporaria" | "Exclusao";
export type InfractionSeverity = "Leve" | "Media" | "Grave";
export type MonitoringAlertType =
  | "Fracionamento"
  | "AumentoAbrupto"
  | "ConcentracaoDestinatario"
  | "PrecoMuitoAbaixo"
  | "DivergenciaReiterada"
  | "ValorDeclarado"
  | "Remetente"
  /** Ocorrências da Receita da loja no limite de acompanhamento: a equipe avalia a medida (Política 8.2). */
  | "OcorrenciasReceita";
export type MonitoringAlertStatus = "Aberto" | "Procedente" | "Improcedente";
export type AlertAttribution = "Vendedor" | "Comprador" | "Plataforma";
export type RfInteractionType =
  | "ConsultaMensal"
  | "PlanoDeAcao"
  | "NotificacaoCorretiva"
  | "Ouvidoria"
  | "Contestacao"
  | "ManifestacaoCiclo"
  | "ComunicacaoDeFato"
  | "Outro";
export type RfInteractionStatus = "Pendente" | "Concluida";
export type EnforcementActionKind =
  | "AnuncioEmAnalise"
  | "AnuncioRemovido"
  | "AnuncioLiberado"
  | "AutenticidadeSolicitada"
  | "AutenticidadeComprovada"
  | "AutenticidadeNaoComprovada"
  | "DenunciaRecebida"
  | "DenunciaProcedente"
  | "DenunciaImprocedente"
  | "InfracaoRegistrada"
  | "MedidaAplicada"
  | "MedidaRevogada"
  | "CadastroRecusado"
  | "InformacoesAutoridades"
  | "AlertaMonitoramento";
export type SellerAuditReason = "Infracao" | "Amostra";
export type SellerAuditStatus = "Planejada" | "Concluida";
export type SellerAuditOutcome = "Conforme" | "NaoConforme";

// ----- Política de Vendedores (pública: Política 2.3 e 2.4) -----

/** Item do Anexo I (mercadorias proibidas), letra a–p. */
export interface AnnexItemDto {
  letter: string;
  title: string;
}

/** GET /policies/seller — dados que completam o texto publicado da Política. */
export interface SellerPolicyInfoDto {
  version: string;
  approvedAt: string | null;
  brand: string;
  companyLegalName: string | null;
  companyDocumentType: string | null;
  companyDocument: string | null;
  companyAddress: string | null;
  platformUrl: string;
  annex: AnnexItemDto[];
}

// ----- Canal de denúncias (público, sem login: Política 6.4) -----

/** POST /reports */
export interface PublicReportRequest {
  /** Link, slug ou id do anúncio. */
  product: string;
  reason: ProductReportReason;
  details?: string | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
  isRightsHolder?: boolean;
  rightsHolderName?: string | null;
  evidenceUrls?: string[] | null;
  /** Campo isca: preenchido só por robôs. */
  website?: string | null;
}

export interface ReportReceiptDto {
  id: string;
  protocol: string;
  dueAt: string;
  productId: string;
  productName: string;
}

// ----- Documentos privados (cadastro, respostas, evidências) -----

/** POST /seller/documents/uploads e /admin/documents/uploads (PDF, JPG, PNG ou WEBP). */
export interface DocumentUploadRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/** Referência a um documento: a chave guardada e um link temporário para abrir. */
export interface DocumentRefDto {
  key: string;
  url: string;
  name: string;
}

// ----- Comunicações ao vendedor (Política 4.6, 6.2, 8.4 a 8.6, 10.3) -----

export interface SellerNoticeDto {
  id: string;
  sellerId: string;
  sellerName: string;
  type: SellerNoticeType;
  status: SellerNoticeStatus;
  documentKind: DocumentRequestKind | null;
  title: string;
  message: string;
  productId: string | null;
  productName: string | null;
  productSlug: string | null;
  orderId: string | null;
  orderNumber: string | null;
  measureId: string | null;
  createdAt: string;
  /** Prazo de resposta: 10 dias (Política 6.2 e 8.5). */
  dueAt: string | null;
  overdue: boolean;
  readAt: string | null;
  responseText: string | null;
  responseFiles: DocumentRefDto[];
  respondedAt: string | null;
  resolution: string | null;
  resolvedAt: string | null;
}

export interface SellerNoticeResponseRequest {
  text?: string | null;
  /** Chaves dos documentos enviados (doc/…). */
  files?: string[] | null;
}

/** Admin: pedido de documentos, correção de dados ou aviso. */
export interface SellerNoticeCreateRequest {
  type: SellerNoticeType;
  documentKind?: DocumentRequestKind | null;
  productId?: string | null;
  orderNumber?: string | null;
  title?: string | null;
  message?: string | null;
}

/** Admin: aceita (documentos comprovam / dados corrigidos) ou recusa a resposta e encerra. */
export interface SellerNoticeResolveRequest {
  accepted: boolean;
  resolution?: string | null;
}

export interface SellerNoticeListQuery extends PagedQuery {
  status?: SellerNoticeStatus;
  type?: SellerNoticeType;
  sellerId?: string;
}

// ----- Infrações e medidas (Política 1.1 d, 7.2, 8.1 a 8.3) -----

export interface SellerInfractionInput {
  code?: string | null;
  description: string;
  severity: InfractionSeverity;
  intentional: boolean;
  productId?: string | null;
  orderNumber?: string | null;
  occurredAt?: string | null;
}

export interface SellerInfractionDto {
  id: string;
  code: string;
  description: string;
  severity: InfractionSeverity;
  intentional: boolean;
  productId: string | null;
  productName: string | null;
  orderNumber: string | null;
  occurredAt: string;
  registeredAt: string;
  /** Outra infração nos 12 meses anteriores (Política 8.3). */
  recidivist: boolean;
}

/** Medida sugerida pela graduação do item 8.2 (a equipe decide). */
export interface MeasureRecommendationDto {
  type: SellerMeasureType;
  suspensionDays: number | null;
  priorInfractions: number;
  recidivist: boolean;
  rationale: string;
}

export interface SellerInfractionResultDto {
  infraction: SellerInfractionDto;
  recommendation: MeasureRecommendationDto;
}

export interface SellerMeasureInput {
  type: SellerMeasureType;
  reason: string;
  infractionId?: string | null;
  productId?: string | null;
  suspensionDays?: number | null;
}

export interface SellerMeasureDto {
  id: string;
  type: SellerMeasureType;
  reason: string;
  infractionId: string | null;
  productId: string | null;
  productName: string | null;
  appliedAt: string;
  automatic: boolean;
  endsAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  active: boolean;
  noticeId: string | null;
}

export interface RevokeMeasureRequest {
  reason: string;
}

// ----- Aceite da Política (Política 2.2 e 10.3) -----

export interface SellerPolicyAcceptanceDto {
  policyVersion: string;
  acceptedAt: string;
  representativeName: string;
  representativeDocumentMasked: string | null;
  ipAddress: string | null;
}

export interface SellerPolicyAcceptRequest {
  accept: boolean;
  representativeName?: string | null;
}

// ----- Situação da loja no painel do vendedor -----

/** GET /seller/compliance */
export interface SellerComplianceStatusDto {
  status: SellerStatus;
  suspensionReason: string | null;
  suspendedUntil: string | null;
  policyVersion: string;
  policyVersionAccepted: string | null;
  policyAcceptanceRequired: boolean;
  dataConfirmedAt: string | null;
  dataConfirmationDueAt: string;
  /** Confirmação anual dos dados vencida (Política 4.3). */
  dataConfirmationDue: boolean;
  admissionDataComplete: boolean;
  missingAdmissionData: string[];
  openNotices: number;
  overdueNotices: number;
  infractions12Months: number;
  activeMeasures: SellerMeasureDto[];
}

// ----- Governança da loja no admin -----

export interface SellerAuditDto {
  id: string;
  sellerId: string;
  sellerName: string;
  year: number;
  reason: SellerAuditReason;
  status: SellerAuditStatus;
  plannedAt: string;
  noticeId: string | null;
  outcome: SellerAuditOutcome | null;
  findings: string | null;
  completedAt: string | null;
}

export interface SellerGovernanceDto {
  notices: SellerNoticeDto[];
  infractions: SellerInfractionDto[];
  measures: SellerMeasureDto[];
  acceptances: SellerPolicyAcceptanceDto[];
  audits: SellerAuditDto[];
  /** Lojas excluídas com dados ou documentos em comum (Política 3.5). */
  reRegistrationMatches: string[];
  infractions12Months: number;
  recidivist: boolean;
}

/** POST /admin/sellers/:id/dossier — informações para autoridades (Política 8.8 e 9.1). */
export interface SellerDossierRequest {
  purpose: string;
}

// ----- Monitoramento (Programa 6; Política 7.3) -----

export interface MonitoringAlertDto {
  id: string;
  type: MonitoringAlertType;
  status: MonitoringAlertStatus;
  sellerId: string | null;
  sellerName: string | null;
  buyerUserId: string | null;
  buyerEmail: string | null;
  summary: string;
  orderNumbers: string[];
  /** Fracionamento da mesma loja: as etiquetas esperam o julgamento. */
  holdsShipments: boolean;
  detectedAt: string;
  attribution: AlertAttribution | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
}

export interface MonitoringAlertListQuery extends PagedQuery {
  status?: MonitoringAlertStatus;
  type?: MonitoringAlertType;
}

/** registerInfraction: procedente e atribuído ao vendedor registra a infração (Programa 6.5). */
export interface MonitoringAlertResolveRequest {
  upheld: boolean;
  attribution?: AlertAttribution | null;
  note?: string | null;
  registerInfraction: boolean;
  severity?: InfractionSeverity | null;
}

export interface MonitoringRunResultDto {
  newAlerts: number;
  listingsFlagged: number;
  noticesCreated: number;
  sellersSuspended: number;
  suspensionsLifted: number;
}

// ----- Relacionamento com a Receita Federal (Programa 3, 11 e 12) -----

export interface RfInteractionDto {
  id: string;
  type: RfInteractionType;
  status: RfInteractionStatus;
  title: string;
  description: string;
  reference: string | null;
  openedAt: string;
  dueAt: string | null;
  overdue: boolean;
  indicator: ComplianceIndicator | null;
  contestationReason: ContestationReason | null;
  occurrenceIds: string[];
  year: number | null;
  month: number | null;
  /** Indicadores oficiais consultados no Portal Único (centésimos de %). */
  officialCounterfeitPermyriad: number | null;
  officialUndervaluationPermyriad: number | null;
  officialDeclarationQualityPermyriad: number | null;
  response: string | null;
  attachments: DocumentRefDto[];
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface RfInteractionListQuery extends PagedQuery {
  type?: RfInteractionType;
  status?: RfInteractionStatus;
}

export interface RfInteractionInput {
  type: RfInteractionType;
  title?: string | null;
  description?: string | null;
  reference?: string | null;
  openedAt?: string | null;
  /** Prazo fixado pela Receita (ouvidoria); sem ele vale o prazo do Programa. */
  dueAt?: string | null;
  indicator?: ComplianceIndicator | null;
  year?: number | null;
  month?: number | null;
  officialCounterfeitPermyriad?: number | null;
  officialUndervaluationPermyriad?: number | null;
  officialDeclarationQualityPermyriad?: number | null;
  attachments?: string[] | null;
}

/** contestationAccepted: só em contestações — a Receita acolheu (ocorrências anuladas) ou não (voltam a contar). */
export interface RfInteractionCompleteRequest {
  response?: string | null;
  attachments?: string[] | null;
  contestationAccepted?: boolean | null;
}

/** Contestação de indicador: indicador, remessas, fundamento (11.6) e fundamentação com evidências (11.7). */
export interface ContestationRequest {
  indicator: ComplianceIndicator;
  occurrenceIds?: string[] | null;
  reason: ContestationReason;
  grounds: string;
  evidence?: string[] | null;
  reference?: string | null;
}

// ----- Capacitação (Programa 13) -----

export interface ComplianceTrainingInput {
  personName: string;
  personEmail?: string | null;
  userId?: string | null;
  role: string;
  topic: string;
  initial: boolean;
  trainedAt?: string | null;
  notes?: string | null;
}

export interface ComplianceTrainingDto {
  id: string;
  personName: string;
  personEmail: string | null;
  userId: string | null;
  role: string;
  topic: string;
  initial: boolean;
  trainedAt: string;
  notes: string | null;
}

/** Situação de cada pessoa: última capacitação e próxima (a cada 12 meses). */
export interface TrainingStatusDto {
  personName: string;
  email: string | null;
  userId: string | null;
  role: string | null;
  lastTrainedAt: string | null;
  nextDueAt: string | null;
  due: boolean;
}

export interface TrainingOverviewDto {
  people: TrainingStatusDto[];
  records: ComplianceTrainingDto[];
}

// ----- Registro de ações contra produtos ilegais (Programa 8.9; Política 6.8) -----

export interface EnforcementActionDto {
  id: number;
  kind: EnforcementActionKind;
  occurredAt: string;
  automatic: boolean;
  actorEmail: string | null;
  sellerId: string | null;
  sellerName: string | null;
  productId: string | null;
  productName: string | null;
  reportId: string | null;
  reason: string;
  result: string;
}

export interface EnforcementActionListQuery extends PagedQuery {
  kind?: EnforcementActionKind;
  sellerId?: string;
}

// ----- Auditoria anual (Política 7.4) -----

export interface AuditPlanRequest {
  year?: number | null;
}

export interface AuditPlanResultDto {
  year: number;
  withInfractions: number;
  sample: number;
  audits: SellerAuditDto[];
}

export interface AuditCompleteRequest {
  outcome: SellerAuditOutcome;
  findings: string;
}

// ----- Painel do Programa -----

export interface MonthlyReviewDto {
  year: number;
  month: number;
  done: boolean;
  doneAt: string | null;
  doneBy: string | null;
}

/** Manifestação anual de interesse em continuar no PRC (Programa 12): de 1º a 31 de outubro. */
export interface AnnualManifestationDto {
  cycleStartYear: number;
  windowStart: string;
  windowEnd: string;
  windowOpen: boolean;
  submitted: boolean;
}

/** Pendência do Programa com prazo e link para resolver. */
export interface ProgramTaskDto {
  key: string;
  title: string;
  detail: string;
  dueAt: string | null;
  overdue: boolean;
  href: string;
}

/** GET /admin/compliance/program */
export interface ComplianceProgramDto {
  ownerName: string | null;
  ownerEmail: string | null;
  programApprovedAt: string | null;
  policyVersion: string;
  policyApprovedAt: string | null;
  /** ADE configurado: operação no PRC iniciada (a etiqueta da plataforma passa a ser obrigatória, 9.5). */
  operationStarted: boolean;
  cpfVerificationActive: boolean;
  currentMonthReview: MonthlyReviewDto;
  manifestation: AnnualManifestationDto;
  openReports: number;
  overdueReports: number;
  openAlerts: number;
  heldShipments: number;
  pendingRfInteractions: number;
  overdueRfInteractions: number;
  openSellerNotices: number;
  overdueSellerNotices: number;
  sellersDataConfirmationDue: number;
  sellersMissingAdmissionData: number;
  sellersPolicyPending: number;
  trainingsDue: number;
  auditsPlanned: number;
  tasks: ProgramTaskDto[];
}
