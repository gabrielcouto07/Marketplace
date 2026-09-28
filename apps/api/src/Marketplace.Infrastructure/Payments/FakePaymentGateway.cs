using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Domain;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Payments;

public sealed class FakePaymentOptions
{
    /// <summary>Aprova Pix/boleto pendentes automaticamente após N segundos (0 = nunca). Demo de polling.</summary>
    public int AutoApproveAfterSeconds { get; set; } = 20;
    /// <summary>Cartões com este final são recusados (demo).</summary>
    public string DeclinedLast4 { get; set; } = "0000";
    /// <summary>Segredo do webhook fake (`POST /webhooks/payments` com header X-Signature = HMAC-SHA256 do corpo).</summary>
    public string WebhookSecret { get; set; } = "dev-webhook-secret";
}

/// <summary>Gateway de testes: não movimenta dinheiro. Replica o comportamento do mock do front.</summary>
public sealed class FakePaymentGateway(IOptions<FakePaymentOptions> options, ILinkBuilder links) : IPaymentGateway
{
    public string Name => "fake";

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

    public Task<PaymentStatus> GetStatusAsync(string gatewayPaymentId, CancellationToken ct) => Task.FromResult(PaymentStatus.Pendente);

    public Task RefundAsync(string gatewayPaymentId, Domain.Common.Money amount, CancellationToken ct) => Task.CompletedTask;

    /// <summary>Corpo: WebhookEventDto { id, type: "payment.approved|declined|expired|refunded", occurredAt, payload: { paymentId } }.</summary>
    public Task<GatewayPaymentEvent?> ParseWebhookAsync(WebhookRequest request, CancellationToken ct)
    {
        if (!request.Headers.TryGetValue("x-signature", out var signature) || !WebhookSignature.IsValid(options.Value.WebhookSecret, request.Body, signature))
            throw new UnauthorizedAccessException("Assinatura inválida.");
        using var doc = JsonDocument.Parse(request.Body);
        var root = doc.RootElement;
        var type = root.GetProperty("type").GetString() ?? string.Empty;
        var id = root.GetProperty("id").GetString() ?? Guid.NewGuid().ToString();
        var payload = root.GetProperty("payload");
        Guid? paymentId = payload.TryGetProperty("paymentId", out var pid) && Guid.TryParse(pid.GetString(), out var g) ? g : null;
        PaymentStatus? status = type switch
        {
            "payment.approved" => PaymentStatus.Aprovado,
            "payment.declined" => PaymentStatus.Recusado,
            "payment.expired" => PaymentStatus.Expirado,
            "payment.refunded" => PaymentStatus.Estornado,
            _ => null,
        };
        if (status is null) return Task.FromResult<GatewayPaymentEvent?>(null);
        var occurredAt = root.TryGetProperty("occurredAt", out var at) && at.TryGetDateTime(out var dt) ? dt.ToUniversalTime() : DateTime.UtcNow;
        return Task.FromResult<GatewayPaymentEvent?>(new GatewayPaymentEvent(id, type, null, paymentId, status, occurredAt, request.Body));
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

    public static bool IsValid(string secret, string body, string? provided)
    {
        if (string.IsNullOrWhiteSpace(provided)) return false;
        var expected = Compute(secret, body);
        var given = provided.Trim().ToLowerInvariant();
        if (given.StartsWith("sha256=")) given = given[7..];
        return expected.Length == given.Length &&
               System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                   System.Text.Encoding.ASCII.GetBytes(expected), System.Text.Encoding.ASCII.GetBytes(given));
    }
}
