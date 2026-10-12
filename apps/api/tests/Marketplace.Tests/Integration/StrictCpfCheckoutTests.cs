using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Marketplace.Tests.Integration;

/// <summary>Consulta CPF obrigatória (produção): a Receita responde, mas sem o nome do titular.</summary>
public sealed class StrictCpfApiFactory : ApiFactory
{
    protected override void ConfigureFakes(IServiceCollection services)
    {
        services.Configure<CpfVerificationOptions>(o => o.RequireRegistryCheck = true);
        services.RemoveAll<ITaxpayerRegistry>();
        services.AddSingleton<ITaxpayerRegistry, NamelessRegistry>();
    }

    private sealed class NamelessRegistry : ITaxpayerRegistry
    {
        public bool IsConfigured => true;

        public Task<TaxpayerCheck> CheckCpfAsync(string cpf, CancellationToken ct) =>
            Task.FromResult(new TaxpayerCheck(TaxpayerSituation.Regular, null, "fake"));
    }
}

/// <summary>Programa 7.2: o CPF confere com a base da Receita quanto ao número E ao nome do titular.</summary>
public sealed class StrictCpfCheckoutTests : IClassFixture<StrictCpfApiFactory>
{
    private readonly StrictCpfApiFactory _factory;
    private static readonly JsonSerializerOptions Json = ApiFactory.Json;

    public StrictCpfCheckoutTests(StrictCpfApiFactory factory) => _factory = factory;

    [Fact]
    public async Task RegistryAnswerWithoutHolderName_DoesNotConcludeTheSale()
    {
        var buyer = await _factory.LoginAsync();
        var (productId, sellerId) = await ComplianceProgramFlowTests.PickMegaStoreProductAsync(buyer);
        var addresses = await buyer.GetFromJsonAsync<JsonElement>("/api/me/addresses", Json);
        var addressId = addresses.EnumerateArray().First(a => a.GetProperty("isDefault").GetBoolean()).GetProperty("id").GetGuid();
        var groups = new[] { new { sellerId, shippingOptionId = (Guid?)null, items = new[] { new { productId, variantId = (Guid?)null, quantity = 1 } } } };
        var quote = await (await buyer.PostAsJsonAsync("/api/checkout/quotes", new { postalCode = "01310100", groups }, Json))
            .Content.ReadFromJsonAsync<JsonElement>(Json);

        var placed = await buyer.PostAsJsonAsync("/api/orders", new
        {
            quoteId = quote.GetProperty("quoteId").GetGuid(), addressId,
            exchangeRateId = quote.GetProperty("exchangeRate").GetProperty("id").GetGuid(), idempotencyKey = Guid.NewGuid().ToString(),
            groups = new[] { new { sellerId, shippingOptionId = quote.GetProperty("groups")[0].GetProperty("selectedShippingOptionId").GetGuid(), items = new[] { new { productId, variantId = (Guid?)null, quantity = 1 } } } },
            payment = new { method = "Pix", payerDocument = "529.982.247-25" },
        }, Json);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, placed.StatusCode);
        Assert.Contains("CPF_VERIFICATION_UNAVAILABLE", await placed.Content.ReadAsStringAsync());
    }
}
