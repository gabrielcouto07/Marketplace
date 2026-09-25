/**
 * @marketplace/contracts
 *
 * DTOs TypeScript que espelham a futura API REST em ASP.NET Core.
 * Convenções (ver docs/API_CONTRACTS.md):
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
}

export type ProductSort =
  | "relevance"
  | "priceAsc"
  | "priceDesc"
  | "newest"
  | "bestSelling"
  | "rating";

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
  productId: string;
  question: string;
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
}

export type AddressInput = Omit<AddressDto, "id" | "country">;

export interface PostalCodeLookupDto {
  postalCode: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
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
}

export interface CheckoutQuoteDto {
  quoteId: string;
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
  trackingEvents: TrackingEventDto[];
  estimatedDelivery: DateRange;
  totals: OrderTotalsDto;
  exchangeRate: ExchangeRateDto;
  payment: { id: string; method: PaymentMethod; status: PaymentStatus };
  timeline: OrderTimelineEventDto[];
}

export interface OrderListQuery extends PagedQuery {
  status?: OrderStatus;
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

// ---------------------------------------------------------------------------
// Favoritos (persistido no cliente; DTO para futura sincronização)
// ---------------------------------------------------------------------------

export interface FavoriteDto {
  productId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Painel do vendedor (esqueleto — endpoints futuros)
// ---------------------------------------------------------------------------

export interface SellerDashboardDto {
  sellerId: string;
  period: DateRange;
  grossSales: Money;
  ordersCount: number;
  pendingShipments: number;
  openQuestions: number;
  reputationLevel: SellerSummaryDto["reputationLevel"];
}

export type PayoutStatus = "Agendado" | "Processando" | "Pago" | "Falhou";

export interface PayoutDto {
  id: string;
  sellerId: string;
  period: DateRange;
  gross: Money;
  platformFee: Money;
  paymentFee: Money;
  net: Money;
  status: PayoutStatus;
  scheduledFor: string;
  paidAt: string | null;
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
