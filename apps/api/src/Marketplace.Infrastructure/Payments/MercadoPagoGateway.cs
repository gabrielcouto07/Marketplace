using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Marketplace.Application.Abstractions;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Payments;

public sealed class MercadoPagoOptions
{
    public string BaseUrl { get; set; } = "https://api.mercadopago.com";
    /// <summary>Access token da conta da plataforma (TEST-… no sandbox).</summary>
    public string AccessToken { get; set; } = string.Empty;
    /// <summary>Segredo configurado no painel de webhooks (assinatura x-signature).</summary>
    public string? WebhookSecret { get; set; }
    /// <summary>URL pública que o Mercado Pago chama (ex.: https://api.seudominio.com/api/webhooks/payments).</summary>
    public string? NotificationUrl { get; set; }
    /// <summary>Id do meio de pagamento para boleto (bolbradesco no Brasil).</summary>
    public string BoletoMethodId { get; set; } = "bolbradesco";
    public string StatementDescriptor { get; set; } = "MKTPY";
}

/// <summary>
/// Adapter Mercado Pago (API v1 /payments). A cobrança é recebida pela conta da plataforma; o repasse aos
/// vendedores é feito pelo ledger de payouts. Cartão: o front tokeniza com o SDK JS (token) — o PAN nunca chega aqui.
/// </summary>
public sealed class MercadoPagoGateway(HttpClient http, IOptions<MercadoPagoOptions> options, ILogger<MercadoPagoGateway> logger)
    : IPaymentGateway
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public string Name => "mercadopago";

    private HttpRequestMessage Request(HttpMethod method, string path, object? body = null, string? idempotencyKey = null)
    {
        var req = new HttpRequestMessage(method, $"{options.Value.BaseUrl.TrimEnd('/')}{path}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.Value.AccessToken);
        if (idempotencyKey is not null) req.Headers.Add("X-Idempotency-Key", idempotencyKey);
        if (body is not null) req.Content = JsonContent.Create(body, options: Json);
        return req;
    }

    public async Task<CreatePaymentResult> CreatePaymentAsync(CreatePaymentRequest request, CancellationToken ct)
    {
        var names = request.PayerName.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        var body = new Dictionary<string, object?>
        {
            ["transaction_amount"] = ToDecimal(request.Amount),
            ["description"] = request.Description,
            ["external_reference"] = request.PaymentId.ToString(),
            ["notification_url"] = options.Value.NotificationUrl,
            ["statement_descriptor"] = options.Value.StatementDescriptor,
            ["metadata"] = new { payment_id = request.PaymentId, purchase_id = request.PurchaseId },
            ["payer"] = new
            {
                email = request.PayerEmail,
                first_name = names.ElementAtOrDefault(0) ?? request.PayerName,
                last_name = names.ElementAtOrDefault(1) ?? "-",
                identification = new { type = "CPF", number = request.PayerDocument },
            },
        };
        switch (request.Method)
        {
            case PaymentMethod.Pix:
                body["payment_method_id"] = "pix";
                body["date_of_expiration"] = request.ExpiresAt.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'-00:00'", CultureInfo.InvariantCulture);
                break;
            case PaymentMethod.Boleto:
                body["payment_method_id"] = options.Value.BoletoMethodId;
                body["date_of_expiration"] = request.ExpiresAt.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'-00:00'", CultureInfo.InvariantCulture);
                break;
            case PaymentMethod.Cartao:
                var card = request.Card ?? throw new InvalidOperationException("Cartão obrigatório.");
                body["token"] = card.Token;
                body["installments"] = card.Installments;
                body["payment_method_id"] = card.Brand.ToLowerInvariant();
                body["capture"] = true;
                break;
        }

        using var response = await http.SendAsync(Request(HttpMethod.Post, "/v1/payments", body, request.PaymentId.ToString()), ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Mercado Pago {Status}: {Body}", (int)response.StatusCode, text);
            throw new HttpRequestException($"Mercado Pago respondeu {(int)response.StatusCode}.");
        }
        using var doc = JsonDocument.Parse(text);
        var root = doc.RootElement;
        var status = MapStatus(root.GetProperty("status").GetString(), root.TryGetProperty("status_detail", out var sd) ? sd.GetString() : null);
        var id = root.GetProperty("id").GetRawText().Trim('"');

        PixDetails? pix = null;
        BoletoDetails? boleto = null;
        CardDetails? cardDetails = null;
        if (request.Method == PaymentMethod.Pix && root.TryGetProperty("point_of_interaction", out var poi)
            && poi.TryGetProperty("transaction_data", out var td))
        {
            var qr = td.GetProperty("qr_code").GetString() ?? string.Empty;
            var b64 = td.TryGetProperty("qr_code_base64", out var q64) ? q64.GetString() : null;
            pix = new PixDetails(qr, b64 is null ? null : $"data:image/png;base64,{b64}", request.ExpiresAt);
        }
        if (request.Method == PaymentMethod.Boleto)
        {
            var barcode = root.TryGetProperty("barcode", out var bc) && bc.TryGetProperty("content", out var content) ? content.GetString() ?? "" : "";
            var pdf = root.TryGetProperty("transaction_details", out var tdet) && tdet.TryGetProperty("external_resource_url", out var url) ? url.GetString() ?? "" : "";
            boleto = new BoletoDetails(barcode, FormatDigitableLine(barcode), pdf, request.ExpiresAt);
        }
        if (request.Method == PaymentMethod.Cartao && request.Card is { } c)
        {
            var last4 = root.TryGetProperty("card", out var cardEl) && cardEl.TryGetProperty("last_four_digits", out var l4) ? l4.GetString() ?? c.Last4 : c.Last4;
            cardDetails = new CardDetails(c.Brand, last4, c.Installments, request.Amount.InstallmentAmount(c.Installments));
        }
        var failure = status == PaymentStatus.Recusado ? root.TryGetProperty("status_detail", out var det) ? det.GetString() : "rejected" : null;
        return new CreatePaymentResult(status, id, pix, boleto, cardDetails, failure);
    }

    public async Task<PaymentStatus> GetStatusAsync(string gatewayPaymentId, CancellationToken ct)
    {
        using var response = await http.SendAsync(Request(HttpMethod.Get, $"/v1/payments/{gatewayPaymentId}"), ct);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        return MapStatus(root.GetProperty("status").GetString(), root.TryGetProperty("status_detail", out var sd) ? sd.GetString() : null);
    }

    public async Task RefundAsync(string gatewayPaymentId, Money amount, CancellationToken ct)
    {
        using var response = await http.SendAsync(
            Request(HttpMethod.Post, $"/v1/payments/{gatewayPaymentId}/refunds", new { amount = ToDecimal(amount) }, Guid.NewGuid().ToString()), ct);
        response.EnsureSuccessStatusCode();
    }

    /// <summary>
    /// Webhook: query `data.id`/`type`, headers `x-signature` (ts=…,v1=…) e `x-request-id`.
    /// Manifest: "id:{data.id};request-id:{x-request-id};ts:{ts};" → HMAC-SHA256 com o segredo.
    /// </summary>
    public Task<GatewayPaymentEvent?> ParseWebhookAsync(WebhookRequest request, CancellationToken ct)
    {
        string? dataId = null;
        string? type = null;
        string? eventId = null;
        if (request.Query.TryGetValue("data.id", out var qid)) dataId = qid;
        if (request.Query.TryGetValue("type", out var qt)) type = qt;
        if (!string.IsNullOrWhiteSpace(request.Body))
        {
            using var doc = JsonDocument.Parse(request.Body);
            var root = doc.RootElement;
            if (root.TryGetProperty("data", out var data) && data.TryGetProperty("id", out var did)) dataId ??= did.ToString();
            if (root.TryGetProperty("type", out var t)) type ??= t.GetString();
            if (root.TryGetProperty("action", out var action)) type ??= action.GetString();
            if (root.TryGetProperty("id", out var idEl)) eventId = idEl.ToString();
        }
        if (dataId is null || type is null || !type.StartsWith("payment", StringComparison.OrdinalIgnoreCase))
            return Task.FromResult<GatewayPaymentEvent?>(null);

        if (!string.IsNullOrEmpty(options.Value.WebhookSecret))
        {
            if (!request.Headers.TryGetValue("x-signature", out var signature) || !ValidateSignature(signature, dataId, request.Headers.GetValueOrDefault("x-request-id")))
                throw new UnauthorizedAccessException("Assinatura do webhook inválida.");
        }
        var id = eventId is null ? $"{dataId}:{DateTime.UtcNow.Ticks}" : $"{eventId}:{dataId}";
        return Task.FromResult<GatewayPaymentEvent?>(new GatewayPaymentEvent(id, type, dataId, null, null, DateTime.UtcNow, request.Body));
    }

    private bool ValidateSignature(string header, string dataId, string? requestId)
    {
        string? ts = null, v1 = null;
        foreach (var part in header.Split(','))
        {
            var kv = part.Split('=', 2);
            if (kv.Length != 2) continue;
            if (kv[0].Trim() == "ts") ts = kv[1].Trim();
            if (kv[0].Trim() == "v1") v1 = kv[1].Trim();
        }
        if (ts is null || v1 is null) return false;
        var manifest = $"id:{dataId.ToLowerInvariant()};request-id:{requestId};ts:{ts};";
        var expected = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(options.Value.WebhookSecret!), Encoding.UTF8.GetBytes(manifest)));
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(v1.ToLowerInvariant()));
    }

    private static PaymentStatus MapStatus(string? status, string? detail) => status switch
    {
        "approved" => PaymentStatus.Aprovado,
        "refunded" or "charged_back" => PaymentStatus.Estornado,
        "cancelled" when detail == "expired" => PaymentStatus.Expirado,
        "cancelled" or "rejected" => PaymentStatus.Recusado,
        _ => PaymentStatus.Pendente,
    };

    private static decimal ToDecimal(Money m) => m.Amount / (decimal)Math.Pow(10, Money.MinorDigits(m.Currency));

    private static string FormatDigitableLine(string barcode) =>
        barcode.Length == 47
            ? $"{barcode[..5]}.{barcode[5..10]} {barcode[10..15]}.{barcode[15..21]} {barcode[21..26]}.{barcode[26..32]} {barcode[32..33]} {barcode[33..]}"
            : barcode;
}
