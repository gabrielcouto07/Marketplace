using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Marketplace.Tests.Integration;

public sealed class BuyerFlowTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private static readonly JsonSerializerOptions Json = ApiFactory.Json;

    public BuyerFlowTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Home_ReturnsSeededCatalog()
    {
        var client = _factory.CreateClient();
        var home = await client.GetFromJsonAsync<JsonElement>("/api/home", Json);
        Assert.Equal(8, home.GetProperty("categories").GetArrayLength());
        Assert.Equal(12, home.GetProperty("offers").GetArrayLength());
        var first = home.GetProperty("offers")[0];
        Assert.Equal("BRL", first.GetProperty("price").GetProperty("currency").GetString());
        Assert.Equal("PYG", first.GetProperty("referencePrice").GetProperty("currency").GetString());
        Assert.EndsWith("Z", first.GetProperty("createdAt").GetString());
    }

    [Fact]
    public async Task Search_FiltersAndFacets()
    {
        var client = _factory.CreateClient();
        var result = await client.GetFromJsonAsync<JsonElement>("/api/products?categorySlug=perfumes&sort=priceDesc&pageSize=3", Json);
        Assert.Equal(8, result.GetProperty("totalCount").GetInt32());
        Assert.Equal(3, result.GetProperty("items").GetArrayLength());
        var prices = result.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("price").GetProperty("amount").GetInt64()).ToList();
        Assert.Equal(prices.OrderByDescending(p => p), prices);
        Assert.Single(result.GetProperty("facets").GetProperty("categories").EnumerateArray());

        var missing = await client.GetAsync("/api/products?categorySlug=nao-existe");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoints_Return401AsProblemJson()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/orders");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("UNAUTHORIZED", problem.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsFieldError()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = "demo@mktpy.com", password = "x" }, Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.True(problem.GetProperty("errors").TryGetProperty("password", out _));
    }

    [Fact]
    public async Task FullPurchase_PixApprovedThenCancelledWithRefund()
    {
        var client = await _factory.LoginAsync();

        var product = await client.GetFromJsonAsync<JsonElement>("/api/products/smart-tv-55-4k-uhd-com-hdr-e-sistema-inteligente-ele1", Json);
        var productId = product.GetProperty("id").GetGuid();
        var sellerId = product.GetProperty("seller").GetProperty("id").GetGuid();
        var variant = product.GetProperty("variants").EnumerateArray().First(v => v.GetProperty("stock").GetInt32() > 0);
        var variantId = variant.GetProperty("id").GetGuid();
        var stockBefore = variant.GetProperty("stock").GetInt32();

        var addresses = await client.GetFromJsonAsync<JsonElement>("/api/me/addresses", Json);
        var addressId = addresses.EnumerateArray().First(a => a.GetProperty("isDefault").GetBoolean()).GetProperty("id").GetGuid();

        var quoteRequest = new
        {
            postalCode = "01310-100",
            couponCode = "paraguai10",
            groups = new[] { new { sellerId, shippingOptionId = (Guid?)null, items = new[] { new { productId, variantId, quantity = 1 } } } },
        };
        var quoteResponse = await client.PostAsJsonAsync("/api/checkout/quotes", quoteRequest, Json);
        Assert.Equal(HttpStatusCode.OK, quoteResponse.StatusCode);
        var quote = await quoteResponse.Content.ReadFromJsonAsync<JsonElement>(Json);
        var subtotal = quote.GetProperty("subtotal").GetProperty("amount").GetInt64();
        var shipping = quote.GetProperty("shippingTotal").GetProperty("amount").GetInt64();
        var discount = quote.GetProperty("discount").GetProperty("amount").GetInt64();
        var tax = quote.GetProperty("estimatedImportTax").GetProperty("amount").GetInt64();
        var total = quote.GetProperty("total").GetProperty("amount").GetInt64();
        Assert.Equal(subtotal / 10, discount);
        Assert.Equal((subtotal + shipping - discount) * 6000 / 10000, tax);
        Assert.Equal(subtotal + shipping - discount + tax, total);
        Assert.Equal("PYG", quote.GetProperty("totalReference").GetProperty("currency").GetString());

        var order = new
        {
            quoteId = quote.GetProperty("quoteId").GetGuid(),
            addressId,
            exchangeRateId = quote.GetProperty("exchangeRate").GetProperty("id").GetGuid(),
            idempotencyKey = Guid.NewGuid().ToString(),
            groups = new[] { new { sellerId, shippingOptionId = quote.GetProperty("groups")[0].GetProperty("selectedShippingOptionId").GetGuid(), items = new[] { new { productId, variantId, quantity = 1 } } } },
            payment = new { method = "Pix", payerDocument = "529.982.247-25" },
        };
        var placed = await client.PostAsJsonAsync("/api/orders", order, Json);
        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        var response = await placed.Content.ReadFromJsonAsync<JsonElement>(Json);
        var orderId = response.GetProperty("orders")[0].GetProperty("id").GetGuid();
        var paymentId = response.GetProperty("payment").GetProperty("id").GetGuid();
        Assert.Equal("AguardandoPagamento", response.GetProperty("orders")[0].GetProperty("status").GetString());
        Assert.Equal(total, response.GetProperty("orders")[0].GetProperty("totals").GetProperty("total").GetProperty("amount").GetInt64());
        Assert.Equal("Pendente", response.GetProperty("payment").GetProperty("status").GetString());
        Assert.StartsWith("00020126", response.GetProperty("payment").GetProperty("pix").GetProperty("qrCodePayload").GetString());

        // Idempotência: mesma chave → mesma compra
        var replay = await client.PostAsJsonAsync("/api/orders", order, Json);
        Assert.Equal(HttpStatusCode.Created, replay.StatusCode);
        var replayed = await replay.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal(response.GetProperty("purchaseId").GetGuid(), replayed.GetProperty("purchaseId").GetGuid());

        // Estoque reservado
        var after = await client.GetFromJsonAsync<JsonElement>("/api/products/smart-tv-55-4k-uhd-com-hdr-e-sistema-inteligente-ele1", Json);
        Assert.Equal(stockBefore - 1, after.GetProperty("variants").EnumerateArray().First(v => v.GetProperty("id").GetGuid() == variantId).GetProperty("stock").GetInt32());

        // Webhook-like approval (fake gateway)
        var approve = await client.PostAsync($"/api/payments/{paymentId}/simulate-approval", null);
        Assert.Equal(HttpStatusCode.OK, approve.StatusCode);
        var detail = await client.GetFromJsonAsync<JsonElement>($"/api/orders/{orderId}", Json);
        Assert.Equal("Pago", detail.GetProperty("status").GetString());
        Assert.Equal(["AguardandoPagamento", "Pago"], detail.GetProperty("timeline").EnumerateArray().Select(t => t.GetProperty("status").GetString()!).ToArray());

        // Cancelamento de pedido pago → estorno
        var cancel = await client.PostAsync($"/api/orders/{orderId}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);
        var payment = await client.GetFromJsonAsync<JsonElement>($"/api/payments/{paymentId}", Json);
        Assert.Equal("Estornado", payment.GetProperty("status").GetString());
        var restored = await client.GetFromJsonAsync<JsonElement>("/api/products/smart-tv-55-4k-uhd-com-hdr-e-sistema-inteligente-ele1", Json);
        Assert.Equal(stockBefore, restored.GetProperty("variants").EnumerateArray().First(v => v.GetProperty("id").GetGuid() == variantId).GetProperty("stock").GetInt32());

        var again = await client.PostAsync($"/api/orders/{orderId}/cancel", null);
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task DeclinedCard_CancelsOrders()
    {
        var client = await _factory.LoginAsync();
        var search = await client.GetFromJsonAsync<JsonElement>("/api/products?categorySlug=bebidas&pageSize=1", Json);
        var item = search.GetProperty("items")[0];
        var product = await client.GetFromJsonAsync<JsonElement>($"/api/products/{item.GetProperty("slug").GetString()}", Json);
        var variants = product.GetProperty("variants");
        Guid? variantId = variants.GetArrayLength() == 0 ? null : variants.EnumerateArray().First(v => v.GetProperty("stock").GetInt32() > 0).GetProperty("id").GetGuid();
        var productId = product.GetProperty("id").GetGuid();
        var sellerId = product.GetProperty("seller").GetProperty("id").GetGuid();
        var addresses = await client.GetFromJsonAsync<JsonElement>("/api/me/addresses", Json);
        var addressId = addresses[0].GetProperty("id").GetGuid();

        var quote = await (await client.PostAsJsonAsync("/api/checkout/quotes",
            new { postalCode = "80010010", groups = new[] { new { sellerId, shippingOptionId = (Guid?)null, items = new[] { new { productId, variantId, quantity = 1 } } } } }, Json))
            .Content.ReadFromJsonAsync<JsonElement>(Json);

        var placed = await client.PostAsJsonAsync("/api/orders", new
        {
            quoteId = quote.GetProperty("quoteId").GetGuid(),
            addressId,
            exchangeRateId = quote.GetProperty("exchangeRate").GetProperty("id").GetGuid(),
            idempotencyKey = Guid.NewGuid().ToString(),
            groups = new[] { new { sellerId, shippingOptionId = (Guid?)null, items = new[] { new { productId, variantId, quantity = 1 } } } },
            payment = new { method = "Cartao", payerDocument = "52998224725", card = new { token = "tok_test", holderName = "Gabriel Demo", brand = "Visa", last4 = "0000", installments = 3 } },
        }, Json);
        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        var response = await placed.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("Recusado", response.GetProperty("payment").GetProperty("status").GetString());
        Assert.Equal("Cancelado", response.GetProperty("orders")[0].GetProperty("status").GetString());
    }

    [Fact]
    public async Task Lgpd_ExportAndConsents()
    {
        var client = await _factory.LoginAsync();
        var export = await client.GetFromJsonAsync<JsonElement>("/api/me/data-export", Json);
        Assert.Equal("demo@mktpy.com", export.GetProperty("profile").GetProperty("email").GetString());
        Assert.True(export.GetProperty("orders").GetArrayLength() >= 11);
        Assert.Equal(2, export.GetProperty("consents").GetArrayLength());

        var policy = await client.GetFromJsonAsync<JsonElement>("/api/privacy/policy", Json);
        Assert.False(string.IsNullOrEmpty(policy.GetProperty("privacyPolicyUrl").GetString()));
    }

    [Fact]
    public async Task Register_RefreshRotation_AndDeleteAccount()
    {
        var anon = _factory.CreateClient();
        var email = $"user-{Guid.NewGuid():N}@example.com";
        var registered = await anon.PostAsJsonAsync("/api/auth/register", new { fullName = "Usuária Teste", email, phone = "11999999999", password = "senhaForte1" }, Json);
        Assert.Equal(HttpStatusCode.Created, registered.StatusCode);
        var session = await registered.Content.ReadFromJsonAsync<JsonElement>(Json);
        var refresh = session.GetProperty("refreshToken").GetString();

        var rotated = await anon.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = refresh }, Json);
        Assert.Equal(HttpStatusCode.OK, rotated.StatusCode);
        var reused = await anon.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = refresh }, Json);
        Assert.Equal(HttpStatusCode.Unauthorized, reused.StatusCode);

        var client = await _factory.LoginAsync(email, "senhaForte1");
        var wrong = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/me") { Content = JsonContent.Create(new { password = "errada" }, options: Json) });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, wrong.StatusCode);
        var deleted = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/me") { Content = JsonContent.Create(new { password = "senhaForte1" }, options: Json) });
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        var loginAfter = await anon.PostAsJsonAsync("/api/auth/login", new { email, password = "senhaForte1" }, Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, loginAfter.StatusCode);
    }
}
