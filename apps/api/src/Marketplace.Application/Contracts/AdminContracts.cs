using Marketplace.Domain;
using Marketplace.Domain.Common;

namespace Marketplace.Application.Contracts;

// ----- Painel administrativo (/admin/*) — papel Admin -----

public sealed record AdminSalesPointDto(DateTime Date, Money Amount, int Orders);

public sealed record AdminStatusCountDto(OrderStatus Status, int Count);

public sealed record AdminOrderListItemDto(
    Guid Id,
    string Number,
    OrderStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    Guid BuyerId,
    string BuyerName,
    string BuyerEmail,
    Guid SellerId,
    string SellerName,
    Money Total,
    Guid PaymentId,
    PaymentMethod PaymentMethod,
    PaymentStatus PaymentStatus,
    string? TrackingCode,
    int ItemsCount);

public sealed record AdminOverviewDto(
    DateRange Period,
    int TotalUsers,
    int NewUsers30d,
    int BlockedUsers,
    int TotalSellers,
    int PendingSellers,
    int SuspendedSellers,
    int ActiveProducts,
    int DraftProducts,
    int TotalOrders,
    int Orders30d,
    int OrdersInTransit,
    int OrdersAwaitingShipment,
    int OpenDisputes,
    Money Gmv30d,
    Money GmvTotal,
    Money ImportTaxCollected30d,
    Money PlatformFees30d,
    Money PendingPayouts,
    int PendingPayoutsCount,
    IReadOnlyList<AdminStatusCountDto> OrdersByStatus,
    IReadOnlyList<AdminSalesPointDto> SalesByDay,
    IReadOnlyList<AdminOrderListItemDto> RecentOrders);

// Usuários
public sealed record AdminUserListItemDto(
    Guid Id,
    string FullName,
    string Email,
    string? Phone,
    IReadOnlyList<UserRole> Roles,
    DateTime CreatedAt,
    DateTime? BlockedAt,
    DateTime? AnonymizedAt,
    int OrdersCount,
    Money TotalSpent,
    string? SellerName);

public sealed record AdminUserDetailDto(
    AdminUserListItemDto Summary,
    string? Cpf,
    bool EmailVerified,
    bool HasPassword,
    bool HasGoogle,
    string? BlockedReason,
    IReadOnlyList<AddressDto> Addresses,
    IReadOnlyList<AdminOrderListItemDto> RecentOrders,
    IReadOnlyList<ConsentDto> Consents,
    IReadOnlyList<AdminAuditLogDto> RecentActivity);

public sealed record AdminUserUpdateRequest(string? FullName, string? Phone, IReadOnlyList<UserRole>? Roles);

public sealed record AdminBlockRequest(string? Reason);

// Vendedores
public sealed record AdminSellerListItemDto(
    Guid Id,
    string Slug,
    string Name,
    string Ruc,
    string City,
    SellerStatus Status,
    int ReputationLevel,
    bool IsOfficialStore,
    string? LogoUrl,
    Guid? OwnerUserId,
    string? OwnerEmail,
    DateTime MemberSince,
    int ProductCount,
    int OrdersCount,
    Money Gross30d,
    int OpenDisputes);

public sealed record AdminSellerDetailDto(
    AdminSellerListItemDto Summary,
    string Description,
    string ExchangePolicy,
    string? BannerUrl,
    double Rating,
    int ReviewCount,
    IReadOnlyList<CategoryRefDto> Categories,
    IReadOnlyList<AdminOrderListItemDto> RecentOrders,
    IReadOnlyList<PayoutDto> RecentPayouts);

public sealed record AdminSellerUpdateRequest(
    string? Name,
    string? City,
    string? Description,
    SellerStatus? Status,
    int? ReputationLevel,
    bool? IsOfficialStore);

// Produtos
public sealed record AdminProductListItemDto(
    Guid Id,
    string Slug,
    string Name,
    string ThumbnailUrl,
    Money Price,
    int Stock,
    ProductStatus Status,
    Guid SellerId,
    string SellerName,
    string CategoryName,
    int SoldCount,
    DateTime UpdatedAt);

public sealed record AdminProductUpdateRequest(ProductStatus? Status, long? PriceAmount, int? Stock, string? Name);

// Pedidos
public sealed record AdminOrderDetailDto(OrderDto Order, AdminUserListItemDto Buyer, PaymentDto Payment, PayoutDto? Payout);

public sealed record AdminOrderTransitionRequest(OrderStatus Status, string? Note, string? TrackingCode, string? Carrier);

public sealed record AdminDisputeResolveRequest(OrderStatus Outcome, string? Note);

// Pagamentos
public sealed record AdminPaymentListItemDto(
    Guid Id,
    Guid PurchaseId,
    PaymentMethod Method,
    PaymentStatus Status,
    Money Amount,
    DateTime CreatedAt,
    DateTime? PaidAt,
    string Gateway,
    string? GatewayPaymentId,
    string BuyerEmail,
    IReadOnlyList<string> OrderNumbers,
    string? FailureReason);

// Repasses
public sealed record PayoutDto(
    Guid Id,
    Guid SellerId,
    string SellerName,
    Guid OrderId,
    string OrderNumber,
    DateRange Period,
    Money Gross,
    Money PlatformFee,
    Money PaymentFee,
    Money Net,
    PayoutStatus Status,
    DateTime ScheduledFor,
    DateTime? PaidAt,
    string? FailureReason);

// Cupons
public sealed record CouponDto(
    Guid Id,
    string Code,
    int DiscountBasisPoints,
    long? MinSubtotalAmount,
    DateTime? ExpiresAt,
    int? MaxUses,
    int UsedCount,
    bool Active);

public sealed record CouponInput(string? Code, int? DiscountBasisPoints, long? MinSubtotalAmount, DateTime? ExpiresAt, int? MaxUses, bool Active);

// Câmbio
public sealed record ExchangeRateInput(CurrencyCode From, CurrencyCode To, long? Numerator, long? Denominator, DateTime? ExpiresAt);

// Banners e categorias
public sealed record BannerInput(string? Title, string? Subtitle, string? ImageUrl, string? Href, BannerTone Tone, int SortOrder, bool Active);

public sealed record CategoryInput(string? Name, string? Slug, string? IconKey, string? ImageUrl, int SortOrder);

// Configurações
public sealed record PlatformSettingsDto(
    ImportTaxMode ImportTaxMode,
    int ImportTaxBasisPoints,
    int IcmsBasisPoints,
    int PlatformFeeBasisPoints,
    int PaymentFeeBasisPoints,
    long FreeShippingThresholdAmount,
    int QuoteLockMinutes,
    int PixExpirationMinutes,
    int BoletoDueDays,
    int PayoutHoldDays,
    int AutoCompleteDays,
    string TermsVersion,
    string PrivacyPolicyVersion,
    DateTime UpdatedAt);

// Auditoria
public sealed record AdminAuditLogDto(long Id, Guid? UserId, string? UserEmail, string Action, string? Target, DateTime OccurredAt, string? IpAddress);
