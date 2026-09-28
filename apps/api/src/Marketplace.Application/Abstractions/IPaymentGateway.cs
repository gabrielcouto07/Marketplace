using Marketplace.Domain;
using Marketplace.Domain.Common;

namespace Marketplace.Application.Abstractions;

public sealed record CreatePaymentRequest(
    Guid PaymentId,
    Guid PurchaseId,
    PaymentMethod Method,
    Money Amount,
    string PayerDocument,
    string PayerName,
    string PayerEmail,
    string Description,
    DateTime ExpiresAt,
    CardTokenInput? Card,
    /// <summary>Comissão da plataforma (para gateways com split/application_fee).</summary>
    Money PlatformFee);

public sealed record CardTokenInput(string Token, string HolderName, string Brand, string Last4, int Installments);

public sealed record PixDetails(string QrCodePayload, string? QrCodeImageUrl, DateTime ExpiresAt);

public sealed record BoletoDetails(string Barcode, string DigitableLine, string PdfUrl, DateTime DueDate);

public sealed record CardDetails(string Brand, string Last4, int Installments, Money InstallmentAmount);

public sealed record CreatePaymentResult(
    PaymentStatus Status,
    string? GatewayPaymentId,
    PixDetails? Pix,
    BoletoDetails? Boleto,
    CardDetails? Card,
    string? FailureReason);

public sealed record GatewayPaymentEvent(
    string EventId,
    string Type,
    string? GatewayPaymentId,
    Guid? PaymentId,
    PaymentStatus? NewStatus,
    DateTime OccurredAt,
    string RawPayload);

/// <summary>Gateway de pagamento (Pix, boleto, cartão). Implementações: Fake (dev) e Mercado Pago.</summary>
public interface IPaymentGateway
{
    string Name { get; }

    Task<CreatePaymentResult> CreatePaymentAsync(CreatePaymentRequest request, CancellationToken ct);

    Task<PaymentStatus> GetStatusAsync(string gatewayPaymentId, CancellationToken ct);

    Task RefundAsync(string gatewayPaymentId, Money amount, CancellationToken ct);

    /// <summary>Valida assinatura e traduz o webhook do provedor. Retorna null quando o evento deve ser ignorado.</summary>
    Task<GatewayPaymentEvent?> ParseWebhookAsync(WebhookRequest request, CancellationToken ct);
}

public sealed record WebhookRequest(
    string Body,
    IReadOnlyDictionary<string, string> Headers,
    IReadOnlyDictionary<string, string> Query);
