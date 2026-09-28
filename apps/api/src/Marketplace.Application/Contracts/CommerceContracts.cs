using Marketplace.Domain;
using Marketplace.Domain.Common;

namespace Marketplace.Application.Contracts;

// ----- Endereço / CEP / Frete -----

public sealed record AddressDto(
    Guid Id,
    string Label,
    string RecipientName,
    string PostalCode,
    string Street,
    string Number,
    string? Complement,
    string Neighborhood,
    string City,
    string State,
    string Country,
    string? Phone,
    bool IsDefault);

public sealed record AddressInput(
    string? Label,
    string? RecipientName,
    string? PostalCode,
    string? Street,
    string? Number,
    string? Complement,
    string? Neighborhood,
    string? City,
    string? State,
    string? Phone,
    bool IsDefault);

public sealed record PostalCodeLookupDto(string PostalCode, string Street, string Neighborhood, string City, string State);

public sealed record ShippingQuoteItem(Guid ProductId, Guid? VariantId, int Quantity);

public sealed record ShippingQuoteRequest(string? PostalCode, Guid SellerId, IReadOnlyList<ShippingQuoteItem>? Items);

public sealed record ShippingOptionDto(Guid Id, string Carrier, string Service, Money Price, DayRange EstimatedDays, string? Description);

public sealed record ShippingDestinationDto(string City, string State);

public sealed record ShippingQuoteDto(string PostalCode, ShippingDestinationDto Destination, Guid SellerId, IReadOnlyList<ShippingOptionDto> Options);

// ----- Checkout -----

public sealed record CheckoutGroupInput(Guid SellerId, IReadOnlyList<ShippingQuoteItem>? Items, Guid? ShippingOptionId);

public sealed record CheckoutQuoteRequest(string? PostalCode, IReadOnlyList<CheckoutGroupInput>? Groups, string? CouponCode);

public sealed record CheckoutLineDto(Guid ProductId, Guid? VariantId, string Name, string? VariantLabel, string ThumbnailUrl, int Quantity, Money UnitPrice, Money LineTotal);

public sealed record CheckoutGroupDto(
    SellerSummaryDto Seller,
    IReadOnlyList<CheckoutLineDto> Lines,
    Money Subtotal,
    IReadOnlyList<ShippingOptionDto> ShippingOptions,
    Guid? SelectedShippingOptionId,
    Money Shipping);

public sealed record CheckoutQuoteDto(
    Guid QuoteId,
    IReadOnlyList<CheckoutGroupDto> Groups,
    Money Subtotal,
    Money ShippingTotal,
    Money EstimatedImportTax,
    int ImportTaxRateBasisPoints,
    Money Discount,
    Money Total,
    Money TotalReference,
    ExchangeRateDto ExchangeRate,
    DateTime LockedUntil);

public sealed record CardPaymentInput(string? Token, string? HolderName, string? Brand, string? Last4, int Installments);

public sealed record PlaceOrderPaymentInput(PaymentMethod Method, CardPaymentInput? Card, string? PayerDocument);

public sealed record PlaceOrderRequest(
    Guid QuoteId,
    Guid AddressId,
    IReadOnlyList<CheckoutGroupInput>? Groups,
    PlaceOrderPaymentInput? Payment,
    Guid ExchangeRateId,
    string? IdempotencyKey);

public sealed record PlaceOrderResponseDto(Guid PurchaseId, IReadOnlyList<OrderDto> Orders, PaymentDto Payment);

// ----- Pedidos -----

public sealed record OrderItemDto(
    Guid Id,
    Guid ProductId,
    string ProductSlug,
    Guid? VariantId,
    string Name,
    string? VariantLabel,
    string ThumbnailUrl,
    int Quantity,
    Money UnitPrice,
    Money LineTotal);

public sealed record OrderTimelineEventDto(OrderStatus Status, DateTime OccurredAt, string? Description, string? Location);

public sealed record TrackingEventDto(string Code, string Description, string Location, DateTime OccurredAt);

public sealed record OrderTotalsDto(Money Subtotal, Money Shipping, Money ImportTax, Money Discount, Money Total, Money TotalReference);

public sealed record OrderPaymentRefDto(Guid Id, PaymentMethod Method, PaymentStatus Status);

public sealed record OrderDto(
    Guid Id,
    string Number,
    Guid PurchaseId,
    OrderStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    SellerSummaryDto Seller,
    IReadOnlyList<OrderItemDto> Items,
    AddressDto ShippingAddress,
    ShippingOptionDto ShippingOption,
    string? TrackingCode,
    IReadOnlyList<TrackingEventDto> TrackingEvents,
    DateRange EstimatedDelivery,
    OrderTotalsDto Totals,
    ExchangeRateDto ExchangeRate,
    OrderPaymentRefDto Payment,
    IReadOnlyList<OrderTimelineEventDto> Timeline);

public sealed record OrderTrackingDto(string? TrackingCode, IReadOnlyList<TrackingEventDto> Events);

// ----- Pagamentos -----

public sealed record PixPaymentDto(string QrCodePayload, string? QrCodeImageUrl, DateTime ExpiresAt);

public sealed record BoletoPaymentDto(string Barcode, string DigitableLine, string PdfUrl, DateTime DueDate);

public sealed record CardPaymentDto(string Brand, string Last4, int Installments, Money InstallmentAmount);

public sealed record PaymentDto(
    Guid Id,
    Guid PurchaseId,
    PaymentMethod Method,
    PaymentStatus Status,
    Money Amount,
    DateTime CreatedAt,
    DateTime? PaidAt,
    PixPaymentDto? Pix,
    BoletoPaymentDto? Boleto,
    CardPaymentDto? Card);

// ----- Carrinho / favoritos (sincronização) -----

public sealed record CartLineDto(Guid ProductId, Guid? VariantId, int Quantity);

public sealed record CartDto(Guid Id, IReadOnlyList<CartLineDto> Lines, DateTime UpdatedAt);

public sealed record FavoriteDto(Guid ProductId, DateTime CreatedAt);
