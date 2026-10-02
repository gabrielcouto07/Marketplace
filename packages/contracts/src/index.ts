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
  /** Transportadora informada na postagem (pode diferir da cotada). */
  carrier: string | null;
  trackingEvents: TrackingEventDto[];
  estimatedDelivery: DateRange;
  totals: OrderTotalsDto;
  exchangeRate: ExchangeRateDto;
  payment: { id: string; method: PaymentMethod; status: PaymentStatus };
  timeline: OrderTimelineEventDto[];
}

export interface OrderListQuery extends PagedQuery {
  status?: OrderStatus;
  /** Filtro por grupo de status no servidor: "active" (em andamento) ou "done" (concluídos/cancelados). */
  group?: "active" | "done";
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
  /** Aceite dos termos de uso e da política de privacidade (consentimento LGPD registrado no servidor). */
  acceptTerms: boolean;
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

export type SellerStatus = "Pendente" | "Aprovado" | "Suspenso";

export type ProductStatus = "Rascunho" | "Ativo" | "Arquivado";

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
}

export interface SellerRegisterRequest extends SellerProfileInput {
  acceptTerms: boolean;
}

/** POST /seller/orders/:id/cancel — loja cancela um pedido pago/em preparação (estorno + estoque automáticos). */
export interface CancelOrderRequest {
  reason?: string | null;
}

/** GET /seller/questions — pergunta de comprador com o produto para dar contexto. */
export interface SellerQuestionDto {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productThumbnailUrl: string;
  question: string;
  askedBy: string;
  askedAt: string;
  answer: { text: string; answeredAt: string } | null;
}

export interface SellerQuestionListQuery extends PagedQuery {
  unanswered?: boolean;
}

/** POST /seller/questions/:id/answer */
export interface AnswerQuestionRequest {
  text: string;
}

export interface SellerPayoutListQuery extends PagedQuery {
  status?: PayoutStatus;
}

/** GET /seller/payouts/summary — totais líquidos do ledger da loja por situação. */
export interface SellerPayoutSummaryDto {
  scheduled: Money;
  processing: Money;
  paid: Money;
  failed: Money;
  scheduledCount: number;
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
  /** Código NCM/HS para a declaração de importação. */
  hsCode: string | null;
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
  attributes: ProductAttributeDto[];
  images: SellerProductImageInput[];
  status: Exclude<ProductStatus, "Arquivado">;
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

export interface ShipOrderRequest {
  carrier: string;
  trackingCode: string;
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
}

export interface AdminSellerUpdateRequest {
  name?: string;
  city?: string;
  description?: string;
  status?: SellerStatus;
  reputationLevel?: number;
  isOfficialStore?: boolean;
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
