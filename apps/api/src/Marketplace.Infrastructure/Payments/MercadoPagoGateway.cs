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
    /// <summary>URL pública que o Mercado Pago chama (ex.: https://api.seudominio.com/api/webhooks/payments/mercadopago).</summary>
    public string? NotificationUrl { get; set; }
    /// <summary>Id do meio de pagamento para boleto (bolbradesco no Brasil).</summary>
    public string BoletoMethodId { get; set; } = "bolbradesco";
    public string StatementDescriptor { get; set; } = "MKTPY";
    /// <summary>Rejeita webhooks sem assinatura válida. Só desligue em sandbox local.</summary>
    public bool RequireSignature { get; set; } = true;
    /// <summary>Tolerância do timestamp da assinatura (proteção contra replay).</summary>
    public int SignatureToleranceMinutes { get; set; } = 10;
}

/// <summary>
/// Adapter Mercado Pago (API v1 /payments). A cobrança é recebida pela conta da plataforma; o repasse aos
/// vendedores é feito pelo ledger de payouts. Cartão: o front tokeniza com o SDK JS (token) — o PAN nunca chega aqui.
/// </summary>
public sealed class MercadoPagoGateway(
    HttpClient http,
    IOptions<MercadoPagoOptions> options,
    TimeProvider clock,
    ILogger<MercadoPagoGateway> logger) : IPaymentGateway
{
    public const string GatewayName = "mercadopago";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public string Name => GatewayName;

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
                body["date_of_expiration"] = FormatExpiration(request.ExpiresAt);
                break;
            case PaymentMethod.Boleto:
                body["payment_method_id"] = options.Value.BoletoMethodId;
                body["date_of_expiration"] = FormatExpiration(request.ExpiresAt);
                break;
            case PaymentMethod.Cartao:
                var card = request.Card ?? throw new InvalidOperationException("Cartão obrigatório.");
                body["token"] = card.Token;
                body["installments"] = card.Installments;
                body["payment_method_id"] = MapPaymentMethodId(card.Brand);
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
            boleto = new BoletoDetails(barcode, BoletoFormats.DigitableLine(barcode), pdf, request.ExpiresAt);
        }
        if (request.Method == PaymentMethod.Cartao && request.Card is { } c)
        {
            var last4 = root.TryGetProperty("card", out var cardEl) && cardEl.TryGetProperty("last_four_digits", out var l4) ? l4.GetString() ?? c.Last4 : c.Last4;
            cardDetails = new CardDetails(c.Brand, last4, c.Installments, request.Amount.InstallmentAmount(c.Installments));
        }
        var failure = status == PaymentStatus.Recusado ? root.TryGetProperty("status_detail", out var det) ? det.GetString() : "rejected" : null;
        return new CreatePaymentResult(status, id, pix, boleto, cardDetails, failure);
    }

    public async Task<GatewayPaymentStatus> GetStatusAsync(string gatewayPaymentId, CancellationToken ct)
    {
        using var response = await http.SendAsync(Request(HttpMethod.Get, $"/v1/payments/{gatewayPaymentId}"), ct);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        var status = MapStatus(root.GetProperty("status").GetString(), root.TryGetProperty("status_detail", out var sd) ? sd.GetString() : null);
        var currency = root.TryGetProperty("currency_id", out var cur) && Enum.TryParse<CurrencyCode>(cur.GetString(), true, out var code) ? code : CurrencyCode.BRL;
        Money? amount = root.TryGetProperty("transaction_amount", out var ta) && ta.TryGetDecimal(out var dec) ? FromDecimal(dec, currency) : null;
        DateTime? paidAt = root.TryGetProperty("date_approved", out var da) && da.ValueKind == JsonValueKind.String && da.TryGetDateTimeOffset(out var dto) ? dto.UtcDateTime : null;
        var reference = root.TryGetProperty("external_reference", out var er) && er.ValueKind == JsonValueKind.String ? er.GetString() : null;
        return new GatewayPaymentStatus(status, amount, paidAt, reference);
    }

    public async Task<GatewayRefundResult> RefundAsync(string gatewayPaymentId, Money amount, string idempotencyKey, CancellationToken ct)
    {
        using var response = await http.SendAsync(
            Request(HttpMethod.Post, $"/v1/payments/{gatewayPaymentId}/refunds", new { amount = ToDecimal(amount) }, idempotencyKey), ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Mercado Pago refund {Status}: {Body}", (int)response.StatusCode, text);
            throw new HttpRequestException($"Mercado Pago respondeu {(int)response.StatusCode} ao estornar.");
        }
        using var doc = JsonDocument.Parse(text);
        var refundId = doc.RootElement.TryGetProperty("id", out var id) ? id.GetRawText().Trim('"') : null;
        return new GatewayRefundResult(refundId, null);
    }

    /// <summary>
    /// Webhook: query `data.id`/`type`, headers `x-signature` (ts=…,v1=…) e `x-request-id`.
    /// Manifest: "id:{data.id};request-id:{x-request-id};ts:{ts};" → HMAC-SHA256 com o segredo. O status não vem no
    /// evento: o PaymentService consulta a cobrança (GetStatusAsync) antes de aplicar.
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

        var requestId = request.Headers.GetValueOrDefault("x-request-id");
        if (!string.IsNullOrEmpty(options.Value.WebhookSecret))
        {
            if (!request.Headers.TryGetValue("x-signature", out var signature) || !ValidateSignature(signature, dataId, requestId))
                throw new UnauthorizedAccessException("Assinatura do webhook inválida.");
        }
        else if (options.Value.RequireSignature)
        {
            throw new UnauthorizedAccessException("Webhook do Mercado Pago sem segredo configurado (Payments:MercadoPago:WebhookSecret).");
        }

        var id = eventId is not null ? $"{eventId}:{dataId}"
            : requestId is not null ? $"{requestId}:{dataId}"
            : $"{dataId}:{type}";
        return Task.FromResult<GatewayPaymentEvent?>(new GatewayPaymentEvent(id, type, dataId, null, null, clock.GetUtcNow().UtcDateTime, request.Body));
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
        if (long.TryParse(ts, NumberStyles.Integer, CultureInfo.InvariantCulture, out var tsValue))
        {
            // O Mercado Pago envia ts em milissegundos; tolera segundos por segurança.
            var sent = tsValue > 1_000_000_000_000 ? DateTimeOffset.FromUnixTimeMilliseconds(tsValue) : DateTimeOffset.FromUnixTimeSeconds(tsValue);
            var tolerance = TimeSpan.FromMinutes(Math.Max(1, options.Value.SignatureToleranceMinutes));
            if ((clock.GetUtcNow() - sent).Duration() > tolerance) return false;
        }
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

    /// <summary>Bandeira (como o front detecta) → payment_method_id do Mercado Pago. Ids já no formato MP passam direto.</summary>
    public static string MapPaymentMethodId(string brand) => brand.Trim().ToLowerInvariant() switch
    {
        "visa" => "visa",
        "mastercard" or "master" => "master",
        "amex" or "american express" => "amex",
        "elo" => "elo",
        "hipercard" => "hipercard",
        "diners" or "diners club" => "diners",
        var other => other.Replace(" ", string.Empty),
    };

    private static string FormatExpiration(DateTime utc) =>
        utc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'-00:00'", CultureInfo.InvariantCulture);

    private static decimal ToDecimal(Money m) => m.Amount / (decimal)Math.Pow(10, Money.MinorDigits(m.Currency));

    private static Money FromDecimal(decimal value, CurrencyCode currency) =>
        new((long)Math.Round(value * (decimal)Math.Pow(10, Money.MinorDigits(currency)), MidpointRounding.AwayFromZero), currency);
}

/// <summary>Formatação de boleto bancário (FEBRABAN).</summary>
public static class BoletoFormats
{
    /// <summary>
    /// Linha digitável (47 dígitos, 5 campos) a partir do código de barras (44 dígitos), ou formata uma linha que já
    /// veio com 47. Qualquer outro tamanho é devolvido como está.
    /// </summary>
    public static string DigitableLine(string raw)
    {
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length == 47) return Format47(digits);
        if (digits.Length != 44) return raw;

        var free = digits[19..];
        var f1 = digits[..4] + free[..5];
        f1 += Mod10(f1);
        var f2 = free[5..15];
        f2 += Mod10(f2);
        var f3 = free[15..25];
        f3 += Mod10(f3);
        var f4 = digits[4..5];
        var f5 = digits[5..19];
        return Format47(f1 + f2 + f3 + f4 + f5);
    }

    private static string Format47(string d) =>
        $"{d[..5]}.{d[5..10]} {d[10..15]}.{d[15..21]} {d[21..26]}.{d[26..32]} {d[32..33]} {d[33..]}";

    /// <summary>Dígito verificador módulo 10 (pesos 2 e 1 da direita para a esquerda, somando os dígitos dos produtos).</summary>
    public static char Mod10(string digits)
    {
        var sum = 0;
        var weight = 2;
        for (var i = digits.Length - 1; i >= 0; i--)
        {
            var product = (digits[i] - '0') * weight;
            sum += product > 9 ? product - 9 : product;
            weight = weight == 2 ? 1 : 2;
        }
        return (char)('0' + (10 - sum % 10) % 10);
    }
}
