using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Marketplace.Tests.Integration;

/// <summary>Painel do vendedor (demo é dona da MegaStore Paraguay): perguntas, repasses e cancelamento pela loja.</summary>
public sealed class SellerPanelTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private static readonly JsonSerializerOptions Json = ApiFactory.Json;

    public SellerPanelTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Questions_ListAndAnswer_ShowUpOnProductPage()
    {
        var client = await _factory.LoginAsync();
        var list = await client.GetFromJsonAsync<JsonElement>("/api/seller/questions?unanswered=true&pageSize=5", Json);
        Assert.True(list.GetProperty("totalCount").GetInt32() > 0, "o seed tem perguntas sem resposta para a MegaStore");
        var question = list.GetProperty("items")[0];
        Assert.Equal(JsonValueKind.Null, question.GetProperty("answer").ValueKind);
        Assert.False(string.IsNullOrEmpty(question.GetProperty("productName").GetString()));
        var id = question.GetProperty("id").GetString();
        var productId = question.GetProperty("productId").GetString();

        var empty = await client.PostAsJsonAsync($"/api/seller/questions/{id}/answer", new { text = " " }, Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, empty.StatusCode);

        var answered = await client.PostAsJsonAsync($"/api/seller/questions/{id}/answer", new { text = "Sim, compatível com 110 V e 220 V." }, Json);
        Assert.Equal(HttpStatusCode.OK, answered.StatusCode);
        var dto = await answered.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("Sim, compatível com 110 V e 220 V.", dto.GetProperty("answer").GetProperty("text").GetString());

        // Comprador vê a resposta na página pública do produto.
        var anon = _factory.CreateClient();
        var pub = await anon.GetFromJsonAsync<JsonElement>($"/api/products/{productId}/questions?pageSize=60", Json);
        var match = pub.GetProperty("items").EnumerateArray().First(q => q.GetProperty("id").GetString() == id);
        Assert.Equal("Sim, compatível com 110 V e 220 V.", match.GetProperty("answer").GetProperty("text").GetString());

        // Pergunta de outra loja: 404 (sem vazar que existe).
        var others = await anon.GetFromJsonAsync<JsonElement>("/api/products?sellerSlug=nippon-center&pageSize=1", Json);
        var otherProductId = others.GetProperty("items")[0].GetProperty("id").GetString();
        var otherQuestions = await anon.GetFromJsonAsync<JsonElement>($"/api/products/{otherProductId}/questions?pageSize=1", Json);
        if (otherQuestions.GetProperty("items").GetArrayLength() > 0)
        {
            var foreignId = otherQuestions.GetProperty("items")[0].GetProperty("id").GetString();
            var forbidden = await client.PostAsJsonAsync($"/api/seller/questions/{foreignId}/answer", new { text = "não é minha" }, Json);
            Assert.Equal(HttpStatusCode.NotFound, forbidden.StatusCode);
        }
    }

    [Fact]
    public async Task Payouts_ListAndSummary_OnlyOwnStore()
    {
        var client = await _factory.LoginAsync();
        var summary = await client.GetFromJsonAsync<JsonElement>("/api/seller/payouts/summary", Json);
        Assert.Equal("BRL", summary.GetProperty("scheduled").GetProperty("currency").GetString());
        var list = await client.GetFromJsonAsync<JsonElement>("/api/seller/payouts?pageSize=50", Json);
        foreach (var payout in list.GetProperty("items").EnumerateArray())
        {
            Assert.Equal("MegaStore Paraguay", payout.GetProperty("sellerName").GetString());
            var gross = payout.GetProperty("gross").GetProperty("amount").GetInt64();
            var fees = payout.GetProperty("platformFee").GetProperty("amount").GetInt64() + payout.GetProperty("paymentFee").GetProperty("amount").GetInt64();
            Assert.Equal(gross - fees, payout.GetProperty("net").GetProperty("amount").GetInt64());
        }

        var buyerOnly = _factory.CreateClient();
        var anon = await buyerOnly.GetAsync("/api/seller/payouts");
        Assert.Equal(HttpStatusCode.Unauthorized, anon.StatusCode);
    }

    [Fact]
    public async Task SellerCancel_PaidOrder_RefundsAndRestocks()
    {
        var client = await _factory.LoginAsync();
        var addresses = await client.GetFromJsonAsync<JsonElement>("/api/me/addresses", Json);
        var addressId = addresses[0].GetProperty("id").GetString();
        var profile = await client.GetFromJsonAsync<JsonElement>("/api/seller/profile", Json);
        var sellerId = profile.GetProperty("id").GetString();

        // Compra um produto da própria loja (cartão aprovado) e lê o estoque real pelo painel.
        var mine = await client.GetFromJsonAsync<JsonElement>($"/api/products?sellerSlug={profile.GetProperty("slug").GetString()}&pageSize=10", Json);
        var product = mine.GetProperty("items").EnumerateArray().First(p => p.GetProperty("stock").GetInt32() > 1);
        var productId = product.GetProperty("id").GetString();
        var detail = await client.GetFromJsonAsync<JsonElement>($"/api/products/{product.GetProperty("slug").GetString()}", Json);
        var variantId = detail.GetProperty("variants").GetArrayLength() > 0 ? detail.GetProperty("variants")[0].GetProperty("id").GetString() : null;
        var stockBefore = (await client.GetFromJsonAsync<JsonElement>($"/api/seller/products/{productId}", Json)).GetProperty("stock").GetInt32();

        var items = new[] { new { productId, variantId, quantity = 1 } };
        var quote = await (await client.PostAsJsonAsync("/api/checkout/quotes", new { postalCode = "01310100", groups = new[] { new { sellerId, shippingOptionId = (string?)null, items } } }, Json))
            .Content.ReadFromJsonAsync<JsonElement>(Json);
        var placed = await client.PostAsJsonAsync("/api/orders", new
        {
            quoteId = quote.GetProperty("quoteId").GetString(),
            addressId,
            exchangeRateId = quote.GetProperty("exchangeRate").GetProperty("id").GetString(),
            idempotencyKey = Guid.NewGuid().ToString(),
            groups = new[] { new { sellerId, shippingOptionId = quote.GetProperty("groups")[0].GetProperty("selectedShippingOptionId").GetString(), items } },
            payment = new { method = "Cartao", payerDocument = "52998224725", card = new { token = "tok_test", holderName = "DEMO", brand = "visa", last4 = "4242", installments = 1 } },
        }, Json);
        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        var response = await placed.Content.ReadFromJsonAsync<JsonElement>(Json);
        var order = response.GetProperty("orders")[0];
        Assert.Equal("Pago", order.GetProperty("status").GetString());
        var orderId = order.GetProperty("id").GetString();
        var stockReserved = (await client.GetFromJsonAsync<JsonElement>($"/api/seller/products/{productId}", Json)).GetProperty("stock").GetInt32();
        Assert.Equal(stockBefore - 1, stockReserved);

        var cancelled = await client.PostAsJsonAsync($"/api/seller/orders/{orderId}/cancel", new { reason = "Acabou o estoque" }, Json);
        Assert.Equal(HttpStatusCode.OK, cancelled.StatusCode);
        var dto = await cancelled.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("Cancelado", dto.GetProperty("status").GetString());
        Assert.Contains("Acabou o estoque", dto.GetProperty("timeline").EnumerateArray().Last().GetProperty("description").GetString());

        var stockAfter = (await client.GetFromJsonAsync<JsonElement>($"/api/seller/products/{productId}", Json)).GetProperty("stock").GetInt32();
        Assert.Equal(stockBefore, stockAfter);

        var payment = await client.GetFromJsonAsync<JsonElement>($"/api/payments/{response.GetProperty("payment").GetProperty("id").GetString()}", Json);
        Assert.Equal("Estornado", payment.GetProperty("status").GetString());
        Assert.Equal(payment.GetProperty("amount").GetProperty("amount").GetInt64(), payment.GetProperty("refundedAmount").GetProperty("amount").GetInt64());

        var again = await client.PostAsJsonAsync($"/api/seller/orders/{orderId}/cancel", new { }, Json);
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }
}
