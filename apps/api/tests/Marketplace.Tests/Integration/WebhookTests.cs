using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Marketplace.Infrastructure.Payments;

namespace Marketplace.Tests.Integration;

/// <summary>Webhooks de pagamento (gateway fake) e rastreio (parser genérico) + proteção das rotas de pagamento.</summary>
public sealed class WebhookTests : IClassFixture<ApiFactory>
{
    private const string PaymentSecret = "dev-webhook-secret";
    private const string ShippingSecret = "dev-shipping-secret";

    private readonly ApiFactory _factory;
    private static readonly JsonSerializerOptions Json = ApiFactory.Json;

    public WebhookTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Payment_RequiresSession()
    {
        var anonymous = _factory.CreateClient();
        var response = await anonymous.GetAsync($"/api/payments/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UnknownRoute_IsProblemJson()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/nao-existe");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task PaymentWebhook_RejectsBadSignature_AndApprovesWithGoodOne()
    {
        var client = await _factory.LoginAsync();
        var (orderId, paymentId) = await PlacePixOrderAsync(client);

        var body = JsonSerializer.Serialize(new
        {
            id = $"evt-{Guid.NewGuid():N}",
            type = "payment.approved",
            occurredAt = DateTime.UtcNow,
            payload = new { paymentId },
        }, Json);

        var forged = await PostWebhookAsync(client, "/api/webhooks/payments/fake", body, "deadbeef");
        Assert.Equal(HttpStatusCode.Unauthorized, forged.StatusCode);

        var unsigned = await PostWebhookAsync(client, "/api/webhooks/payments/fake", body, null);
        Assert.Equal(HttpStatusCode.Unauthorized, unsigned.StatusCode);

        var ok = await PostWebhookAsync(client, "/api/webhooks/payments/fake", body, WebhookSignature.Compute(PaymentSecret, body));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);

        // Reenvio do mesmo evento é idempotente.
        var replay = await PostWebhookAsync(client, "/api/webhooks/payments/fake", body, WebhookSignature.Compute(PaymentSecret, body));
        Assert.Equal(HttpStatusCode.OK, replay.StatusCode);

        var order = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{orderId}", Json);
        Assert.Equal("Pago", order.GetProperty("status").GetString());
        var payment = await client.GetFromJsonAsync<JsonElement>($"/api/payments/{paymentId}", Json);
        Assert.Equal("Aprovado", payment.GetProperty("status").GetString());
        Assert.Equal(0, payment.GetProperty("refundedAmount").GetProperty("amount").GetInt64());
    }

    [Fact]
    public async Task PaymentWebhook_UnknownPayment_Returns404SoGatewayRetries()
    {
        var client = _factory.CreateClient();
        var body = JsonSerializer.Serialize(new
        {
            id = $"evt-{Guid.NewGuid():N}",
            type = "payment.approved",
            payload = new { paymentId = Guid.NewGuid() },
        }, Json);
        var response = await PostWebhookAsync(client, "/api/webhooks/payments/fake", body, WebhookSignature.Compute(PaymentSecret, body));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ShippingWebhook_AppliesEventsAndTransitionsOrder()
    {
        var client = await _factory.LoginAsync();
        var shipped = await client.GetFromJsonAsync<JsonElement>("/api/orders?status=Enviado", Json);
        var order = shipped.GetProperty("items").EnumerateArray().First(o => o.GetProperty("trackingCode").ValueKind == JsonValueKind.String);
        var orderId = order.GetProperty("id").GetGuid();
        var trackingCode = order.GetProperty("trackingCode").GetString()!;

        var body = JsonSerializer.Serialize(new
        {
            id = $"ship-{Guid.NewGuid():N}",
            trackingCode,
            carrier = "Correios",
            events = new[]
            {
                new { id = $"{trackingCode}:br-{Guid.NewGuid():N}", code = "ARRIVED_BR", description = "Objeto recebido no Brasil", location = "Curitiba, PR", occurredAt = DateTime.UtcNow },
            },
        }, Json);

        var forged = await PostWebhookAsync(client, "/api/webhooks/shipping", body, "nope");
        Assert.Equal(HttpStatusCode.Unauthorized, forged.StatusCode);

        var ok = await PostWebhookAsync(client, "/api/webhooks/shipping/generic", body, WebhookSignature.Compute(ShippingSecret, body));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var result = await ok.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.True(result.GetProperty("changed").GetBoolean());

        var tracking = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{orderId}/tracking", Json);
        Assert.Contains(tracking.GetProperty("events").EnumerateArray(), e => e.GetProperty("code").GetString() == "ARRIVED_BR");
        Assert.Equal("https://rastreamento.correios.com.br/app/index.php?objetos=" + Uri.EscapeDataString(trackingCode), tracking.GetProperty("trackingUrl").GetString());

        var detail = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{orderId}", Json);
        Assert.Equal("EmTransitoInternacional", detail.GetProperty("status").GetString());

        var unknown = JsonSerializer.Serialize(new { trackingCode = "XX000000000YY", events = Array.Empty<object>() }, Json);
        var missing = await PostWebhookAsync(client, "/api/webhooks/shipping", unknown, WebhookSignature.Compute(ShippingSecret, unknown));
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    private static async Task<HttpResponseMessage> PostWebhookAsync(HttpClient client, string path, string body, string? signature)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        if (signature is not null) request.Headers.Add("X-Signature", signature);
        return await client.SendAsync(request);
    }

    private static async Task<(Guid OrderId, Guid PaymentId)> PlacePixOrderAsync(HttpClient client)
    {
        var product = await client.GetFromJsonAsync<JsonElement>("/api/products/smart-tv-55-4k-uhd-com-hdr-e-sistema-inteligente-ele1", Json);
        var productId = product.GetProperty("id").GetGuid();
        var sellerId = product.GetProperty("seller").GetProperty("id").GetGuid();
        var variantId = product.GetProperty("variants").EnumerateArray().First(v => v.GetProperty("stock").GetInt32() > 0).GetProperty("id").GetGuid();
        var addresses = await client.GetFromJsonAsync<JsonElement>("/api/me/addresses", Json);
        var addressId = addresses.EnumerateArray().First(a => a.GetProperty("isDefault").GetBoolean()).GetProperty("id").GetGuid();

        var quote = await (await client.PostAsJsonAsync("/api/checkout/quotes", new
        {
            postalCode = "01310-100",
            groups = new[] { new { sellerId, shippingOptionId = (Guid?)null, items = new[] { new { productId, variantId, quantity = 1 } } } },
        }, Json)).Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("01310100", quote.GetProperty("postalCode").GetString());
        Assert.Equal("table", quote.GetProperty("groups")[0].GetProperty("shippingOptions")[0].GetProperty("provider").GetString());

        var placed = await client.PostAsJsonAsync("/api/orders", new
        {
            quoteId = quote.GetProperty("quoteId").GetGuid(),
            addressId,
            exchangeRateId = quote.GetProperty("exchangeRate").GetProperty("id").GetGuid(),
            idempotencyKey = Guid.NewGuid().ToString(),
            groups = new[] { new { sellerId, shippingOptionId = quote.GetProperty("groups")[0].GetProperty("selectedShippingOptionId").GetGuid(), items = new[] { new { productId, variantId, quantity = 1 } } } },
            payment = new { method = "Pix", payerDocument = "529.982.247-25" },
        }, Json);
        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        var response = await placed.Content.ReadFromJsonAsync<JsonElement>(Json);
        return (response.GetProperty("orders")[0].GetProperty("id").GetGuid(), response.GetProperty("payment").GetProperty("id").GetGuid());
    }
}
