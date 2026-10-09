using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Marketplace.Application.Abstractions;
using Marketplace.Domain.Common;
using Marketplace.Domain.Compliance;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.RemessaConforme;

public sealed class PlatformIdentityProvider(IOptions<RemessaConformeOptions> options) : IPlatformIdentityProvider
{
    public PlatformIdentity Current
    {
        get
        {
            var p = options.Value.Platform;
            static string? Blank(string s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
            return new PlatformIdentity(p.Brand.Trim(), p.TradeName.Trim(), p.LegalName.Trim(),
                p.DocumentType.Trim().ToUpperInvariant() is "TIN" ? "TIN" : "CNPJ", p.Document.Trim(), p.Country.Trim().ToUpperInvariant(),
                p.AddressLine.Trim(), Blank(p.AdeNumber), Blank(p.OperatorCode), Blank(p.OperatorName));
        }
    }
}

/// <summary>
/// Operador de testes: nada sai da máquina. Gera código de rastreio S10 válido (prefixo SB, país PY), número de declaração
/// de teste e a etiqueta em PDF marcada "SANDBOX · NÃO POSTAR". O repasse é confirmado na hora.
/// </summary>
public sealed class SandboxRemessaCarrierGateway(IOptions<RemessaConformeOptions> options, TimeProvider clock) : IRemessaCarrierGateway
{
    public const string ProviderName = "sandbox";

    public string Name => ProviderName;
    public bool IsConfigured => true;
    public bool IsSandbox => true;

    public Task<RemessaShipmentResult> CreateShipmentAsync(RemessaShipmentRequest request, CancellationToken ct)
    {
        var serial = BitConverter.ToUInt32(SHA256.HashData(request.ShipmentId.ToByteArray()), 0) % 100_000_000;
        var tracking = S10.Build("SB", serial, "PY");
        var declaration = $"SBX-{clock.GetUtcNow():yyyyMMdd}-{serial % 1_000_000:D6}";
        var carrier = string.IsNullOrWhiteSpace(request.CarrierHint) ? options.Value.Carrier.CarrierName : request.CarrierHint!;
        var pdf = LabelPdf.Build(request, tracking, carrier, declaration, sandbox: true);
        return Task.FromResult(new RemessaShipmentResult($"sbx_{request.ShipmentId:N}", tracking, carrier, declaration, pdf, null));
    }

    public Task CancelShipmentAsync(string providerReference, CancellationToken ct) => Task.CompletedTask;

    public Task<TaxRemittanceResult> RemitTaxesAsync(TaxRemittanceRequest request, CancellationToken ct) =>
        Task.FromResult(new TaxRemittanceResult($"SBX-REP-{request.RemittanceId.ToString("N")[..10].ToUpperInvariant()}", Confirmed: true));

    public Task<byte[]?> ReprintLabelAsync(RemessaShipmentRequest request, string trackingCode, string carrier, string? declarationNumber,
        CancellationToken ct) =>
        Task.FromResult<byte[]?>(LabelPdf.Build(request, trackingCode, carrier, declarationNumber, sandbox: true));
}

/// <summary>
/// Operador via HTTP — "Contrato de integração Mercado Paraguai v1" (docs/REMESSA_CONFORME.md): o corpo leva os campos
/// da DIR com os nomes da especificação oficial (remetente, destinatario, mercadorias, remessaConforme…) para o
/// operador (Correios, courier ou intermediária) registrar a declaração e devolver a etiqueta. Basta configurar
/// <c>RemessaConforme:Carrier:BaseUrl</c> e <c>RemessaConforme:Carrier:ApiKey</c>.
/// </summary>
public sealed class HttpRemessaCarrierGateway(
    HttpClient http,
    IOptions<RemessaConformeOptions> options,
    ILogger<HttpRemessaCarrierGateway> logger) : IRemessaCarrierGateway
{
    public const string ProviderName = "http";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private CarrierOptions O => options.Value.Carrier;

    public string Name => ProviderName;
    public bool IsConfigured => !string.IsNullOrWhiteSpace(O.BaseUrl) && !string.IsNullOrWhiteSpace(O.ApiKey);
    public bool IsSandbox => false;

    public async Task<RemessaShipmentResult> CreateShipmentAsync(RemessaShipmentRequest request, CancellationToken ct)
    {
        using var message = Request(HttpMethod.Post, O.ShipmentsPath);
        message.Content = JsonContent.Create(ToPayload(request), options: Json);
        message.Headers.Add("Idempotency-Key", request.ShipmentId.ToString());
        using var response = await http.SendAsync(message, ct);
        await EnsureSuccessAsync(response, "criar remessa", ct);
        var body = await response.Content.ReadFromJsonAsync<CarrierShipmentResponse>(Json, ct)
                   ?? throw new InvalidOperationException("Resposta vazia do operador.");
        if (string.IsNullOrWhiteSpace(body.NumeroRemessa) || string.IsNullOrWhiteSpace(body.Referencia))
            throw new InvalidOperationException("O operador não devolveu numeroRemessa/referencia.");
        byte[]? pdf = string.IsNullOrWhiteSpace(body.EtiquetaPdfBase64) ? null : Convert.FromBase64String(body.EtiquetaPdfBase64);
        if (pdf is null && string.IsNullOrWhiteSpace(body.EtiquetaUrl))
            throw new InvalidOperationException("O operador não devolveu a etiqueta (etiquetaPdfBase64 ou etiquetaUrl).");
        return new RemessaShipmentResult(body.Referencia!, body.NumeroRemessa!.Trim().ToUpperInvariant(),
            string.IsNullOrWhiteSpace(body.Transportadora) ? O.CarrierName : body.Transportadora!, body.NumeroDeclaracao, pdf, body.EtiquetaUrl);
    }

    public async Task CancelShipmentAsync(string providerReference, CancellationToken ct)
    {
        using var message = Request(HttpMethod.Delete, O.CancelPathTemplate.Replace("{reference}", Uri.EscapeDataString(providerReference)));
        using var response = await http.SendAsync(message, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return;
        await EnsureSuccessAsync(response, "cancelar remessa", ct);
    }

    public async Task<TaxRemittanceResult> RemitTaxesAsync(TaxRemittanceRequest request, CancellationToken ct)
    {
        using var message = Request(HttpMethod.Post, O.RemittancesPath);
        message.Headers.Add("Idempotency-Key", request.RemittanceId.ToString());
        message.Content = JsonContent.Create(new
        {
            versao = "1",
            idRepasse = request.RemittanceId,
            pedido = request.OrderNumber,
            numeroRemessa = request.TrackingCode,
            referencia = request.ProviderReference,
            dataPagamento = request.PaidAt.ToString("yyyy-MM-dd'T'HH:mm:ss.fff", CultureInfo.InvariantCulture),
            valorII = Dec(request.Taxes.ImportDuty),
            valorICMS = Dec(request.Taxes.Icms),
            valorIBSEstadual = Dec(request.Taxes.IbsState),
            valorIBSMunicipal = Dec(request.Taxes.IbsMunicipal),
            valorCBS = Dec(request.Taxes.Cbs),
            valorTotal = Dec(request.Taxes.Total),
            moeda = "BRL",
        }, options: Json);
        using var response = await http.SendAsync(message, ct);
        await EnsureSuccessAsync(response, "repassar tributos", ct);
        var body = await response.Content.ReadFromJsonAsync<CarrierRemittanceResponse>(Json, ct);
        return new TaxRemittanceResult(body?.Referencia ?? request.RemittanceId.ToString(), body?.Confirmado ?? false);
    }

    private HttpRequestMessage Request(HttpMethod method, string path)
    {
        var message = new HttpRequestMessage(method, new Uri(new Uri(O.BaseUrl.TrimEnd('/') + "/"), path.TrimStart('/')));
        if (O.ApiKeyHeader.Equals("Authorization", StringComparison.OrdinalIgnoreCase))
            message.Headers.Authorization = new AuthenticationHeaderValue(string.IsNullOrWhiteSpace(O.ApiKeyScheme) ? "Bearer" : O.ApiKeyScheme, O.ApiKey);
        else
            message.Headers.TryAddWithoutValidation(O.ApiKeyHeader, string.IsNullOrWhiteSpace(O.ApiKeyScheme) ? O.ApiKey : $"{O.ApiKeyScheme} {O.ApiKey}");
        message.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return message;
    }

    /// <summary>4xx de dados (400/409/422) = recusa definitiva; o resto vira exceção comum (nova tentativa).</summary>
    private async Task EnsureSuccessAsync(HttpResponseMessage response, string action, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;
        var text = await response.Content.ReadAsStringAsync(ct);
        var detail = ExtractMessage(text) ?? $"HTTP {(int)response.StatusCode}";
        logger.LogWarning("Operador recusou {Action}: {Status} {Body}", action, (int)response.StatusCode, text.Length > 500 ? text[..500] : text);
        if (response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict or HttpStatusCode.UnprocessableEntity)
            throw new RemessaRejectedException(detail);
        throw new HttpRequestException($"Operador respondeu {(int)response.StatusCode} ao {action}: {detail}", null, response.StatusCode);
    }

    private static string? ExtractMessage(string text)
    {
        try
        {
            using var doc = JsonDocument.Parse(text);
            foreach (var name in new[] { "mensagem", "message", "detail", "erro", "error" })
                if (doc.RootElement.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String) return value.GetString();
        }
        catch (JsonException) { }
        return string.IsNullOrWhiteSpace(text) ? null : text.Length > 300 ? text[..300] : text;
    }

    private static decimal Dec(Money m) => m.Amount / 100m;

    /// <summary>Corpo do contrato v1: campos e nomes da DIR (registro de lote) + identidade da plataforma para a etiqueta.</summary>
    public static object ToPayload(RemessaShipmentRequest r)
    {
        var p = r.Platform;
        static object Person(RemessaParty x, string docType) => new
        {
            nome = x.Name,
            tipoDocumento = docType,
            documento = x.Document,
            endereco = new { logradouro = x.AddressLine, cidade = x.City, uf = x.State, cep = x.PostalCode, pais = x.Country },
            telefone = x.Phone,
            email = x.Email,
        };
        return new
        {
            versao = "1",
            idRemessa = r.ShipmentId,
            pedido = r.OrderNumber,
            servico = r.ServiceCode,
            transportadoraSugerida = r.CarrierHint,
            etiqueta = new
            {
                marca = p.Brand,
                nomeComercial = p.TradeName,
                razaoSocial = p.LegalName,
                tipoDocumento = p.DocumentType,
                documento = p.Document,
                ade = p.AdeNumber,
            },
            remessa = new
            {
                descricao = r.Description,
                destinacaoComercial = "n",
                frete = Dec(r.Freight),
                moedaFrete = "BRL",
                freteModoPagto = "PREPAID",
                peso = Math.Round(r.WeightGrams / 1000m, 2),
                volumes = 1,
                dimensoes = r.Dimensions is { } d ? new { comprimentoCm = d.LengthCm, larguraCm = d.WidthCm, alturaCm = d.HeightCm } : null,
                // Tipos de documento da DIR: 1 CPF, 2 CNPJ, 3 Passaporte, 5 TIN (o RUC paraguaio é o TIN do remetente).
                remetente = Person(r.Sender, "5"),
                destinatario = Person(r.Recipient, "1"),
                mercadorias = r.Items.Select(i => new
                {
                    sequencia = i.Sequence.ToString(CultureInfo.InvariantCulture),
                    codElementoNcm = i.Ncm,
                    descricao = i.Description,
                    quantidade = i.Quantity,
                    valor = Dec(i.TotalValue),
                    valorUnitario = Dec(i.UnitValue),
                    moeda = "BRL",
                    peso = i.WeightGrams is { } w ? Math.Round(w / 1000m, 2) : (decimal?)null,
                    paisOrigem = i.OriginCountry,
                }),
                remessaConforme = new
                {
                    codigoECE = p.Document,
                    nomeECE = string.IsNullOrWhiteSpace(p.LegalName) ? p.TradeName : p.LegalName,
                    codigoOND = p.OperatorCode,
                    nomeOND = p.OperatorName,
                    dataCompra = r.PurchasedAt.ToString("yyyy-MM-dd'T'HH:mm:ss.fff", CultureInfo.InvariantCulture),
                    valorProvII = Dec(r.Taxes.ImportDuty),
                    valorProvICMS = Dec(r.Taxes.Icms),
                    valorProvIBSEstadual = Dec(r.Taxes.IbsState),
                    valorProvIBSMunicipal = Dec(r.Taxes.IbsMunicipal),
                    valorProvCBS = Dec(r.Taxes.Cbs),
                },
            },
            valores = new
            {
                produtos = Dec(r.Products),
                frete = Dec(r.Freight),
                seguro = Dec(r.Insurance),
                desconto = Dec(r.Discount),
                valorAduaneiro = Dec(r.CustomsValue),
                valorAduaneiroUsd = r.CustomsValueUsdCents is { } usd ? usd / 100m : (decimal?)null,
                cambioUsdBrl = r.UsdRate,
                regime = r.TaxRegime,
                totalTributos = Dec(r.Taxes.Total),
            },
        };
    }

    private sealed record CarrierShipmentResponse(
        string? Referencia, string? NumeroRemessa, string? Transportadora, string? NumeroDeclaracao, string? EtiquetaPdfBase64, string? EtiquetaUrl);

    private sealed record CarrierRemittanceResponse(string? Referencia, bool? Confirmado);
}

/// <summary>Operador ativo: HTTP quando configurado; sandbox em Development (ou com AllowSandboxOutsideDevelopment).</summary>
public sealed class DisabledRemessaCarrierGateway : IRemessaCarrierGateway
{
    public string Name => "desligado";
    public bool IsConfigured => false;
    public bool IsSandbox => false;

    public Task<RemessaShipmentResult> CreateShipmentAsync(RemessaShipmentRequest request, CancellationToken ct) =>
        throw new InvalidOperationException("Operador logístico não configurado.");

    public Task CancelShipmentAsync(string providerReference, CancellationToken ct) => Task.CompletedTask;

    public Task<TaxRemittanceResult> RemitTaxesAsync(TaxRemittanceRequest request, CancellationToken ct) =>
        throw new InvalidOperationException("Operador logístico não configurado.");
}
