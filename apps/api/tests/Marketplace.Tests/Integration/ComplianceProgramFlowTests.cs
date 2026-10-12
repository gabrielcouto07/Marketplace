using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Marketplace.Tests.Integration;

/// <summary>
/// Programa de Conformidade Tributária e Aduaneira e Política de Admissão e de Monitoramento de Vendedores de ponta a
/// ponta: Anexo I, descrição da declaração, canal de denúncias, medidas e comunicações, recadastro, Receita Federal,
/// comprovante, documentos privados e fracionamento.
/// </summary>
public sealed class ComplianceProgramFlowTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    private static readonly JsonSerializerOptions Json = ApiFactory.Json;

    public ComplianceProgramFlowTests(ApiFactory factory) => _factory = factory;

    private Task<HttpClient> AdminAsync() => _factory.LoginAsync("admin@mktpy.com", "admin123");

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response) => await response.Content.ReadFromJsonAsync<JsonElement>(Json);

    [Fact]
    public async Task Catalog_HasNoAlcohol_AndGamesReplacedBeverages()
    {
        var client = _factory.CreateClient();
        var categories = await client.GetFromJsonAsync<JsonElement>("/api/categories", Json);
        var slugs = categories.EnumerateArray().Select(c => c.GetProperty("slug").GetString()).ToList();
        Assert.Contains("games", slugs);
        Assert.DoesNotContain("bebidas", slugs);
        var search = await client.GetFromJsonAsync<JsonElement>("/api/products?q=whisky&pageSize=10", Json);
        Assert.Equal(0, search.GetProperty("totalCount").GetInt32());

        var policy = await client.GetFromJsonAsync<JsonElement>("/api/policies/seller", Json);
        Assert.Equal(16, policy.GetProperty("annex").GetArrayLength());
        Assert.False(string.IsNullOrWhiteSpace(policy.GetProperty("version").GetString()));
    }

    [Fact]
    public async Task PublicReport_WorksWithoutLogin_WithProtocolAndTwoBusinessDays()
    {
        var anonymous = _factory.CreateClient();
        var products = await anonymous.GetFromJsonAsync<JsonElement>("/api/products?categorySlug=moda&pageSize=1", Json);
        var slug = products.GetProperty("items")[0].GetProperty("slug").GetString();

        var bot = await anonymous.PostAsJsonAsync("/api/reports", new { product = $"https://loja/produto/{slug}", reason = "Falsificado", details = "Logotipo diferente.", website = "spam" }, Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, bot.StatusCode);

        var created = await anonymous.PostAsJsonAsync("/api/reports", new
        {
            product = $"https://mercadoparaguai.com.br/produto/{slug}?ref=x",
            reason = "PropriedadeIntelectual",
            details = "Uso da marca registrada sem autorização do titular.",
            reporterName = "Escritório de Marcas",
            reporterEmail = "marcas@example.com",
            isRightsHolder = true,
            rightsHolderName = "Titular Ltda.",
            evidenceUrls = new[] { "https://example.com/registro-inpi.pdf" },
        }, Json);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var receipt = await ReadAsync(created);
        Assert.StartsWith("DEN-", receipt.GetProperty("protocol").GetString());
        Assert.True(receipt.GetProperty("dueAt").GetDateTime() > DateTime.UtcNow);

        var again = await anonymous.PostAsJsonAsync("/api/reports", new { product = slug, reason = "Falsificado", details = "Mesmo anúncio, de novo.", reporterEmail = "marcas@example.com" }, Json);
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);

        var admin = await AdminAsync();
        var list = await admin.GetFromJsonAsync<JsonElement>("/api/admin/reports?status=Aberta&pageSize=50", Json);
        var report = list.GetProperty("items").EnumerateArray().First(r => r.GetProperty("protocol").GetString() == receipt.GetProperty("protocol").GetString());
        Assert.Equal("CanalPublico", report.GetProperty("channel").GetString());
        Assert.True(report.GetProperty("isRightsHolder").GetBoolean());
    }

    [Fact]
    public async Task SellerProduct_NeedsDeclarationData_AndBannedTermsGoToReview()
    {
        var seller = await _factory.LoginAsync();
        var categories = await seller.GetFromJsonAsync<JsonElement>("/api/categories", Json);
        var casa = categories.EnumerateArray().First(c => c.GetProperty("slug").GetString() == "casa").GetProperty("id").GetGuid();
        object Input(string name, string? nature, string description = "Jogo com seis copos de vidro temperado, resistentes à lava-louças e com 300 ml cada um.") => new
        {
            name, description, categoryId = casa, priceAmount = 12900, stock = 10, status = "Ativo",
            images = new[] { new { url = "/images/products/casa-4-1.webp" } }, hsCode = "7013.37.00",
            nature, unbranded = true, material = "Vidro temperado", packageQuantity = 6, originCountry = "CN",
        };

        var missing = await seller.PostAsJsonAsync("/api/seller/products", Input("Jogo de copos de vidro 300 ml", null), Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, missing.StatusCode);
        Assert.Contains("nature", await missing.Content.ReadAsStringAsync());

        var generic = await seller.PostAsJsonAsync("/api/seller/products", Input("Jogo de copos de vidro 300 ml", "Utilidades diversas"), Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, generic.StatusCode);

        var ok = await seller.PostAsJsonAsync("/api/seller/products", Input("Jogo de copos de vidro 300 ml", "Copo de vidro para bebidas"), Json);
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
        var product = await ReadAsync(ok);
        Assert.Equal("Ativo", product.GetProperty("status").GetString());
        Assert.Contains("sem marca", product.GetProperty("declarationPreview").GetString());
        Assert.Contains("quantidade: 6 un.", product.GetProperty("declarationPreview").GetString());

        // "Whisky" no nome: pode ser só o copo, mas a equipe confere (Anexo I, f).
        var term = await seller.PostAsJsonAsync("/api/seller/products", Input("Copo para whisky de vidro 300 ml", "Copo de vidro"), Json);
        var flagged = await ReadAsync(term);
        Assert.Equal("EmAnalise", flagged.GetProperty("status").GetString());
        Assert.Equal("PRODUTO_VEDADO", flagged.GetProperty("moderationReason").GetString());

        var admin = await AdminAsync();
        var id = flagged.GetProperty("id").GetGuid();
        var approved = await admin.PostAsJsonAsync($"/api/admin/products/{id}/moderate", new { action = "aprovar", note = "Copo de vidro, não é bebida." }, Json);
        Assert.Equal("Ativo", (await ReadAsync(approved)).GetProperty("status").GetString());
        // Salvar de novo o mesmo texto não volta para análise.
        var resaved = await seller.PutAsJsonAsync($"/api/seller/products/{id}", Input("Copo para whisky de vidro 300 ml", "Copo de vidro"), Json);
        Assert.Equal("Ativo", (await ReadAsync(resaved)).GetProperty("status").GetString());

        var actions = await admin.GetFromJsonAsync<JsonElement>("/api/admin/compliance/actions?kind=AnuncioLiberado", Json);
        Assert.Contains(actions.GetProperty("items").EnumerateArray(), a => a.GetProperty("productId").GetGuid() == id);
    }

    [Fact]
    public async Task Measures_AreCommunicated_SellerResponds_AndAdminRevokes()
    {
        var admin = await AdminAsync();
        var sellers = await admin.GetFromJsonAsync<JsonElement>("/api/admin/sellers?q=MegaStore", Json);
        var sellerId = sellers.GetProperty("items")[0].GetProperty("id").GetGuid();

        var infraction = await admin.PostAsJsonAsync($"/api/admin/sellers/{sellerId}/infractions", new
        {
            code = "DIVERGENCIA", description = "Produto enviado diferente do anunciado no pedido de teste.", severity = "Media", intentional = false,
        }, Json);
        Assert.Equal(HttpStatusCode.Created, infraction.StatusCode);
        var result = await ReadAsync(infraction);
        Assert.False(string.IsNullOrWhiteSpace(result.GetProperty("recommendation").GetProperty("rationale").GetString()));

        var suspended = await admin.PutAsJsonAsync($"/api/admin/sellers/{sellerId}", new
        {
            status = "Suspenso", suspensionReason = "Divergência entre anunciado e enviado (Política 7.3 e).", suspensionDays = 7,
        }, Json);
        Assert.Equal(HttpStatusCode.OK, suspended.StatusCode);
        var detail = await ReadAsync(suspended);
        Assert.Equal("Suspenso", detail.GetProperty("summary").GetProperty("status").GetString());
        var measure = detail.GetProperty("governance").GetProperty("measures").EnumerateArray().First(m => m.GetProperty("active").GetBoolean());
        Assert.Equal("SuspensaoTemporaria", measure.GetProperty("type").GetString());

        // A loja suspensa não publica, mas lê as comunicações e responde em 10 dias (Política 8.6).
        var seller = await _factory.LoginAsync();
        var blocked = await seller.PostAsJsonAsync("/api/seller/products", new { name = "Produto qualquer" }, Json);
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Contains("SELLER_SUSPENDED", await blocked.Content.ReadAsStringAsync());
        var notices = await seller.GetFromJsonAsync<JsonElement>("/api/seller/notices", Json);
        var notice = notices.GetProperty("items").EnumerateArray().First(n => n.GetProperty("type").GetString() == "Medida");
        Assert.True(notice.GetProperty("dueAt").GetDateTime() > DateTime.UtcNow.AddDays(9));
        var status = await seller.GetFromJsonAsync<JsonElement>("/api/seller/compliance", Json);
        Assert.Equal("Suspenso", status.GetProperty("status").GetString());

        var response = await seller.PostAsJsonAsync($"/api/seller/notices/{notice.GetProperty("id").GetGuid()}/respond",
            new { text = "O pedido foi trocado por engano no depósito; segue a nota de reenvio.", files = new[] { "/images/kyc/constancia-ruc.svg" } }, Json);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Respondida", (await ReadAsync(response)).GetProperty("status").GetString());

        var revoked = await admin.PostAsJsonAsync($"/api/admin/sellers/{sellerId}/measures/{measure.GetProperty("id").GetGuid()}/revoke",
            new { reason = "Resposta do vendedor acolhida." }, Json);
        Assert.Equal(HttpStatusCode.OK, revoked.StatusCode);
        var after = await admin.GetFromJsonAsync<JsonElement>($"/api/admin/sellers/{sellerId}", Json);
        Assert.Equal("Aprovado", after.GetProperty("summary").GetProperty("status").GetString());
    }

    [Fact]
    public async Task ExcludedSeller_CannotRegisterAgainWithSameDocuments()
    {
        var admin = await AdminAsync();
        var sellers = await admin.GetFromJsonAsync<JsonElement>("/api/admin/sellers?q=Sport", Json);
        var sellerId = sellers.GetProperty("items")[0].GetProperty("id").GetGuid();
        var excluded = await admin.PutAsJsonAsync($"/api/admin/sellers/{sellerId}", new
        {
            status = "Excluido", suspensionReason = "Reincidência em contrafação comprovada (Política 8.1 c).",
        }, Json);
        Assert.Equal("Excluido", (await ReadAsync(excluded)).GetProperty("summary").GetProperty("status").GetString());

        // Mesmo representante (cédula do seed da Sport House: índice 6) com outro RUC.
        var client = _factory.CreateClient();
        var email = $"loja{Guid.NewGuid():N}@example.com";
        var registered = await client.PostAsJsonAsync("/api/auth/register", new { fullName = "Novo Vendedor", email, password = "Senha!2026", acceptTerms = true }, Json);
        Assert.Equal(HttpStatusCode.Created, registered.StatusCode);
        var token = (await ReadAsync(registered)).GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var categories = await client.GetFromJsonAsync<JsonElement>("/api/categories", Json);
        var esportes = categories.EnumerateArray().First(c => c.GetProperty("slug").GetString() == "esportes").GetProperty("id").GetGuid();
        object Register(string document, bool acceptPolicy) => new
        {
            name = "Esportes Nova Era", ruc = "80012346-8", city = "Ciudad del Este", description = "Artigos esportivos com garantia e envio rápido.",
            categoryIds = new[] { esportes }, acceptTerms = true, acceptSellerPolicy = acceptPolicy, representativeDeclaration = true,
            phone = "+595 61 500 900", legalAddress = "Av. Paraguay 100, Centro", responsibleName = "Paula Villalba", responsibleDocumentType = "CedulaPy",
            responsibleDocument = document, identityDocumentUrl = "/images/kyc/documento-responsavel.svg", rucCertificateUrl = "/images/kyc/constancia-ruc.svg",
            legalName = "Esportes Nova Era S.A.", email = "contato@novaera.com.py", payoutMethod = "ContaBancaria", payoutInstitution = "Banco Basa",
            payoutAccount = "998877665", payoutHolder = "Esportes Nova Era S.A.", taxComplianceCertificateUrl = "/images/kyc/certificado-cumplimiento.svg",
            articlesOfIncorporationUrl = "/images/kyc/atos-constitutivos.svg",
        };

        var noPolicy = await client.PostAsJsonAsync("/api/seller/register", Register("4500001", acceptPolicy: false), Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, noPolicy.StatusCode);
        Assert.Contains("acceptSellerPolicy", await noPolicy.Content.ReadAsStringAsync());

        var sameRepresentative = await client.PostAsJsonAsync("/api/seller/register", Register($"{3_100_000 + 6 * 271_113}", acceptPolicy: true), Json);
        Assert.Equal(HttpStatusCode.Conflict, sameRepresentative.StatusCode);
        Assert.Contains("SELLER_EXCLUDED", await sameRepresentative.Content.ReadAsStringAsync());

        var fresh = await client.PostAsJsonAsync("/api/seller/register", Register("4500001", acceptPolicy: true), Json);
        Assert.Equal(HttpStatusCode.Created, fresh.StatusCode);
        var profile = (await ReadAsync(fresh)).GetProperty("seller");
        Assert.Equal("Pendente", profile.GetProperty("status").GetString());
        Assert.True(profile.GetProperty("verification").GetProperty("admissionComplete").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(profile.GetProperty("verification").GetProperty("policyVersionAccepted").GetString()));
    }

    [Fact]
    public async Task ReceitaFederal_DeadlinesAndContestation()
    {
        var admin = await AdminAsync();
        var plan = await ReadAsync(await admin.PostAsJsonAsync("/api/admin/compliance/rf", new { type = "PlanoDeAcao", indicator = "Contrafacao", reference = "DTE 123" }, Json));
        Assert.Equal(30, (int)Math.Round((plan.GetProperty("dueAt").GetDateTime() - plan.GetProperty("openedAt").GetDateTime()).TotalDays));

        var monthly = await admin.PostAsJsonAsync("/api/admin/compliance/rf", new { type = "ConsultaMensal", officialCounterfeitPermyriad = 9985 }, Json);
        Assert.Equal(HttpStatusCode.Created, monthly.StatusCode);
        var duplicate = await admin.PostAsJsonAsync("/api/admin/compliance/rf", new { type = "ConsultaMensal" }, Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, duplicate.StatusCode);

        var occurrence = await ReadAsync(await admin.PostAsJsonAsync("/api/admin/compliance/occurrences", new
        {
            indicator = "Subvaloracao", source = "Siscomex", code = "VALOR_MAJORADO", description = "Valor majorado por erro de câmbio na DIR.",
        }, Json));
        var occurrenceId = occurrence.GetProperty("id").GetGuid();
        var wrongGround = await admin.PostAsJsonAsync($"/api/admin/compliance/occurrences/{occurrenceId}/status", new { status = "Contestada", reason = "Não concordamos." }, Json);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, wrongGround.StatusCode);

        var contested = await admin.PostAsJsonAsync("/api/admin/compliance/contestations", new
        {
            indicator = "Subvaloracao", occurrenceIds = new[] { occurrenceId }, reason = "ErroMaterial",
            grounds = "A DIR usou a PTAX de outro dia; o valor declarado confere com a fatura e com o pagamento.",
        }, Json);
        Assert.Equal(HttpStatusCode.Created, contested.StatusCode);
        var rf = await ReadAsync(contested);
        var completed = await admin.PostAsJsonAsync($"/api/admin/compliance/rf/{rf.GetProperty("id").GetGuid()}/complete",
            new { response = "Receita acolheu a contestação.", contestationAccepted = true }, Json);
        Assert.Equal(HttpStatusCode.OK, completed.StatusCode);
        var occurrences = await admin.GetFromJsonAsync<JsonElement>("/api/admin/compliance/occurrences?indicator=Subvaloracao&pageSize=50", Json);
        Assert.Equal("Anulada", occurrences.GetProperty("items").EnumerateArray().First(o => o.GetProperty("id").GetGuid() == occurrenceId).GetProperty("status").GetString());

        var program = await admin.GetFromJsonAsync<JsonElement>("/api/admin/compliance/program", Json);
        Assert.True(program.GetProperty("currentMonthReview").GetProperty("done").GetBoolean());
        Assert.Contains(program.GetProperty("tasks").EnumerateArray(), t => t.GetProperty("key").GetString() == "responsavel");

        var training = await admin.PostAsJsonAsync("/api/admin/compliance/trainings", new
        {
            personName = "Administrador", personEmail = "admin@mktpy.com", role = "Moderação", topic = "Programa Remessa Conforme e Política de Vendedores", initial = true,
        }, Json);
        Assert.Equal(HttpStatusCode.OK, training.StatusCode);
        var people = (await ReadAsync(training)).GetProperty("people");
        Assert.False(people.EnumerateArray().First(p => p.GetProperty("email").GetString() == "admin@mktpy.com").GetProperty("due").GetBoolean());
    }

    [Fact]
    public async Task PaidOrder_HasReceipt_AndPrivateDocumentsNeedSignedLink()
    {
        var buyer = await _factory.LoginAsync();
        var orders = await buyer.GetFromJsonAsync<JsonElement>("/api/orders?status=Entregue", Json);
        var orderId = orders.GetProperty("items")[0].GetProperty("id").GetString();
        var receipt = await buyer.GetAsync($"/api/orders/{orderId}/receipt");
        Assert.Equal(HttpStatusCode.OK, receipt.StatusCode);
        Assert.Equal("application/pdf", receipt.Content.Headers.ContentType?.MediaType);
        Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString(await receipt.Content.ReadAsByteArrayAsync())[..4]);

        var upload = await ReadAsync(await buyer.PostAsJsonAsync("/api/seller/documents/uploads", new { fileName = "ruc.pdf", contentType = "application/pdf", sizeBytes = 20 }, Json));
        var key = upload.GetProperty("storageKey").GetString()!;
        Assert.StartsWith("doc/", key);
        var put = new HttpRequestMessage(HttpMethod.Put, upload.GetProperty("uploadUrl").GetString())
        {
            Content = new ByteArrayContent("%PDF-1.4\n% teste\n%%EOF"u8.ToArray()[..20]),
        };
        put.Content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        Assert.Equal(HttpStatusCode.NoContent, (await _factory.CreateClient().SendAsync(put)).StatusCode);

        var anonymous = _factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/documents/{key}")).StatusCode);
        var signed = await anonymous.GetAsync(upload.GetProperty("publicUrl").GetString());
        Assert.Equal(HttpStatusCode.OK, signed.StatusCode);
        Assert.Equal("application/pdf", signed.Content.Headers.ContentType?.MediaType);
    }

    /// <summary>Produto barato da MegaStore, sem variações e com estoque para duas compras.</summary>
    internal static async Task<(Guid ProductId, Guid SellerId)> PickMegaStoreProductAsync(HttpClient client)
    {
        var list = await client.GetFromJsonAsync<JsonElement>("/api/products?sellerSlug=megastore-paraguay&maxPrice=20000&pageSize=50", Json);
        foreach (var item in list.GetProperty("items").EnumerateArray())
        {
            var detail = await client.GetFromJsonAsync<JsonElement>($"/api/products/{item.GetProperty("slug").GetString()}", Json);
            if (detail.GetProperty("variants").GetArrayLength() == 0 && detail.GetProperty("stock").GetInt32() >= 2)
                return (detail.GetProperty("id").GetGuid(), detail.GetProperty("seller").GetProperty("id").GetGuid());
        }
        throw new InvalidOperationException("Nenhum produto barato da MegaStore sem variações.");
    }

    [Fact]
    public async Task SuspendedSeller_DoesNotSell_EvenFromAQuoteMadeBefore()
    {
        var buyer = await _factory.LoginAsync();
        var (productId, sellerId) = await PickMegaStoreProductAsync(buyer);
        var addresses = await buyer.GetFromJsonAsync<JsonElement>("/api/me/addresses", Json);
        var addressId = addresses.EnumerateArray().First(a => a.GetProperty("isDefault").GetBoolean()).GetProperty("id").GetGuid();
        var groups = new[] { new { sellerId, shippingOptionId = (Guid?)null, items = new[] { new { productId, variantId = (Guid?)null, quantity = 1 } } } };
        var quote = await ReadAsync(await buyer.PostAsJsonAsync("/api/checkout/quotes", new { postalCode = "01310100", groups }, Json));

        var admin = await AdminAsync();
        var suspended = await ReadAsync(await admin.PutAsJsonAsync($"/api/admin/sellers/{sellerId}", new
        {
            status = "Suspenso", suspensionReason = "Teste: loja suspensa não vende pelo carrinho antigo (Política 8.1 b).", suspensionDays = 3,
        }, Json));
        var measureId = suspended.GetProperty("governance").GetProperty("measures").EnumerateArray().First(m => m.GetProperty("active").GetBoolean()).GetProperty("id").GetGuid();
        try
        {
            // Cotação feita antes da suspensão: o pedido não conclui.
            var placed = await buyer.PostAsJsonAsync("/api/orders", new
            {
                quoteId = quote.GetProperty("quoteId").GetGuid(), addressId,
                exchangeRateId = quote.GetProperty("exchangeRate").GetProperty("id").GetGuid(), idempotencyKey = Guid.NewGuid().ToString(),
                groups = new[] { new { sellerId, shippingOptionId = quote.GetProperty("groups")[0].GetProperty("selectedShippingOptionId").GetGuid(), items = new[] { new { productId, variantId = (Guid?)null, quantity = 1 } } } },
                payment = new { method = "Pix", payerDocument = "529.982.247-25" },
            }, Json);
            Assert.Equal(HttpStatusCode.UnprocessableEntity, placed.StatusCode);
            Assert.Contains("não está vendendo", (await ReadAsync(placed)).GetProperty("errors").GetProperty("items")[0].GetString());

            // Nova cotação também não sai.
            var requote = await buyer.PostAsJsonAsync("/api/checkout/quotes", new { postalCode = "01310100", groups }, Json);
            Assert.Equal(HttpStatusCode.UnprocessableEntity, requote.StatusCode);
        }
        finally
        {
            await admin.PostAsJsonAsync($"/api/admin/sellers/{sellerId}/measures/{measureId}/revoke", new { reason = "Fim do teste." }, Json);
        }
        Assert.Equal(HttpStatusCode.OK, (await buyer.PostAsJsonAsync("/api/checkout/quotes", new { postalCode = "01310100", groups }, Json)).StatusCode);
    }

    [Fact]
    public async Task DataCorrection_WrittenReplyDoesNotStopTheClock_AndRejectionKeepsTheDeadline()
    {
        var admin = await AdminAsync();
        var seller = await _factory.LoginAsync();
        var sellers = await admin.GetFromJsonAsync<JsonElement>("/api/admin/sellers?q=MegaStore", Json);
        var sellerId = sellers.GetProperty("items")[0].GetProperty("id").GetGuid();

        var created = await admin.PostAsJsonAsync($"/api/admin/sellers/{sellerId}/notices", new
        {
            type = "AtualizacaoCadastral", message = "O telefone da empresa não atende; corrija ou confirme o número cadastrado.",
        }, Json);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var notice = await ReadAsync(created);
        var noticeId = notice.GetProperty("id").GetGuid();
        var due = notice.GetProperty("dueAt").GetDateTime();

        // Só escrever não encerra o pedido (Política 8.4): ele continua aberto, com o prazo correndo.
        var replied = await ReadAsync(await seller.PostAsJsonAsync($"/api/seller/notices/{noticeId}/respond",
            new { text = "Vamos verificar a linha telefônica com a operadora." }, Json));
        Assert.Equal("Aberta", replied.GetProperty("status").GetString());

        // Confirmar os dados no cadastro, sim; a resposta escrita é mantida.
        Assert.Equal(HttpStatusCode.OK, (await seller.PostAsync("/api/seller/profile/confirm", null)).StatusCode);
        var confirmed = await seller.GetFromJsonAsync<JsonElement>($"/api/seller/notices/{noticeId}", Json);
        Assert.Equal("Respondida", confirmed.GetProperty("status").GetString());
        Assert.Contains("operadora", confirmed.GetProperty("responseText").GetString());

        // A equipe recusa dentro do prazo: novo pedido aberto com o mesmo prazo da solicitação original.
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/notices/{noticeId}/resolve",
            new { accepted = false, resolution = "O número confirmado continua sem atender." }, Json)).StatusCode);
        var open = (await seller.GetFromJsonAsync<JsonElement>("/api/seller/notices?status=Aberta", Json)).GetProperty("items").EnumerateArray()
            .First(n => n.GetProperty("type").GetString() == "AtualizacaoCadastral");
        Assert.True(Math.Abs((open.GetProperty("dueAt").GetDateTime() - due).TotalSeconds) < 1);
        var reissuedId = open.GetProperty("id").GetGuid();

        // Recusa depois do prazo: loja suspensa; atualizar o cadastro levanta a suspensão automática.
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            await db.SellerNotices.Where(n => n.Id == reissuedId).ExecuteUpdateAsync(s => s.SetProperty(n => n.DueAt, DateTime.UtcNow.AddHours(-1)));
        }
        Assert.Equal(HttpStatusCode.OK, (await seller.PostAsync("/api/seller/profile/confirm", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsJsonAsync($"/api/admin/notices/{reissuedId}/resolve",
            new { accepted = false, resolution = "Continua sem atender depois do prazo." }, Json)).StatusCode);
        Assert.Equal("Suspenso", (await seller.GetFromJsonAsync<JsonElement>("/api/seller/compliance", Json)).GetProperty("status").GetString());

        Assert.Equal(HttpStatusCode.OK, (await seller.PostAsync("/api/seller/profile/confirm", null)).StatusCode);
        Assert.Equal("Aprovado", (await seller.GetFromJsonAsync<JsonElement>("/api/seller/compliance", Json)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task SplitPurchases_RaiseFractioningAlert_AndHoldTheLabel()
    {
        var buyer = await _factory.LoginAsync();
        var (productId, sellerId) = await PickMegaStoreProductAsync(buyer);
        var addresses = await buyer.GetFromJsonAsync<JsonElement>("/api/me/addresses", Json);
        var addressId = addresses.EnumerateArray().First(a => a.GetProperty("isDefault").GetBoolean()).GetProperty("id").GetGuid();

        async Task<Guid> BuyAsync()
        {
            var groups = new[] { new { sellerId, shippingOptionId = (Guid?)null, items = new[] { new { productId, variantId = (Guid?)null, quantity = 1 } } } };
            var quote = await ReadAsync(await buyer.PostAsJsonAsync("/api/checkout/quotes", new { postalCode = "01310100", groups }, Json));
            var placed = await buyer.PostAsJsonAsync("/api/orders", new
            {
                quoteId = quote.GetProperty("quoteId").GetGuid(), addressId,
                exchangeRateId = quote.GetProperty("exchangeRate").GetProperty("id").GetGuid(), idempotencyKey = Guid.NewGuid().ToString(),
                groups = new[] { new { sellerId, shippingOptionId = quote.GetProperty("groups")[0].GetProperty("selectedShippingOptionId").GetGuid(), items = new[] { new { productId, variantId = (Guid?)null, quantity = 1 } } } },
                payment = new { method = "Pix", payerDocument = "529.982.247-25" },
            }, Json);
            Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
            var body = await ReadAsync(placed);
            await buyer.PostAsync($"/api/payments/{body.GetProperty("payment").GetProperty("id").GetGuid()}/simulate-approval", null);
            return body.GetProperty("orders")[0].GetProperty("id").GetGuid();
        }

        var first = await BuyAsync();
        await BuyAsync();

        var admin = await AdminAsync();
        var alerts = await admin.GetFromJsonAsync<JsonElement>("/api/admin/compliance/alerts?status=Aberto&type=Fracionamento", Json);
        var alert = alerts.GetProperty("items").EnumerateArray().First(a => a.GetProperty("holdsShipments").GetBoolean());

        var held = await buyer.PostAsync($"/api/seller/orders/{first}/shipment", null);
        Assert.Equal(HttpStatusCode.Conflict, held.StatusCode);
        Assert.Contains("MONITORING_HOLD", await held.Content.ReadAsStringAsync());

        var resolved = await admin.PostAsJsonAsync($"/api/admin/compliance/alerts/{alert.GetProperty("id").GetGuid()}/resolve",
            new { upheld = false, note = "Compras em dias diferentes para uso próprio.", registerInfraction = false }, Json);
        Assert.Equal(HttpStatusCode.OK, resolved.StatusCode);
        var label = await buyer.PostAsync($"/api/seller/orders/{first}/shipment", null);
        Assert.Equal(HttpStatusCode.Created, label.StatusCode);

        // A etiqueta saiu com a descrição da declaração e a conferência do CPF registradas no pedido.
        var order = await buyer.GetFromJsonAsync<JsonElement>($"/api/orders/{first}", Json);
        Assert.Equal("EmPreparacao", order.GetProperty("status").GetString());

        var run = await admin.PostAsync("/api/admin/compliance/monitor/run", null);
        Assert.Equal(HttpStatusCode.OK, run.StatusCode);
    }
}
