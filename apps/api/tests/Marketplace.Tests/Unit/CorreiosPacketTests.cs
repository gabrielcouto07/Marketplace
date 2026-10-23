using System.Net;
using System.Text;
using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Domain.Common;
using Marketplace.Infrastructure.RemessaConforme;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace Marketplace.Tests.Unit;

public class CorreiosPacketTests
{
    private static readonly PlatformIdentity Platform =
        new("Mania Paraguai", "Mania Paraguai", "Mania Paraguai Ltda.", "CNPJ", "11.222.333/0001-81", "BR", "", null, null, null);

    private static RemessaShipmentRequest Request(
        IReadOnlyList<RemessaItem>? items = null, long freight = 3500, long discount = 0, string? phone = "+55 (11) 98765-4321",
        PlatformIdentity? platform = null, string? serviceCode = "padrao")
    {
        items ??= [new RemessaItem(1, "Fone de ouvido bluetooth JBL Tune 510BT", "8518.30.00", 1, Money.Brl(12000), Money.Brl(12000), 300, "CN")];
        var products = items.Sum(i => i.TotalValue.Amount);
        var recipient = new RemessaParty("Gabriel Demo Silva", "CPF", "529.982.247-25", "Avenida Paulista, 1578 – Apto 12 – Bela Vista",
            "São Paulo", "sp", "01310-100", "BR", phone, "gabriel@example.com", "Avenida Paulista", "1578", "Apto 12", "Bela Vista");
        var sender = new RemessaParty("TecnoCentro CDE S.A.", "RUC", "80012345-0", "Av. San Blas 455, Km 4", "Ciudad del Este", null, "7000",
            "PY", "+595 61 512 300", "ventas@tecnocentro.com.py");
        var taxes = new RemessaTaxes(Money.ZeroBrl, Money.Brl(3197), Money.ZeroBrl, Money.ZeroBrl, Money.ZeroBrl, Money.Brl(3197));
        return new RemessaShipmentRequest(Guid.NewGuid(), "PY-2026-000123", new DateTime(2026, 10, 20), platform ?? Platform, sender, recipient,
            items, "Fone de ouvido bluetooth", Money.Brl(products), Money.Brl(freight), Money.ZeroBrl, Money.Brl(discount),
            Money.Brl(products + freight - discount), null, taxes, "RemessaConforme", null, 450, null, serviceCode, null);
    }

    private static JsonElement Package(RemessaShipmentRequest request) =>
        JsonDocument.Parse(JsonSerializer.Serialize(CorreiosPacketCarrierGateway.ToPackage(request))).RootElement;

    /// <summary>Nulo não vai para a API (o gateway serializa com WhenWritingNull).</summary>
    private static bool Absent(JsonElement p, string name) => !p.TryGetProperty(name, out var v) || v.ValueKind == JsonValueKind.Null;

    [Fact]
    public void Package_MapsOrderToPrcFields()
    {
        var p = Package(Request(serviceCode: "express"));
        Assert.Equal("PY-2026-000123", p.GetProperty("customerControlCode").GetString());
        Assert.Equal("Av. San Blas", p.GetProperty("senderAddress").GetString());
        Assert.Equal("455", p.GetProperty("senderAddressNumber").GetString());
        Assert.Equal("Km 4", p.GetProperty("senderAddressComplement").GetString());
        Assert.Equal("PY", p.GetProperty("senderCountryCode").GetString());
        Assert.True(Absent(p, "senderState"));
        Assert.Equal("Mania Paraguai Ltda.", p.GetProperty("senderWebsite").GetString());
        Assert.Equal("52998224725", p.GetProperty("recipientDocumentNumber").GetString());
        Assert.Equal("Avenida Paulista", p.GetProperty("recipientAddress").GetString());
        Assert.Equal("1578", p.GetProperty("recipientAddressNumber").GetString());
        Assert.Equal("Apto 12 – Bela Vista", p.GetProperty("recipientAddressComplement").GetString());
        Assert.Equal("SP", p.GetProperty("recipientState").GetString());
        Assert.Equal("01310100", p.GetProperty("recipientZipCode").GetString());
        Assert.Equal("11987654321", p.GetProperty("recipientPhoneNumber").GetString());
        Assert.Equal(16, p.GetProperty("packagingLength").GetInt32());
        Assert.Equal(11, p.GetProperty("packagingWidth").GetInt32());
        Assert.Equal(2, p.GetProperty("packagingHeight").GetInt32());
        Assert.Equal("33170", p.GetProperty("distributionModality").GetString());
        Assert.Equal("PRC", p.GetProperty("taxPaymentMethod").GetString());
        Assert.Equal("BRL", p.GetProperty("currency").GetString());
        Assert.Equal("RETURNTOORIGIN", p.GetProperty("nonNationalizationInstruction").GetString());
        Assert.Equal(35.00m, p.GetProperty("freightPaidValue").GetDecimal());
        Assert.True(Absent(p, "insurancePaidValue"));
        Assert.Equal(0m, p.GetProperty("provisionedTaxValue").GetDecimal());
        Assert.Equal(31.97m, p.GetProperty("provisionedIcmsValue").GetDecimal());
        Assert.Equal("11222333000181", p.GetProperty("senderCodeEce").GetString());
        var item = p.GetProperty("items")[0];
        Assert.Equal("85183000", item.GetProperty("hsCode").GetString());
        Assert.Equal(1, item.GetProperty("quantity").GetInt32());
        Assert.Equal(120.00m, item.GetProperty("value").GetDecimal());
    }

    [Fact]
    public void Package_StandardServiceAndShortTradeNameWhenLegalNameIsLong()
    {
        var platform = Platform with { LegalName = "Mania Paraguai Comércio Eletrônico Ltda." };
        var p = Package(Request(platform: platform));
        Assert.Equal("33162", p.GetProperty("distributionModality").GetString());
        Assert.Equal("Mania Paraguai", p.GetProperty("senderWebsite").GetString());
    }

    [Fact]
    public void Package_WithoutCompanyDocumentUsesTheTestEceCodeOnlyWhenGiven()
    {
        var request = Request(platform: Platform with { Document = "" });
        var p = JsonDocument.Parse(JsonSerializer.Serialize(CorreiosPacketCarrierGateway.ToPackage(request, testEceCode: "123456789"))).RootElement;
        Assert.Equal("123456789", p.GetProperty("senderCodeEce").GetString());
        Assert.Throws<RemessaRejectedException>(() => CorreiosPacketCarrierGateway.ToPackage(request));
    }

    [Fact]
    public void Package_RejectsWhatTheApiWouldRefuse()
    {
        Assert.Throws<RemessaRejectedException>(() => CorreiosPacketCarrierGateway.ToPackage(Request(platform: Platform with { Document = "" })));
        Assert.Throws<RemessaRejectedException>(() => CorreiosPacketCarrierGateway.ToPackage(Request(phone: "12345")));
        var many = Enumerable.Range(1, 21).Select(i => new RemessaItem(i, $"Item {i}", "85183000", 1, Money.Brl(100), Money.Brl(100), null, "CN")).ToList();
        Assert.Throws<RemessaRejectedException>(() => CorreiosPacketCarrierGateway.ToPackage(Request(items: many)));
    }

    [Fact]
    public void Values_SumToCustomsValueWithDiscountAndFreeShipping()
    {
        // 3 × R$ 30,00 + 1 × R$ 45,50, frete grátis e R$ 1,00 de desconto: valor aduaneiro R$ 134,50.
        var items = new[]
        {
            new RemessaItem(1, "Capa de celular", "39269090", 3, Money.Brl(3000), Money.Brl(9000), null, "CN"),
            new RemessaItem(2, "Carregador USB-C 20W", "85044010", 1, Money.Brl(4550), Money.Brl(4550), null, "CN"),
        };
        var request = Request(items, freight: 0, discount: 100);
        var (freight, lines) = CorreiosPacketCarrierGateway.Values(request);

        Assert.Equal(1, freight); // a API recusa frete abaixo de R$ 0,01
        Assert.Equal(request.CustomsValue.Amount, freight + lines.Sum(l => l.Quantity * l.UnitCents));
        Assert.Equal(3, lines.Where(l => l.Ncm == "39269090").Sum(l => l.Quantity));
        Assert.Equal(1, lines.Where(l => l.Ncm == "85044010").Sum(l => l.Quantity));
        // 13449 rateados pelo valor das linhas: 8933 para a capa (não divide por 3 → 1 × 29,77 + 2 × 29,78) e 4516 para o carregador.
        Assert.Contains(lines, l => l.Ncm == "39269090" && l.Quantity == 1 && l.UnitCents == 2977);
        Assert.Contains(lines, l => l.Ncm == "39269090" && l.Quantity == 2 && l.UnitCents == 2978);
        Assert.Contains(lines, l => l.Ncm == "85044010" && l.Quantity == 1 && l.UnitCents == 4516);
    }

    [Fact]
    public void Values_WithoutDiscountKeepTheSoldPrices()
    {
        var items = new[] { new RemessaItem(1, "Capa", "39269090", 3, Money.Brl(3000), Money.Brl(9000), null, "CN") };
        var (freight, lines) = CorreiosPacketCarrierGateway.Values(Request(items, freight: 2500));
        Assert.Equal(2500, freight);
        var line = Assert.Single(lines);
        Assert.Equal((3, 3000L), (line.Quantity, line.UnitCents));
    }

    [Theory]
    [InlineData("+55 (11) 98765-4321", "11987654321")]
    [InlineData("11 3333-4444", "1133334444")]
    [InlineData("011 98765-4321", "11987654321")]
    [InlineData("98765-4321", null)]
    [InlineData(null, null)]
    public void Phone_IsDddPlusNumber(string? input, string? expected) =>
        Assert.Equal(expected, CorreiosPacketCarrierGateway.Phone(input));

    [Theory]
    [InlineData("Av. San Blas 455, Km 4", "Av. San Blas", "455", "Km 4")]
    [InlineData("Calle 25 de Mayo 1200", "Calle 25 de Mayo", "1200", null)]
    [InlineData("Av. Mcal. López nº 3410 - Piso 2", "Av. Mcal. López", "3410", "Piso 2")]
    [InlineData("Supercarretera Itaipú, Barrio San Juan", "Supercarretera Itaipú, Barrio San Juan", "0", null)]
    public void SplitAddress_FindsTheHouseNumber(string line, string street, string number, string? complement) =>
        Assert.Equal((street, number, complement), CorreiosPacketCarrierGateway.SplitAddress(line));

    [Fact]
    public void Text_KeepsWindows1252AndFieldLength()
    {
        Assert.Equal("Loja Ñandú", CorreiosPacketCarrierGateway.Text("Loja ₲ 😀\n Ñandú", 50));
        Assert.Equal("Mania", CorreiosPacketCarrierGateway.Text("Mania Paraguai", 6));
    }

    [Fact]
    public void ExpiresAt_UsesZoneOffset() =>
        Assert.Equal(new DateTimeOffset(2026, 10, 24, 7, 15, 0, TimeSpan.Zero),
            CorreiosPacketCarrierGateway.ExpiresAt("2026-10-24T04:15:00", "-03:00")!.Value.ToUniversalTime());

    [Fact]
    public void ExtractMessage_ReadsMsgs() =>
        Assert.Equal("NEG-112: HS code not found. SUA-121: CPF number is invalid.", CorreiosPacketCarrierGateway.ExtractMessage(
            """{"msgs":["NEG-112: HS code not found.","SUA-121: CPF number is invalid."],"errorDetails":[]}"""));

    // ----- Gateway contra um servidor falso -----

    private const string TokenJson =
        """{"ambiente":"HOMOLOGACAO","id":"testeint","emissao":"2026-10-23T04:15:00","expiraEm":"2026-10-24T04:15:00","zoneOffset":"-03:00","token":"tok-1"}""";

    private static (CorreiosPacketCarrierGateway Gateway, FakeServer Server) Gateway(string baseUrl = "https://apihom.correios.com.br")
    {
        var server = new FakeServer();
        var options = Options.Create(new RemessaConformeOptions
        {
            Carrier = { Provider = "Correios", Correios = { BaseUrl = baseUrl, User = "testeint", Password = "segredo", PostageCard = "0076772055" } },
        });
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 10, 23, 20, 0, 0, TimeSpan.Zero));
        return (new CorreiosPacketCarrierGateway(server, options, clock, NullLogger<CorreiosPacketCarrierGateway>.Instance), server);
    }

    [Fact]
    public async Task Create_ReusesTokenAndBuildsTheLabel()
    {
        var (gateway, server) = Gateway();
        server.On("/token/v1/autentica/cartaopostagem", HttpStatusCode.Created, TokenJson);
        server.On("/packet/v1/packages", HttpStatusCode.Created, """{"packageResponseList":[{"customerControlCode":"PY-2026-000123","trackingNumber":"nl000502838br"}]}""");

        var first = await gateway.CreateShipmentAsync(Request(), CancellationToken.None);
        await gateway.CreateShipmentAsync(Request(), CancellationToken.None);

        Assert.Equal(("correios-hom", true, true), (gateway.Name, gateway.IsSandbox, gateway.IsConfigured));
        Assert.Equal(("NL000502838BR", "NL000502838BR", "Correios"), (first.TrackingCode, first.ProviderReference, first.Carrier));
        var pdf = Encoding.Latin1.GetString(first.LabelPdf!);
        Assert.Contains("NL000502838BR", pdf);
        Assert.Contains("SANDBOX", pdf);

        var token = Assert.Single(server.Requests, r => r.Path.StartsWith("/token"));
        Assert.Equal("Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes("testeint:segredo")), token.Authorization);
        Assert.Equal("0076772055", JsonDocument.Parse(token.Body!).RootElement.GetProperty("numero").GetString());
        var create = server.Requests.First(r => r.Path == "/packet/v1/packages");
        Assert.Equal("Bearer tok-1", create.Authorization);
        Assert.Contains("\"São Paulo\"", create.Body); // UTF-8 sem escape ã
        Assert.DoesNotContain("senderState", create.Body);
        Assert.Equal("PRC", JsonDocument.Parse(create.Body!).RootElement.GetProperty("packageList")[0].GetProperty("taxPaymentMethod").GetString());
    }

    [Fact]
    public async Task Create_RenewsTokenOnceWhenRejected()
    {
        var (gateway, server) = Gateway("https://api.correios.com.br");
        server.On("/token/v1/autentica/cartaopostagem", HttpStatusCode.Created, TokenJson);
        server.On("/packet/v1/packages", HttpStatusCode.Forbidden, """{"msgs":["GTW-006: Token inválido."]}""");
        server.On("/packet/v1/packages", HttpStatusCode.Created, """{"packageResponseList":[{"trackingNumber":"NX000931182BR"}]}""");

        var result = await gateway.CreateShipmentAsync(Request(), CancellationToken.None);

        Assert.Equal(("correios", false), (gateway.Name, gateway.IsSandbox));
        Assert.Equal("NX000931182BR", result.TrackingCode);
        Assert.Equal(2, server.Requests.Count(r => r.Path.StartsWith("/token")));
        Assert.DoesNotContain("SANDBOX", Encoding.Latin1.GetString(result.LabelPdf!));
    }

    [Fact]
    public async Task Create_ValidationErrorIsARejection()
    {
        var (gateway, server) = Gateway();
        server.On("/token/v1/autentica/cartaopostagem", HttpStatusCode.Created, TokenJson);
        server.On("/packet/v1/packages", HttpStatusCode.BadRequest,
            """{"msgs":["SUA-121: CPF number is invalid."],"errorDetails":[{"objectName":"packageList[0]","message":"SUA-121: CPF number is invalid."}]}""");

        var ex = await Assert.ThrowsAsync<RemessaRejectedException>(() => gateway.CreateShipmentAsync(Request(), CancellationToken.None));
        Assert.Equal("SUA-121: CPF number is invalid.", ex.Message);
    }

    [Fact]
    public async Task Create_TimeoutWarnsThatThePackageMayExist()
    {
        var (gateway, server) = Gateway();
        server.On("/token/v1/autentica/cartaopostagem", HttpStatusCode.Created, TokenJson);
        server.Timeout("/packet/v1/packages");

        var ex = await Assert.ThrowsAsync<HttpRequestException>(() => gateway.CreateShipmentAsync(Request(), CancellationToken.None));
        Assert.Contains("SSII", ex.Message);
    }

    [Fact]
    public async Task RemitTaxes_ConfirmsWhenTheDirExists()
    {
        var (gateway, server) = Gateway();
        server.On("/token/v1/autentica/cartaopostagem", HttpStatusCode.Created, TokenJson);
        server.On("/packet/v1/packages/provisioned-values", HttpStatusCode.OK, "{}");
        server.On("/packet/v1/packages/provisioned-values", HttpStatusCode.OK,
            """{"packageList":[{"trackingNumber":"NL000502838BR","customValue":155.0,"dirNumber":"250000039351","provisionedValues":{"provisionedTaxValue":0,"provisionedIcmsValue":31.97}}]}""");
        var request = new TaxRemittanceRequest(Guid.NewGuid(), "PY-2026-000123", "NL000502838BR", "NL000502838BR",
            new RemessaTaxes(Money.ZeroBrl, Money.Brl(3197), Money.ZeroBrl, Money.ZeroBrl, Money.ZeroBrl, Money.Brl(3197)), DateTime.UtcNow);

        var pending = await gateway.RemitTaxesAsync(request, CancellationToken.None);
        var confirmed = await gateway.RemitTaxesAsync(request, CancellationToken.None);

        Assert.Equal(("NL000502838BR", false), (pending.Reference, pending.Confirmed));
        Assert.Equal(("DIR 250000039351", true), (confirmed.Reference, confirmed.Confirmed));
        Assert.Equal("trackingNumber=NL000502838BR", server.Requests.Last().Query.TrimStart('?'));
    }

    private sealed record Recorded(string Path, string Query, string? Authorization, string? Body);

    /// <summary>Respostas na ordem de cadastro por caminho (a última se repete) e registro de cada pedido.</summary>
    private sealed class FakeServer : HttpMessageHandler, IHttpClientFactory
    {
        private readonly Dictionary<string, Queue<Func<HttpResponseMessage>>> _routes = [];
        public List<Recorded> Requests { get; } = [];

        public void On(string path, HttpStatusCode status, string json) =>
            Route(path).Enqueue(() => new HttpResponseMessage(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") });

        public void Timeout(string path) => Route(path).Enqueue(() => throw new TaskCanceledException("timeout"));

        private Queue<Func<HttpResponseMessage>> Route(string path) =>
            _routes.TryGetValue(path, out var q) ? q : _routes[path] = new Queue<Func<HttpResponseMessage>>();

        public HttpClient CreateClient(string name) => new(this, disposeHandler: false);

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var uri = request.RequestUri!;
            Requests.Add(new Recorded(uri.AbsolutePath, uri.Query, request.Headers.Authorization?.ToString(),
                request.Content is null ? null : await request.Content.ReadAsStringAsync(ct)));
            var queue = _routes[uri.AbsolutePath];
            return (queue.Count > 1 ? queue.Dequeue() : queue.Peek())();
        }
    }
}
