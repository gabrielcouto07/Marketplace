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

/// <summary>Situação da cobrança consultada no gateway. Amount/PaidAt permitem conferir o valor antes de aprovar.</summary>
public sealed record GatewayPaymentStatus(
    PaymentStatus Status,
    Money? Amount,
    DateTime? PaidAt,
    /// <summary>Referência externa enviada na criação (nosso PaymentId) — resolve webhooks que chegam antes de gravarmos o id do gateway.</summary>
    string? ExternalReference = null);

public sealed record GatewayRefundResult(string? RefundId, PaymentStatus? NewStatus);

public sealed record GatewayPaymentEvent(
    string EventId,
    string Type,
    string? GatewayPaymentId,
    Guid? PaymentId,
    PaymentStatus? NewStatus,
    DateTime OccurredAt,
    string RawPayload,
    /// <summary>Valor informado pelo gateway no evento (quando houver), para conferência.</summary>
    Money? Amount = null);

/// <summary>
/// Gateway de pagamento (Pix, boleto, cartão). Implementações: Fake (dev) e Mercado Pago. Todos os gateways
/// ficam registrados no <see cref="IPaymentGatewayRegistry"/>: o padrão cria cobranças novas; consultas, estornos
/// e webhooks usam o gateway gravado em <c>Payment.Gateway</c>.
/// </summary>
public interface IPaymentGateway
{
    string Name { get; }

    Task<CreatePaymentResult> CreatePaymentAsync(CreatePaymentRequest request, CancellationToken ct);

    Task<GatewayPaymentStatus> GetStatusAsync(string gatewayPaymentId, CancellationToken ct);

    /// <param name="idempotencyKey">Chave estável por (pagamento, pedido): repetir a chamada não estorna duas vezes.</param>
    Task<GatewayRefundResult> RefundAsync(string gatewayPaymentId, Money amount, string idempotencyKey, CancellationToken ct);

    /// <summary>Valida assinatura e traduz o webhook do provedor. Retorna null quando o evento deve ser ignorado.</summary>
    Task<GatewayPaymentEvent?> ParseWebhookAsync(WebhookRequest request, CancellationToken ct);
}

public interface IPaymentGatewayRegistry
{
    /// <summary>Gateway usado para criar cobranças novas (<c>Payments:Provider</c>).</summary>
    IPaymentGateway Default { get; }

    IReadOnlyCollection<string> Names { get; }

    /// <summary>Gateway pelo nome gravado no pagamento. Lança quando não está registrado.</summary>
    IPaymentGateway Get(string name);

    bool TryGet(string name, out IPaymentGateway gateway);
}

public sealed record WebhookRequest(
    string Body,
    IReadOnlyDictionary<string, string> Headers,
    IReadOnlyDictionary<string, string> Query);
