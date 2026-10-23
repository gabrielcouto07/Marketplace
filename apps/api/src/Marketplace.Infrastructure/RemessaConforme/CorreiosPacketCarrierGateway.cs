using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Marketplace.Application.Abstractions;
using Marketplace.Domain.Common;
using Marketplace.Infrastructure.Shipping;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.RemessaConforme;

/// <summary>
/// Correios Packet, importação direta (Guia de Integração da API v2.9.1). Token em
/// <c>POST /token/v1/autentica/cartaopostagem</c> (Basic usuário:senha, corpo <c>{"numero": cartão}</c>), válido por 24 h;
/// pacote em <c>POST /packet/v1/packages</c> com <c>taxPaymentMethod</c> "PRC", valores em BRL e II/ICMS provisionados.
/// A API não devolve etiqueta (o cliente imprime com o código de rastreio, via <see cref="LabelPdf"/>), não cancela pacote
/// (o que não entra em unitizador/CN38 não é postado nem cobrado) e não tem repasse à parte: os tributos provisionados vão
/// no pacote e entram na fatura da CN38. Criar pacote não é idempotente: o mesmo customerControlCode gera outro rastreio.
/// </summary>
public sealed partial class CorreiosPacketCarrierGateway(
    IHttpClientFactory httpFactory,
    IOptions<RemessaConformeOptions> options,
    TimeProvider clock,
    ILogger<CorreiosPacketCarrierGateway> logger) : IRemessaCarrierGateway
{
    public const string HttpClientName = "correios-packet";
    public const string CarrierLabel = "Correios";
    public const int MaxItems = 20;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static readonly Encoding Cp1252 = CreateCp1252();

    private static Encoding CreateCp1252()
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        return Encoding.GetEncoding(1252, new EncoderReplacementFallback(""), new DecoderReplacementFallback(""));
    }

    private readonly SemaphoreSlim _tokenLock = new(1, 1);
    private string? _token;
    private DateTimeOffset _tokenExpiresAt;

    private CorreiosPacketOptions O => options.Value.Carrier.Correios;

    private HttpClient http => httpFactory.CreateClient(HttpClientName);

    /// <summary>"correios" em produção; "correios-hom" em homologação (rastreios de teste, etiqueta marcada).</summary>
    public string Name => O.IsHomologation ? "correios-hom" : "correios";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(O.BaseUrl) && !string.IsNullOrWhiteSpace(O.User)
                                && !string.IsNullOrWhiteSpace(O.Password) && !string.IsNullOrWhiteSpace(O.PostageCard);

    public bool IsSandbox => O.IsHomologation;

    public async Task<RemessaShipmentResult> CreateShipmentAsync(RemessaShipmentRequest request, CancellationToken ct)
    {
        var payload = new { packageList = new[] { ToPackage(request, O.NonNationalizationInstruction, O.IsHomologation ? O.HomologationEceCode : null) } };
        using var response = await SendAsync(() => new HttpRequestMessage(HttpMethod.Post, Url("packet/v1/packages"))
        {
            Content = JsonContent.Create(payload, options: Json),
        }, ct);
        await EnsureSuccessAsync(response, "criar pacote", ct);
        var body = await response.Content.ReadFromJsonAsync<PackageResponse>(Json, ct);
        var tracking = body?.PackageResponseList?.FirstOrDefault()?.TrackingNumber?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(tracking)) throw new InvalidOperationException("Os Correios não devolveram o trackingNumber.");
        var pdf = LabelPdf.Build(request, tracking, CarrierLabel, null, sandbox: IsSandbox);
        return new RemessaShipmentResult(tracking, tracking, CarrierLabel, null, pdf, null);
    }

    /// <summary>A API não cancela pacote (só unitizador e despacho): pacote fora de CN35/CN38 não é postado nem cobrado.</summary>
    public Task CancelShipmentAsync(string providerReference, CancellationToken ct) => Task.CompletedTask;

    /// <summary>
    /// Sem repasse à parte: II e ICMS foram provisionados no pacote e entram na fatura da CN38. Confirma quando a DIR do
    /// pacote aparece em "Get Packages Provisioned Values" (a referência passa a ser o número da DIR).
    /// </summary>
    public async Task<TaxRemittanceResult> RemitTaxesAsync(TaxRemittanceRequest request, CancellationToken ct)
    {
        var tracking = request.TrackingCode.Trim().ToUpperInvariant();
        if (tracking.Length == 0) return new TaxRemittanceResult(request.RemittanceId.ToString(), Confirmed: false);
        using var response = await SendAsync(() => new HttpRequestMessage(HttpMethod.Get,
            Url($"packet/v1/packages/provisioned-values?trackingNumber={Uri.EscapeDataString(tracking)}")), ct);
        await EnsureSuccessAsync(response, "consultar tributos provisionados", ct);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var dir = DirNumber(doc.RootElement, tracking);
        return dir is null ? new TaxRemittanceResult(tracking, Confirmed: false) : new TaxRemittanceResult($"DIR {dir}", Confirmed: true);
    }

    public Task<byte[]?> ReprintLabelAsync(RemessaShipmentRequest request, string trackingCode, string carrier, string? declarationNumber,
        CancellationToken ct) =>
        Task.FromResult<byte[]?>(LabelPdf.Build(request, trackingCode, carrier, declarationNumber, sandbox: IsSandbox));

    private static string? DirNumber(JsonElement root, string tracking)
    {
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("packageList", out var list) || list.ValueKind != JsonValueKind.Array)
            return null;
        foreach (var p in list.EnumerateArray())
            if (p.TryGetProperty("trackingNumber", out var t) && string.Equals(t.GetString(), tracking, StringComparison.OrdinalIgnoreCase)
                && p.TryGetProperty("dirNumber", out var d) && d.ValueKind is JsonValueKind.String or JsonValueKind.Number
                && d.ToString() is { Length: > 0 } dir)
                return dir;
        return null;
    }

    // ----- Corpo do Package Request -----

    /// <summary>Mercadoria do pacote: "value" é o valor unitário (item 5.1 do guia).</summary>
    public sealed record PackageItem(string Ncm, string Description, int Quantity, long UnitCents);

    /// <summary>Um item de "packageList" (Package Request, item 5.1 do guia), no regime PRC e em BRL.</summary>
    /// <param name="testEceCode">senderCodeEce quando a empresa não tem CNPJ/TIN configurado (só na homologação).</param>
    public static object ToPackage(RemessaShipmentRequest r, string nonNationalizationInstruction = "RETURNTOORIGIN", string? testEceCode = null)
    {
        var p = r.Platform;
        var hasDocument = !string.IsNullOrWhiteSpace(p.Document);
        if (!hasDocument && string.IsNullOrWhiteSpace(testEceCode))
            throw new RemessaRejectedException("Configure o CNPJ/TIN da empresa (RemessaConforme:Platform:Document): vai no senderCodeEce do pacote PRC.");
        if (r.Items.Count == 0) throw new RemessaRejectedException("A remessa não tem mercadorias.");
        var phone = Phone(r.Recipient.Phone)
                    ?? throw new RemessaRejectedException("Telefone do destinatário inválido: os Correios pedem DDD + número (10 ou 11 dígitos).");
        if (string.IsNullOrWhiteSpace(r.Recipient.Email)) throw new RemessaRejectedException("O e-mail do destinatário é obrigatório nos Correios.");
        var (freight, items) = Values(r);
        if (items.Count > MaxItems) throw new RemessaRejectedException($"O pacote dos Correios aceita até {MaxItems} mercadorias.");

        var sender = SplitAddress(r.Sender.AddressLine);
        var recipientNumber = r.Recipient.Number ?? SplitAddress(r.Recipient.AddressLine).Number;
        var d = r.Dimensions;
        // PRC: senderWebsite leva o nome da ECE como está no ADE (até 30 caracteres).
        var eceName = !string.IsNullOrWhiteSpace(p.LegalName) && p.LegalName.Trim().Length <= 30 ? p.LegalName : p.TradeName;
        return new
        {
            customerControlCode = Text(r.OrderNumber, 100),
            senderName = Text(r.Sender.Name, 70),
            senderAddress = Text(sender.Street, 140),
            senderAddressNumber = sender.Number,
            senderAddressComplement = TextOrNull(sender.Complement, 50),
            senderZipCode = TextOrNull(r.Sender.PostalCode, 20),
            senderCityName = Text(r.Sender.City, 50),
            senderState = r.Sender.State?.Trim() is { Length: 2 } st ? st.ToUpperInvariant() : null,
            senderCountryCode = r.Sender.Country.Trim().ToUpperInvariant(),
            senderEmail = TextOrNull(r.Sender.Email, 50),
            senderWebsite = Text(eceName, 30),
            recipientName = Text(r.Recipient.Name, 70),
            recipientDocumentType = "CPF",
            recipientDocumentNumber = Documents.OnlyDigits(r.Recipient.Document),
            recipientAddress = Text(r.Recipient.Street ?? r.Recipient.AddressLine, 170),
            recipientAddressNumber = Text(string.IsNullOrWhiteSpace(recipientNumber) ? "S/N" : recipientNumber, 10),
            recipientAddressComplement = TextOrNull(string.Join(" – ", new[] { r.Recipient.Complement, r.Recipient.District }
                .Where(s => !string.IsNullOrWhiteSpace(s))), 50),
            recipientCityName = Text(r.Recipient.City, 100),
            recipientState = r.Recipient.State?.Trim().ToUpperInvariant(),
            recipientZipCode = Documents.OnlyDigits(r.Recipient.PostalCode),
            recipientEmail = Text(r.Recipient.Email, 50),
            recipientPhoneNumber = phone,
            totalWeight = Math.Max(1, r.WeightGrams),
            // Mínimos da embalagem no guia: 16 × 11 × 2 cm.
            packagingLength = Math.Max(16, d?.LengthCm ?? 0),
            packagingWidth = Math.Max(11, d?.WidthCm ?? 0),
            packagingHeight = Math.Max(2, d?.HeightCm ?? 0),
            distributionModality = string.Equals(r.ServiceCode, TableShippingRateProvider.ExpressService, StringComparison.OrdinalIgnoreCase)
                ? "33170" // PACKET EXPRESS
                : "33162", // PACKET STANDARD
            taxPaymentMethod = "PRC",
            currency = "BRL",
            nonNationalizationInstruction,
            freightPaidValue = Dec(freight),
            insurancePaidValue = r.Insurance.Amount > 0 ? Dec(r.Insurance.Amount) : (decimal?)null,
            provisionedTaxValue = Dec(r.Taxes.ImportDuty.Amount),
            provisionedIcmsValue = Dec(r.Taxes.Icms.Amount),
            senderCodeEce = !hasDocument ? Text(testEceCode, 20) : p.DocumentType == "CNPJ" ? Documents.OnlyDigits(p.Document) : Text(p.Document, 20),
            generalDescription = Text(r.Description, 500),
            items = items.Select(i => new
            {
                hsCode = Documents.OnlyDigits(i.Ncm),
                description = Text(i.Description, 500),
                quantity = i.Quantity,
                value = Dec(i.UnitCents),
            }),
        };
    }

    /// <summary>
    /// Frete e mercadorias que somam exatamente o valor aduaneiro (frete + seguro + itens = valor cobrado do comprador). O
    /// pacote não tem campo de desconto: o desconto (e outras despesas) é rateado nos itens pelo valor de cada linha. O frete
    /// mínimo da API é R$ 0,01, então no frete grátis um centavo sai dos itens para o frete. Quando o valor rateado da linha
    /// não divide pela quantidade, a linha vira duas (preços unitários com um centavo de diferença).
    /// </summary>
    public static (long FreightCents, List<PackageItem> Items) Values(RemessaShipmentRequest r)
    {
        var freight = Math.Max(1, r.Freight.Amount);
        var target = r.CustomsValue.Amount - freight - r.Insurance.Amount;
        var lines = r.Items.Select(i => Math.Max(0, i.TotalValue.Amount)).ToArray();
        var total = lines.Sum();
        var shares = new long[lines.Length];
        if (total > 0)
        {
            for (var i = 0; i < lines.Length; i++) shares[i] = (long)Math.Floor((decimal)target * lines[i] / total);
            var left = target - shares.Sum();
            foreach (var i in Enumerable.Range(0, lines.Length).OrderByDescending(i => lines[i]).Take((int)Math.Max(0, left))) shares[i]++;
        }
        else shares[0] = target;

        var items = new List<PackageItem>();
        for (var i = 0; i < lines.Length; i++)
        {
            var item = r.Items[i];
            var quantity = Math.Max(1, item.Quantity);
            var unit = shares[i] / quantity;
            var extra = (int)(shares[i] % quantity);
            items.Add(new PackageItem(item.Ncm, item.Description, quantity - extra, unit));
            if (extra > 0) items.Add(new PackageItem(item.Ncm, item.Description, extra, unit + 1));
        }
        return (freight, items);
    }

    /// <summary>DDD + número, sem o 55 e sem o zero de longa distância: 10 dígitos (fixo) ou 11 (celular).</summary>
    public static string? Phone(string? value)
    {
        var digits = Documents.OnlyDigits(value);
        if (digits.Length is 12 or 13 && digits.StartsWith("55", StringComparison.Ordinal)) digits = digits[2..];
        digits = digits.TrimStart('0');
        return digits.Length is 10 or 11 ? digits : null;
    }

    /// <summary>
    /// Endereço numa linha só (o do remetente) em rua, número e complemento: o número é o primeiro grupo de dígitos seguido
    /// de vírgula, hífen ou fim ("Av. San Blas 455, Km 4" → "Av. San Blas", "455", "Km 4"). Sem número, vai "0": a API só
    /// aceita dígitos no número do remetente.
    /// </summary>
    public static (string Street, string Number, string? Complement) SplitAddress(string? line)
    {
        var text = (line ?? string.Empty).Trim();
        var m = AddressNumber().Match(text);
        if (!m.Success) return (text, "0", null);
        var rest = m.Groups["rest"].Value.Trim(' ', ',', '-', '–');
        return (m.Groups["street"].Value.Trim(' ', ','), m.Groups["number"].Value, rest.Length == 0 ? null : rest);
    }

    /// <summary>Texto no conjunto da Europa Ocidental (Windows-1252), como o guia exige (item 2.4), numa linha e no tamanho do campo.</summary>
    public static string Text(string? value, int max)
    {
        var s = Spaces().Replace(Cp1252.GetString(Cp1252.GetBytes(value ?? string.Empty)), " ").Trim();
        return s.Length > max ? s[..max].TrimEnd() : s;
    }

    private static string? TextOrNull(string? value, int max) => Text(value, max) is { Length: > 0 } s ? s : null;

    private static decimal Dec(long cents) => cents / 100m;

    [GeneratedRegex(@"^(?<street>.+?)[\s,]+(?:n[º°o.]\s*)?(?<number>\d{1,6})(?=\s*(?:,|-|–|$))(?<rest>.*)$", RegexOptions.IgnoreCase)]
    private static partial Regex AddressNumber();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();

    // ----- HTTP e token -----

    private Uri Url(string path) => new(new Uri(O.BaseUrl.TrimEnd('/') + "/"), path);

    /// <summary>
    /// Envia com o token em cache. Token vencido ou inválido volta 403 ("GTW-006: Token inválido.") ou 401 sem processar o
    /// pedido, então renova e repete uma vez. Estouro de tempo vira erro do operador com aviso: o pacote pode ter sido criado.
    /// </summary>
    private async Task<HttpResponseMessage> SendAsync(Func<HttpRequestMessage> build, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            var token = await TokenAsync(ct);
            var message = build();
            message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            message.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            message.Headers.ExpectContinue = false; // o gateway da API não aceita "Expect: 100-continue" (item 2.4)
            HttpResponseMessage response;
            try
            {
                response = await http.SendAsync(message, ct);
            }
            catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
            {
                throw new HttpRequestException(
                    $"Os Correios não responderam a {message.Method} {message.RequestUri?.AbsolutePath} no tempo limite. Se era a criação, " +
                    "o pacote pode ter sido registrado: confira no SSII pelo número do pedido antes de tentar de novo.", ex);
            }
            if (attempt == 0 && response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            {
                response.Dispose();
                Interlocked.CompareExchange(ref _token, null, token);
                continue;
            }
            return response;
        }
    }

    private async Task<string> TokenAsync(CancellationToken ct)
    {
        if (_token is { } cached && _tokenExpiresAt > clock.GetUtcNow().AddMinutes(5)) return cached;
        await _tokenLock.WaitAsync(ct);
        try
        {
            if (_token is { } again && _tokenExpiresAt > clock.GetUtcNow().AddMinutes(5)) return again;
            var message = new HttpRequestMessage(HttpMethod.Post, Url("token/v1/autentica/cartaopostagem"))
            {
                Content = JsonContent.Create(new { numero = Documents.OnlyDigits(O.PostageCard) }, options: Json),
            };
            message.Headers.Authorization = new AuthenticationHeaderValue("Basic", Convert.ToBase64String(Encoding.UTF8.GetBytes($"{O.User}:{O.Password}")));
            message.Headers.ExpectContinue = false;
            using var response = await http.SendAsync(message, ct);
            if (!response.IsSuccessStatusCode)
                throw new HttpRequestException(
                    $"Token dos Correios recusado ({(int)response.StatusCode}): {ExtractMessage(await response.Content.ReadAsStringAsync(ct)) ?? "sem detalhe"}",
                    null, response.StatusCode);
            var body = await response.Content.ReadFromJsonAsync<TokenResponse>(Json, ct);
            if (string.IsNullOrWhiteSpace(body?.Token)) throw new InvalidOperationException("Os Correios não devolveram o token.");
            _tokenExpiresAt = ExpiresAt(body.ExpiraEm, body.ZoneOffset) ?? clock.GetUtcNow().AddHours(1);
            _token = body.Token;
            logger.LogInformation("Token Correios Packet emitido ({Ambiente}), válido até {ExpiresAt:u}", body.Ambiente, _tokenExpiresAt);
            return _token;
        }
        finally
        {
            _tokenLock.Release();
        }
    }

    /// <summary>"expiraEm" vem sem fuso ("2026-10-24T04:15:00") e "zoneOffset" à parte ("-03:00").</summary>
    public static DateTimeOffset? ExpiresAt(string? expiraEm, string? zoneOffset)
    {
        if (!DateTime.TryParse(expiraEm, CultureInfo.InvariantCulture, DateTimeStyles.None, out var local)) return null;
        var offset = TimeSpan.TryParse((zoneOffset ?? "").TrimStart('+'), CultureInfo.InvariantCulture, out var o) ? o : TimeSpan.FromHours(-3);
        return new DateTimeOffset(DateTime.SpecifyKind(local, DateTimeKind.Unspecified), offset);
    }

    /// <summary>400/409/422 = dados recusados (códigos NEG-/SUA-, não adianta repetir); o resto vira exceção comum.</summary>
    private async Task EnsureSuccessAsync(HttpResponseMessage response, string action, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;
        var text = await response.Content.ReadAsStringAsync(ct);
        var detail = ExtractMessage(text) ?? $"HTTP {(int)response.StatusCode}";
        logger.LogWarning("Correios recusou {Action}: {Status} {Body}", action, (int)response.StatusCode, text.Length > 500 ? text[..500] : text);
        if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict or HttpStatusCode.UnprocessableEntity)
            throw new RemessaRejectedException(detail);
        throw new HttpRequestException($"Correios respondeu {(int)response.StatusCode} ao {action}: {detail}", null, response.StatusCode);
    }

    /// <summary>Erros da API: <c>{"msgs": ["SUA-121: CPF number is invalid.", …], "errorDetails": […]}</c>.</summary>
    public static string? ExtractMessage(string text)
    {
        try
        {
            using var doc = JsonDocument.Parse(text);
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object)
            {
                if (root.TryGetProperty("msgs", out var msgs) && msgs.ValueKind == JsonValueKind.Array)
                {
                    var list = msgs.EnumerateArray().Where(m => m.ValueKind == JsonValueKind.String).Select(m => m.GetString()!).Distinct().ToList();
                    if (list.Count > 0) return string.Join(" ", list);
                }
                foreach (var name in new[] { "message", "detail", "error", "title" })
                    if (root.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String) return value.GetString();
            }
        }
        catch (JsonException) { }
        return string.IsNullOrWhiteSpace(text) ? null : text.Length > 300 ? text[..300] : text;
    }

    private sealed record TokenResponse(string? Token, string? ExpiraEm, string? ZoneOffset, string? Ambiente);

    private sealed record PackageResponse(List<PackageResponseItem>? PackageResponseList);

    private sealed record PackageResponseItem(string? CustomerControlCode, string? TrackingNumber);
}
