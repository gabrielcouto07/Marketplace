using Marketplace.Domain.Common;

namespace Marketplace.Domain.Entities;

public class ExchangeRate
{
    public Guid Id { get; set; }
    public CurrencyCode From { get; set; }
    public CurrencyCode To { get; set; }
    public long Numerator { get; set; }
    public long Denominator { get; set; }
    public required string DisplayRate { get; set; }
    public DateTime QuotedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public string Source { get; set; } = "manual";

    public Money Convert(Money amount) => amount.Convert(From, To, Numerator, Denominator);
}

/// <summary>Faixa de destino por primeiro dígito do CEP (zoneamento Correios) para tabela de frete.</summary>
public class ShippingZone
{
    public int Id { get; set; }
    /// <summary>Primeiro dígito do CEP ("0"–"9").</summary>
    public required string Prefix { get; set; }
    public required string State { get; set; }
    public required string City { get; set; }
    /// <summary>Acréscimo (pode ser negativo) em centavos sobre a base.</summary>
    public long SurchargeAmount { get; set; }
    public int ExtraDays { get; set; }
}

/// <summary>Cotação de checkout emitida (câmbio travado). O payload é o DTO devolvido ao cliente.</summary>
public class CheckoutQuote
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public Guid ExchangeRateId { get; set; }
    public required string PayloadJson { get; set; }
    public long TotalAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LockedUntil { get; set; }
    public DateTime? ConsumedAt { get; set; }

    public bool IsUsable(DateTime now) => ConsumedAt is null && LockedUntil > now;
}

/// <summary>Uma compra = N pedidos (um por vendedor) = 1 pagamento.</summary>
public class Purchase
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid PaymentId { get; set; }
    public Guid ExchangeRateId { get; set; }
    public Guid? QuoteId { get; set; }
    public required string IdempotencyKey { get; set; }
    public long TotalAmount { get; set; }
    public string? CouponCode { get; set; }
    public DateTime CreatedAt { get; set; }

    public List<Order> Orders { get; set; } = [];
    public Payment Payment { get; set; } = null!;
}

public class Order
{
    public Guid Id { get; set; }
    /// <summary>Número legível, ex.: PY-2026-000123.</summary>
    public required string Number { get; set; }
    public Guid PurchaseId { get; set; }
    public Purchase Purchase { get; set; } = null!;
    public Guid UserId { get; set; }
    public Guid SellerId { get; set; }
    public Seller Seller { get; set; } = null!;
    public Guid PaymentId { get; set; }
    public Payment Payment { get; set; } = null!;
    public Guid ExchangeRateId { get; set; }
    public ExchangeRate ExchangeRate { get; set; } = null!;
    public OrderStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    /// <summary>Snapshot do endereço (imutável mesmo que o usuário edite depois).</summary>
    public required AddressSnapshot ShippingAddress { get; set; }
    public required ShippingOptionSnapshot ShippingOption { get; set; }
    public string? TrackingCode { get; set; }
    public string? Carrier { get; set; }
    public DateTime EstimatedDeliveryMin { get; set; }
    public DateTime EstimatedDeliveryMax { get; set; }

    public long SubtotalAmount { get; set; }
    public long ShippingAmount { get; set; }
    public long ImportTaxAmount { get; set; }
    public long DiscountAmount { get; set; }
    public long TotalAmount { get; set; }
    /// <summary>Total convertido para PYG com a taxa travada.</summary>
    public long TotalReferenceAmount { get; set; }

    public List<OrderItem> Items { get; set; } = [];
    public List<OrderEvent> Events { get; set; } = [];
    public List<TrackingEvent> TrackingEvents { get; set; } = [];

    public bool CanBeCancelled => OrderStateMachine.CanCancel(Status);
    public bool CanOpenDispute => OrderStateMachine.CanDispute(Status);
}

public record AddressSnapshot(
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

public record ShippingOptionSnapshot(
    Guid Id,
    string Carrier,
    string Service,
    long PriceAmount,
    int EstimatedDaysMin,
    int EstimatedDaysMax,
    string? Description);

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public required string ProductSlug { get; set; }
    public Guid? VariantId { get; set; }
    public required string Name { get; set; }
    public string? VariantLabel { get; set; }
    public required string ThumbnailUrl { get; set; }
    public int Quantity { get; set; }
    public long UnitPriceAmount { get; set; }
    public long LineTotalAmount { get; set; }
}

/// <summary>Linha do tempo do pedido (uma por transição de status).</summary>
public class OrderEvent
{
    public long Id { get; set; }
    public Guid OrderId { get; set; }
    public OrderStatus Status { get; set; }
    public DateTime OccurredAt { get; set; }
    /// <summary>Texto adicional (ex.: motivo). Quando nulo, a descrição vem da tradução do status.</summary>
    public string? Note { get; set; }
    public string? Location { get; set; }
    public string? Actor { get; set; }
}

/// <summary>Evento bruto da transportadora, normalizado (POSTED, EXPORT, ARRIVED_BR, CUSTOMS…).</summary>
public class TrackingEvent
{
    public long Id { get; set; }
    public Guid OrderId { get; set; }
    public required string Code { get; set; }
    public required string Description { get; set; }
    public string Location { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; }
    /// <summary>Identificador do evento na transportadora (deduplicação).</summary>
    public string? ExternalId { get; set; }
}

public class Payment
{
    public Guid Id { get; set; }
    public Guid PurchaseId { get; set; }
    public Guid UserId { get; set; }
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; }
    public long Amount { get; set; }
    public CurrencyCode Currency { get; set; } = CurrencyCode.BRL;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public required string Gateway { get; set; }
    public string? GatewayPaymentId { get; set; }
    /// <summary>CPF do pagador (somente dígitos; cifrado em repouso).</summary>
    public string? PayerDocument { get; set; }
    public string? FailureReason { get; set; }

    public string? PixPayload { get; set; }
    public string? PixQrCodeImageUrl { get; set; }
    public DateTime? PixExpiresAt { get; set; }

    public string? BoletoBarcode { get; set; }
    public string? BoletoDigitableLine { get; set; }
    public string? BoletoPdfUrl { get; set; }
    public DateTime? BoletoDueDate { get; set; }

    public string? CardBrand { get; set; }
    public string? CardLast4 { get; set; }
    public int? Installments { get; set; }
    public long? InstallmentAmount { get; set; }

    public Money Money => new(Amount, Currency);
    public bool IsFinal => Status is PaymentStatus.Aprovado or PaymentStatus.Recusado or PaymentStatus.Expirado or PaymentStatus.Estornado;
}

/// <summary>Repasse ao vendedor por pedido (ledger). Pago pela plataforma após o prazo de retenção.</summary>
public class Payout
{
    public Guid Id { get; set; }
    public Guid SellerId { get; set; }
    public Guid OrderId { get; set; }
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public long GrossAmount { get; set; }
    public long PlatformFeeAmount { get; set; }
    public long PaymentFeeAmount { get; set; }
    public long NetAmount { get; set; }
    public PayoutStatus Status { get; set; } = PayoutStatus.Agendado;
    public DateTime ScheduledFor { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? FailureReason { get; set; }
}

/// <summary>Webhooks recebidos (idempotência por provider + id externo).</summary>
public class WebhookEvent
{
    public long Id { get; set; }
    public required string Provider { get; set; }
    public required string ExternalId { get; set; }
    public required string Type { get; set; }
    public required string PayloadJson { get; set; }
    public DateTime ReceivedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public string? Error { get; set; }
}

/// <summary>Parâmetros da plataforma (linha única). Editáveis pelo admin.</summary>
public class PlatformSettings
{
    public int Id { get; set; } = 1;
    public ImportTaxMode ImportTaxMode { get; set; } = ImportTaxMode.Flat;
    /// <summary>Alíquota estimada de importação no modo Flat (6000 = 60%).</summary>
    public int ImportTaxBasisPoints { get; set; } = 6000;
    /// <summary>ICMS aplicado no modo RemessaConforme (1700 = 17%).</summary>
    public int IcmsBasisPoints { get; set; } = 1700;
    /// <summary>Comissão da plataforma sobre o subtotal do vendedor.</summary>
    public int PlatformFeeBasisPoints { get; set; } = 1200;
    /// <summary>Custo do meio de pagamento repassado no ledger.</summary>
    public int PaymentFeeBasisPoints { get; set; } = 349;
    public long FreeShippingThresholdAmount { get; set; } = 30000;
    public int QuoteLockMinutes { get; set; } = 15;
    public int PixExpirationMinutes { get; set; } = 30;
    public int BoletoDueDays { get; set; } = 3;
    /// <summary>Dias após a entrega para liberar o repasse.</summary>
    public int PayoutHoldDays { get; set; } = 14;
    /// <summary>Dias após a entrega para concluir o pedido automaticamente.</summary>
    public int AutoCompleteDays { get; set; } = 7;
    public string TermsVersion { get; set; } = "2026-09-01";
    public string PrivacyPolicyVersion { get; set; } = "2026-09-01";
    public DateTime UpdatedAt { get; set; }
}
