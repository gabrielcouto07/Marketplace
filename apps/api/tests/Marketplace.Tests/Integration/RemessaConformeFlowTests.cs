using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Marketplace.Domain.Compliance;
using Marketplace.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Marketplace.Tests.Integration;

/// <summary>Requisitos técnicos do Remessa Conforme de ponta a ponta (API real, SQLite, operador sandbox).</summary>
public sealed class RemessaConformeFlowTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private static readonly JsonSerializerOptions Json = ApiFactory.Json;

    public RemessaConformeFlowTests(ApiFactory factory) => _factory = factory;

    private async Task<HttpClient> AdminAsync() => await _factory.LoginAsync("admin@mktpy.com", "admin123");

    /// <summary>Compra paga de um produto da MegaStore (loja do usuário demo) e devolve o id do pedido.</summary>
    private static async Task<Guid> PaidOrderFromOwnStoreAsync(HttpClient client)
    {
        var list = await client.GetFromJsonAsync<JsonElement>("/api/products?sellerSlug=megastore-paraguay&pageSize=50", Json);
        foreach (var item in list.GetProperty("items").EnumerateArray())
        {
            var slug = item.GetProperty("slug").GetString();
            var product = await client.GetFromJsonAsync<JsonElement>($"/api/products/{slug}", Json);
            Guid? variantId = null;
            var variants = product.GetProperty("variants").EnumerateArray().ToList();
            if (variants.Count > 0)
            {
                var v = variants.FirstOrDefault(x => x.GetProperty("stock").GetInt32() > 0);
                if (v.ValueKind == JsonValueKind.Undefined) continue;
                variantId = v.GetProperty("id").GetGuid();
            }
            else if (product.GetProperty("stock").GetInt32() == 0) continue;
            if (product.GetProperty("price").GetProperty("amount").GetInt64() > 500_000) continue; // fica abaixo de US$ 3.000

            var productId = product.GetProperty("id").GetGuid();
            var sellerId = product.GetProperty("seller").GetProperty("id").GetGuid();
            var addresses = await client.GetFromJsonAsync<JsonElement>("/api/me/addresses", Json);
            var addressId = addresses.EnumerateArray().First(a => a.GetProperty("isDefault").GetBoolean()).GetProperty("id").GetGuid();
            var groups = new[] { new { sellerId, shippingOptionId = (Guid?)null, items = new[] { new { productId, variantId, quantity = 1 } } } };
            var quote = await (await client.PostAsJsonAsync("/api/checkout/quotes", new { postalCode = "01310100", groups }, Json))
                .Content.ReadFromJsonAsync<JsonElement>(Json);
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
            var body = await placed.Content.ReadFromJsonAsync<JsonElement>(Json);
            var order = body.GetProperty("orders")[0];
            // Tributos discriminados gravados no pedido.
            Assert.Equal("RemessaConforme", order.GetProperty("totals").GetProperty("taxes").GetProperty("regime").GetString());
            var approve = await client.PostAsync($"/api/payments/{body.GetProperty("payment").GetProperty("id").GetGuid()}/simulate-approval", null);
            Assert.Equal(HttpStatusCode.OK, approve.StatusCode);
            return order.GetProperty("id").GetGuid();
        }
        throw new InvalidOperationException("Nenhum produto da MegaStore com estoque.");
    }

    [Fact]
    public async Task Seller_IssuesPlatformLabel_ThenConfirmsPosting()
    {
        var client = await _factory.LoginAsync();
        var orderId = await PaidOrderFromOwnStoreAsync(client);

        // Sem etiqueta da plataforma, o envio é recusado (critério iii).
        var manual = await client.PostAsJsonAsync($"/api/seller/orders/{orderId}/ship", new { carrier = "Outro", trackingCode = "AA123456789BR" }, Json);
        Assert.Equal(HttpStatusCode.Conflict, manual.StatusCode);
        Assert.Contains("LABEL_REQUIRED", await manual.Content.ReadAsStringAsync());

        var created = await client.PostAsync($"/api/seller/orders/{orderId}/shipment", null);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var shipment = await created.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("EtiquetaEmitida", shipment.GetProperty("status").GetString());
        Assert.True(shipment.GetProperty("sandbox").GetBoolean());
        var tracking = shipment.GetProperty("trackingCode").GetString()!;
        Assert.True(S10.IsValid(tracking), tracking);
        Assert.StartsWith("SBX-", shipment.GetProperty("declarationNumber").GetString());
        Assert.True(shipment.GetProperty("hasLabel").GetBoolean());
        Assert.Equal("Pendente", shipment.GetProperty("remittance").GetProperty("status").GetString());

        // Segunda emissão é recusada; o PDF baixa.
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/seller/orders/{orderId}/shipment", null)).StatusCode);
        var label = await client.GetAsync(shipment.GetProperty("labelUrl").GetString());
        Assert.Equal("application/pdf", label.Content.Headers.ContentType?.MediaType);
        Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString(await label.Content.ReadAsByteArrayAsync())[..4]);

        // Confirmar postagem usa o rastreio da etiqueta.
        var shipped = await client.PostAsJsonAsync($"/api/seller/orders/{orderId}/ship", new { }, Json);
        Assert.Equal(HttpStatusCode.OK, shipped.StatusCode);
        var order = await shipped.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("Enviado", order.GetProperty("status").GetString());
        Assert.Equal(tracking, order.GetProperty("trackingCode").GetString());
        Assert.Equal("Postada", order.GetProperty("shipment").GetProperty("status").GetString());

        // Admin vê a remessa.
        var admin = await AdminAsync();
        var shipments = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/shipments?q={tracking}", Json);
        Assert.Equal("Postada", shipments.GetProperty("items")[0].GetProperty("status").GetString());
    }

    [Fact]
    public async Task SellerProduct_NcmIsValidated_AndProtectedBrandGoesToReview()
    {
        var client = await _factory.LoginAsync();
        var categories = await client.GetFromJsonAsync<JsonElement>("/api/categories", Json);
        var perfumes = categories.EnumerateArray().First(c => c.GetProperty("slug").GetString() == "perfumes").GetProperty("id").GetGuid();
        object Input(string name, string? hsCode, string status = "Ativo") => new
        {
            name,
            description = "Frasco original lacrado, 100 ml, com nota fiscal de compra do distribuidor oficial no Paraguai.",
            categoryId = perfumes,
            priceAmount = 45000,
            stock = 5,
            images = new[] { new { url = "/images/products/perfumes-1-1.webp" } },
            hsCode,
            status,
        };

        var noNcm = await client.PostAsJsonAsync("/api/seller/products", Input("Eau de Parfum floral 100 ml", null), Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, noNcm.StatusCode);
        Assert.Contains("hsCode", await noNcm.Content.ReadAsStringAsync());

        var wrongCategory = await client.PostAsJsonAsync("/api/seller/products", Input("Eau de Parfum floral 100 ml", "8517.13.00"), Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, wrongCategory.StatusCode);

        var prohibited = await client.PostAsJsonAsync("/api/seller/products", Input("Essência para narguilé 50 g", "2403.11.00"), Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, prohibited.StatusCode);

        var draft = await client.PostAsJsonAsync("/api/seller/products", Input("Rascunho sem NCM ainda", null, "Rascunho"), Json);
        Assert.Equal(HttpStatusCode.Created, draft.StatusCode);

        var brand = await client.PostAsJsonAsync("/api/seller/products", Input("Perfume Chanel Coco 100 ml", "3303.00.10"), Json);
        Assert.Equal(HttpStatusCode.Created, brand.StatusCode);
        var product = await brand.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("EmAnalise", product.GetProperty("status").GetString());
        Assert.Equal("MARCA_PROTEGIDA", product.GetProperty("moderationReason").GetString());

        // Admin aprova: nome e preço liberados; mudar o nome volta para análise.
        var admin = await AdminAsync();
        var id = product.GetProperty("id").GetGuid();
        var approved = await admin.PostAsJsonAsync($"/api/admin/products/{id}/moderate", new { action = "aprovar", note = "Nota de compra conferida." }, Json);
        Assert.Equal("Ativo", (await approved.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("status").GetString());
        var renamed = await client.PutAsJsonAsync($"/api/seller/products/{id}", Input("Perfume Chanel Nº 5 100 ml", "3303.00.10"), Json);
        Assert.Equal("EmAnalise", (await renamed.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task UpheldReport_BlocksProduct_AndCreatesOccurrence()
    {
        var buyer = await _factory.LoginAsync();
        var target = await buyer.GetFromJsonAsync<JsonElement>("/api/products/bola-de-futebol-oficial-termocolada-esp8", Json);
        var productId = target.GetProperty("id").GetGuid();
        var report = await buyer.PostAsJsonAsync($"/api/products/{productId}/reports", new { reason = "Falsificado", details = "Costura e logotipo diferentes do original." }, Json);
        Assert.Equal(HttpStatusCode.Created, report.StatusCode);
        var reportId = (await report.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.Conflict, (await buyer.PostAsJsonAsync($"/api/products/{productId}/reports", new { reason = "Falsificado" }, Json)).StatusCode);

        var admin = await AdminAsync();
        var resolved = await admin.PostAsJsonAsync($"/api/admin/reports/{reportId}/resolve", new { upheld = true, blockProduct = true, note = "Fornecedor sem autorização da marca." }, Json);
        Assert.Equal(HttpStatusCode.OK, resolved.StatusCode);
        var dto = await resolved.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("Procedente", dto.GetProperty("status").GetString());
        Assert.Equal("Bloqueado", dto.GetProperty("productStatus").GetString());

        var occurrences = await admin.GetFromJsonAsync<JsonElement>("/api/admin/compliance/occurrences?indicator=Contrafacao", Json);
        Assert.Contains(occurrences.GetProperty("items").EnumerateArray(), o => o.GetProperty("productId").GetGuid() == productId);
        Assert.Equal(HttpStatusCode.NotFound, (await buyer.GetAsync("/api/products/bola-de-futebol-oficial-termocolada-esp8")).StatusCode);
    }

    [Fact]
    public async Task RepeatedOccurrences_SuspendTheSeller()
    {
        var admin = await AdminAsync();
        var sellers = await admin.GetFromJsonAsync<JsonElement>("/api/admin/sellers?q=Bebidas", Json);
        var sellerId = sellers.GetProperty("items")[0].GetProperty("id").GetGuid();
        for (var i = 0; i < 3; i++)
        {
            var r = await admin.PostAsJsonAsync("/api/admin/compliance/occurrences", new
            {
                indicator = "QualidadeDeclaracao", source = "Interna", code = "DESCRICAO", description = $"Descrição genérica na remessa {i}.", sellerId,
            }, Json);
            Assert.Equal(HttpStatusCode.Created, r.StatusCode);
        }
        var detail = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/sellers/{sellerId}", Json);
        Assert.Equal("Suspenso", detail.GetProperty("summary").GetProperty("status").GetString());
        Assert.Contains("Descredenciada automaticamente", detail.GetProperty("verification").GetProperty("suspensionReason").GetString());

        var dashboard = await admin.GetFromJsonAsync<JsonElement>("/api/admin/compliance", Json);
        Assert.Equal(3, dashboard.GetProperty("cycleIndicators").GetArrayLength());
        Assert.Contains(dashboard.GetProperty("sellersAtRisk").EnumerateArray(), s => s.GetProperty("sellerId").GetGuid() == sellerId);
    }

    [Fact]
    public async Task PendingSeller_NeedsVerificationBeforeApproval()
    {
        var admin = await AdminAsync();
        var pending = await admin.GetFromJsonAsync<JsonElement>("/api/admin/sellers?status=Pendente", Json);
        var sellerId = pending.GetProperty("items")[0].GetProperty("id").GetGuid();
        var direct = await admin.PutAsJsonAsync($"/api/admin/sellers/{sellerId}", new { status = "Aprovado" }, Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, direct.StatusCode);
        var verified = await admin.PostAsJsonAsync($"/api/admin/sellers/{sellerId}/verify", new { approve = true }, Json);
        Assert.Equal(HttpStatusCode.OK, verified.StatusCode);
        var dto = await verified.Content.ReadFromJsonAsync<JsonElement>(Json);
        Assert.Equal("Aprovado", dto.GetProperty("summary").GetProperty("status").GetString());
        Assert.True(dto.GetProperty("summary").GetProperty("verified").GetBoolean());
    }

    [Fact]
    public async Task Address_RequiresRecipientCpf_AndTaxEstimateIsItemized()
    {
        var client = await _factory.LoginAsync();
        var missing = await client.PostAsJsonAsync("/api/me/addresses", new
        {
            label = "Mãe", recipientName = "Maria Demo", postalCode = "01310100", street = "Rua A", number = "10", neighborhood = "Centro",
            city = "São Paulo", state = "SP", isDefault = false,
        }, Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, missing.StatusCode);
        Assert.Contains("recipientCpf", await missing.Content.ReadAsStringAsync());

        var estimate = await client.GetFromJsonAsync<JsonElement>("/api/taxes/estimate?amount=10000&state=SP", Json);
        Assert.Equal("RemessaConforme", estimate.GetProperty("regime").GetString());
        Assert.Equal(2000, estimate.GetProperty("importDutyBasisPoints").GetInt32());
        Assert.Equal(2000, estimate.GetProperty("importDuty").GetProperty("amount").GetInt64());
        Assert.True(estimate.TryGetProperty("ibs", out _) && estimate.TryGetProperty("cbs", out _));
    }

    [Fact]
    public async Task Integrations_ShowWhatIsMissing()
    {
        var admin = await AdminAsync();
        var list = await admin.GetFromJsonAsync<JsonElement>("/api/admin/integrations", Json);
        var byKey = list.EnumerateArray().ToDictionary(i => i.GetProperty("key").GetString()!);
        Assert.Equal(6, byKey.Count);
        Assert.Equal("Sandbox", byKey["carrier"].GetProperty("mode").GetString());
        Assert.Contains("Siscomex__ClientId", byKey["siscomex"].GetProperty("missing").EnumerateArray().Select(m => m.GetString()));
        Assert.Contains("Serpro__ConsumerKey", byKey["serpro"].GetProperty("missing").EnumerateArray().Select(m => m.GetString()));
        Assert.False(byKey["ncm"].GetProperty("requiresCredential").GetBoolean());
    }

    [Fact]
    public async Task Initializer_BackfillsNcmAndDocuments_WhenCatalogWasSeededBeforeRemessaConforme()
    {
        // Banco semeado antes do Remessa Conforme: produto do catálogo sem NCM e loja sem documentos.
        _ = _factory.CreateClient();
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var product = await db.Products.FirstAsync(p => p.Slug == "bicicleta-ergometrica-magnetica-dobravel-esp1");
        var expectedNcm = product.HsCode;
        Assert.NotNull(expectedNcm);
        product.HsCode = null;
        var seller = await db.Sellers.FirstAsync(s => s.Slug == "casa-nova-import");
        seller.LegalAddress = null;
        seller.ResponsibleName = null;
        seller.ResponsibleDocumentType = null;
        seller.ResponsibleDocument = null;
        seller.IdentityDocumentUrl = null;
        seller.RucCertificateUrl = null;
        await db.SaveChangesAsync();

        await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().BackfillCatalogComplianceAsync(CancellationToken.None);

        db.ChangeTracker.Clear();
        Assert.Equal(expectedNcm, (await db.Products.AsNoTracking().FirstAsync(p => p.Id == product.Id)).HsCode);
        var restored = await db.Sellers.AsNoTracking().FirstAsync(s => s.Id == seller.Id);
        Assert.False(string.IsNullOrWhiteSpace(restored.LegalAddress));
        Assert.False(string.IsNullOrWhiteSpace(restored.ResponsibleDocument));
        Assert.NotNull(restored.RucCertificateUrl);
    }

    [Fact]
    public async Task Seller_SeesShippingPolicy()
    {
        // O painel decide entre "Gerar etiqueta" e o rastreio manual por esta política.
        var client = await _factory.LoginAsync();
        var policy = await client.GetFromJsonAsync<JsonElement>("/api/seller/shipping-policy", Json);
        Assert.True(policy.GetProperty("requirePlatformLabel").GetBoolean());
        Assert.True(policy.GetProperty("carrierConfigured").GetBoolean());
        Assert.True(policy.GetProperty("sandbox").GetBoolean());
        Assert.Equal("sandbox", policy.GetProperty("carrier").GetString());
    }

    [Fact]
    public async Task Admin_GetsReprintedLabel_ForSandboxShipmentWithoutStoredFile()
    {
        // As remessas da demo (rastreio LB…) não têm o PDF guardado: o sandbox gera a segunda via.
        var admin = await AdminAsync();
        var list = await admin.GetFromJsonAsync<JsonElement>("/api/admin/shipments?pageSize=50", Json);
        var seeded = list.GetProperty("items").EnumerateArray()
            .First(s => s.GetProperty("trackingCode").GetString()!.StartsWith("LB", StringComparison.Ordinal));
        var label = await admin.GetAsync($"/api/admin/shipments/{seeded.GetProperty("id").GetGuid()}/label");
        Assert.Equal(HttpStatusCode.OK, label.StatusCode);
        Assert.Equal("application/pdf", label.Content.Headers.ContentType?.MediaType);
        var bytes = await label.Content.ReadAsByteArrayAsync();
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
    }
}
