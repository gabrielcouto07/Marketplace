using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Payments;

public sealed class FakePaymentOptions
{
    /// <summary>Aprova Pix/boleto pendentes automaticamente após N segundos (0 = nunca). Demo de polling.</summary>
    public int AutoApproveAfterSeconds { get; set; } = 20;
    /// <summary>Cartões com este final são recusados (demo).</summary>
    public string DeclinedLast4 { get; set; } = "0000";
    /// <summary>Segredo do webhook fake (`POST /webhooks/payments/fake`, X-Signature = HMAC-SHA256 do corpo). Vazio = webhook rejeitado.</summary>
    public string WebhookSecret { get; set; } = string.Empty;
}

/// <summary>Gateway de testes: não movimenta dinheiro. Replica o comportamento do mock do front.</summary>
public sealed class FakePaymentGateway(IOptions<FakePaymentOptions> options, ILinkBuilder links, TimeProvider clock) : IPaymentGateway
{
    public const string GatewayName = "fake";

    public string Name => GatewayName;

    public Task<CreatePaymentResult> CreatePaymentAsync(CreatePaymentRequest request, CancellationToken ct)
    {
        var gatewayId = $"fake_{request.PaymentId:N}";
        CreatePaymentResult result = request.Method switch
        {
            PaymentMethod.Pix => new CreatePaymentResult(PaymentStatus.Pendente, gatewayId,
                new PixDetails(FakePaymentFormats.PixPayload(request.PurchaseId, request.Amount), null, request.ExpiresAt), null, null, null),
            PaymentMethod.Boleto => BuildBoleto(request, gatewayId),
            PaymentMethod.Cartao => BuildCard(request, gatewayId),
            _ => throw new ArgumentOutOfRangeException(nameof(request)),
        };
        return Task.FromResult(result);
    }

    private CreatePaymentResult BuildBoleto(CreatePaymentRequest request, string gatewayId)
    {
        var (barcode, line) = FakePaymentFormats.Boleto(request.Amount);
        return new CreatePaymentResult(PaymentStatus.Pendente, gatewayId, null,
            new BoletoDetails(barcode, line, links.BoletoPdf(request.PaymentId), request.ExpiresAt.Date.AddDays(-1).AddHours(23).AddMinutes(59)), null, null);
    }

    private CreatePaymentResult BuildCard(CreatePaymentRequest request, string gatewayId)
    {
        var card = request.Card ?? throw new InvalidOperationException("Cartão obrigatório.");
        var declined = card.Last4 == options.Value.DeclinedLast4;
        return new CreatePaymentResult(
            declined ? PaymentStatus.Recusado : PaymentStatus.Aprovado,
            gatewayId,
            null, null,
            new CardDetails(card.Brand, card.Last4, card.Installments, request.Amount.InstallmentAmount(card.Installments)),
            declined ? "Cartão recusado pelo emissor (simulação)." : null);
    }

    /// <summary>O fake não guarda estado: quem decide é o job de auto-aprovação ou o webhook.</summary>
    public Task<GatewayPaymentStatus> GetStatusAsync(string gatewayPaymentId, CancellationToken ct) =>
        Task.FromResult(new GatewayPaymentStatus(PaymentStatus.Pendente, null, null, null));

    public Task<GatewayRefundResult> RefundAsync(string gatewayPaymentId, Money amount, string idempotencyKey, CancellationToken ct) =>
        Task.FromResult(new GatewayRefundResult($"fake_refund_{idempotencyKey}", null));

    /// <summary>
    /// Corpo: <c>{ id, type: "payment.approved|declined|expired|refunded", occurredAt, payload: { paymentId, amount? } }</c>,
    /// assinado com HMAC-SHA256 do corpo em X-Signature.
    /// </summary>
    public Task<GatewayPaymentEvent?> ParseWebhookAsync(WebhookRequest request, CancellationToken ct)
    {
        var secret = options.Value.WebhookSecret;
        if (string.IsNullOrWhiteSpace(secret))
            throw new UnauthorizedAccessException("Webhook fake sem segredo configurado (Payments:Fake:WebhookSecret).");
        if (!WebhookSignature.IsValid(secret, request.Body, request.Headers.GetValueOrDefault("x-signature")))
            throw new UnauthorizedAccessException("Assinatura inválida.");

        using var doc = JsonDocument.Parse(request.Body);
        var root = doc.RootElement;
        var type = root.TryGetProperty("type", out var typeEl) ? typeEl.GetString() ?? string.Empty : string.Empty;
        var id = root.TryGetProperty("id", out var idEl) ? idEl.ToString() : Guid.NewGuid().ToString();
        if (!root.TryGetProperty("payload", out var payload)) return Task.FromResult<GatewayPaymentEvent?>(null);
        Guid? paymentId = payload.TryGetProperty("paymentId", out var pid) && Guid.TryParse(pid.GetString(), out var g) ? g : null;
        Money? amount = payload.TryGetProperty("amount", out var amountEl) && amountEl.TryGetInt64(out var cents) ? Money.Brl(cents) : null;
        PaymentStatus? status = type switch
        {
            "payment.approved" => PaymentStatus.Aprovado,
            "payment.declined" => PaymentStatus.Recusado,
            "payment.expired" => PaymentStatus.Expirado,
            "payment.refunded" => PaymentStatus.Estornado,
            _ => null,
        };
        if (status is null) return Task.FromResult<GatewayPaymentEvent?>(null);
        var occurredAt = root.TryGetProperty("occurredAt", out var at) && at.TryGetDateTime(out var dt) ? dt.ToUniversalTime() : clock.GetUtcNow().UtcDateTime;
        return Task.FromResult<GatewayPaymentEvent?>(new GatewayPaymentEvent(id, type, null, paymentId, status, occurredAt, request.Body, amount));
    }
}

public static class WebhookSignature
{
    public static string Compute(string secret, string body)
    {
        var key = System.Text.Encoding.UTF8.GetBytes(secret);
        var hash = System.Security.Cryptography.HMACSHA256.HashData(key, System.Text.Encoding.UTF8.GetBytes(body));
        return Convert.ToHexStringLower(hash);
    }

    /// <summary>Compara em tempo constante. Segredo vazio nunca valida (evita aceitar HMAC com chave vazia).</summary>
    public static bool IsValid(string? secret, string body, string? provided)
    {
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(provided)) return false;
        var expected = Compute(secret, body);
        var given = provided.Trim().ToLowerInvariant();
        if (given.StartsWith("sha256=")) given = given[7..];
        return expected.Length == given.Length &&
               System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                   System.Text.Encoding.ASCII.GetBytes(expected), System.Text.Encoding.ASCII.GetBytes(given));
    }
}
