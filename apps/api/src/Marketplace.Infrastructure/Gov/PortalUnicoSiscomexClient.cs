using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Domain.Common;
using Marketplace.Infrastructure.RemessaConforme;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Gov;

/// <summary>
/// Portal Único Siscomex — Remessas Internacionais (remx), perfil EMPRCOMEL.
/// <list type="bullet">
/// <item>Autenticação: <c>POST {BaseUrl}/portal/api/autenticar/chave-acesso</c> com os cabeçalhos <c>Client-Id</c>,
/// <c>Client-Secret</c> e <c>Role-Type</c>; a resposta traz <c>Set-Token</c> (JWT) e <c>X-CSRF-Token</c> (vale 60 min e é
/// renovado a cada resposta). Autenticar de novo em menos de 60 s é bloqueado (PLAT-ER2033), por isso o token é reutilizado.</item>
/// <item>Consulta: <c>POST /api/ext/consulta-remessas-ece</c> (cnpjDeclarante, período do manifesto, lista de números de
/// remessa) devolve um protocolo; <c>GET /api/ext/consulta-remessas-ece/{protocolo}</c> devolve o processamento.</item>
/// </list>
/// Especificação: docs.portalunico.siscomex.gov.br/api/remx (remx-recepcao.json e remx-consulta.json).
/// </summary>
public sealed class PortalUnicoSiscomexClient(
    IHttpClientFactory httpFactory,
    IOptions<SiscomexOptions> options,
    TimeProvider clock,
    ILogger<PortalUnicoSiscomexClient> logger) : ISiscomexRemessaClient
{
    public const string HttpClientName = "siscomex";

    private HttpClient http => httpFactory.CreateClient(HttpClientName);

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly SemaphoreSlim _authLock = new(1, 1);
    private string? _jwt;
    private string? _csrf;
    private DateTimeOffset _csrfExpiresAt;

    private SiscomexOptions O => options.Value;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(O.ClientId) && !string.IsNullOrWhiteSpace(O.ClientSecret) && Documents.OnlyDigits(O.Cnpj).Length == 14;

    public async Task<string> RequestShipmentsQueryAsync(DateOnly from, DateOnly to, IReadOnlyList<string> shipmentNumbers, CancellationToken ct)
    {
        var body = new
        {
            cnpjDeclarante = Documents.OnlyDigits(O.Cnpj),
            dataInicioManifesto = Timestamp(from.ToDateTime(TimeOnly.MinValue)),
            dataFimManifesto = Timestamp(to.ToDateTime(new TimeOnly(23, 59, 59))),
            listaNumeroRemessa = shipmentNumbers.Select(n => n.Trim().ToUpperInvariant()).Where(n => n.Length is > 0 and <= 18).Distinct().ToList(),
        };
        using var response = await SendAsync(HttpMethod.Post, "consulta-remessas-ece", JsonContent.Create(body, options: Json), ct);
        await EnsureSuccessAsync(response, ct);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        return doc.RootElement.TryGetProperty("numeroProtocolo", out var p) && p.GetString() is { Length: > 0 } protocol
            ? protocol
            : throw new InvalidOperationException("Portal Único não devolveu numeroProtocolo.");
    }

    public async Task<SiscomexQueryResult> GetShipmentsQueryAsync(string protocol, CancellationToken ct)
    {
        using var response = await SendAsync(HttpMethod.Get, $"consulta-remessas-ece/{Uri.EscapeDataString(protocol)}", null, ct);
        // Enquanto o protocolo não é processado o portal responde sem dataHoraProcessamento (ou 422 de "em processamento").
        if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.UnprocessableEntity or HttpStatusCode.Accepted)
            return new SiscomexQueryResult(false, [], [await response.Content.ReadAsStringAsync(ct)]);
        await EnsureSuccessAsync(response, ct);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        return Parse(doc.RootElement);
    }

    /// <summary>"Processamento de Consulta de Remessas pela ECE" → remessas com situação, ocorrências e divergências.</summary>
    public static SiscomexQueryResult Parse(JsonElement root)
    {
        if (!root.TryGetProperty("dataHoraProcessamento", out var processed) || processed.ValueKind != JsonValueKind.String)
            return new SiscomexQueryResult(false, [], []);
        var errors = Array(root, "erros").Select(e => $"{Str(e, "codigoMensagem")} {Str(e, "mensagem")} {Str(e, "numeroRemessa")}".Trim()).ToList();
        var shipments = new List<SiscomexShipment>();
        foreach (var manifest in Array(root, "manifestos"))
        foreach (var r in Array(manifest, "remessas"))
        {
            var number = Str(r, "numeroRemessa");
            if (string.IsNullOrWhiteSpace(number)) continue;
            var dir = r.TryGetProperty("dir", out var d) && d.ValueKind == JsonValueKind.Object ? Str(d, "numeroDeclaracao") : null;
            var occurrences = Array(r, "ocorrencias").Select(o => new SiscomexOccurrence(
                Long(o, "idOcorrencia") ?? 0, (int)(Long(o, "codOcorrencia") ?? 0), Str(o, "nomeOcorrencia") ?? "", Str(o, "observacao"),
                Str(o, "idOrgaoResponsavelOcorrencia"), Date(Str(o, "dataInsercao")), Str(o, "resolvida") == "1")).ToList();
            var divergences = Array(r, "divergencias").Select(v => new SiscomexDivergence(
                (int)(Long(v, "codigoDivergencia") ?? 0), Str(v, "justificativa"), Str(v, "vigente") == "S")).ToList();
            var ii = r.TryGetProperty("ii", out var iiEl) && iiEl.ValueKind == JsonValueKind.Object ? Dec(iiEl, "valorDevido") : null;
            shipments.Add(new SiscomexShipment(number, dir, (int?)Long(r, "situacao"), Dec(r, "txCambioDtRegistro"), Dec(r, "valorRemessaReal"),
                Dec(r, "valorTributavelReal"), ii ?? Dec(r, "valorIIReal"), Array(r, "selecoes").Any(), occurrences, divergences));
        }
        return new SiscomexQueryResult(true, shipments, errors);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, HttpContent? content, CancellationToken ct)
    {
        await EnsureAuthenticatedAsync(ct);
        var response = await http.SendAsync(Build(method, path, content), ct);
        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            response.Dispose();
            _jwt = null;
            await EnsureAuthenticatedAsync(ct);
            response = await http.SendAsync(Build(method, path, content is null ? null : await CloneAsync(content, ct)), ct);
        }
        if (response.Headers.TryGetValues("X-CSRF-Token", out var csrf)) _csrf = csrf.FirstOrDefault() ?? _csrf;
        if (response.Headers.TryGetValues("X-CSRF-Expiration", out var exp) && long.TryParse(exp.FirstOrDefault(), out var ms))
            _csrfExpiresAt = DateTimeOffset.FromUnixTimeMilliseconds(ms);
        return response;
    }

    private HttpRequestMessage Build(HttpMethod method, string path, HttpContent? content)
    {
        var url = $"{O.BaseUrl.TrimEnd('/')}/{O.RemxPath.Trim('/')}/{path}";
        var message = new HttpRequestMessage(method, url) { Content = content };
        message.Headers.TryAddWithoutValidation("Authorization", _jwt);
        message.Headers.TryAddWithoutValidation("X-CSRF-Token", _csrf);
        return message;
    }

    private static async Task<HttpContent> CloneAsync(HttpContent content, CancellationToken ct)
    {
        var bytes = await content.ReadAsByteArrayAsync(ct);
        var clone = new ByteArrayContent(bytes);
        foreach (var h in content.Headers) clone.Headers.TryAddWithoutValidation(h.Key, h.Value);
        return clone;
    }

    private async Task EnsureAuthenticatedAsync(CancellationToken ct)
    {
        if (_jwt is not null && _csrf is not null && _csrfExpiresAt > clock.GetUtcNow().AddMinutes(2)) return;
        await _authLock.WaitAsync(ct);
        try
        {
            if (_jwt is not null && _csrf is not null && _csrfExpiresAt > clock.GetUtcNow().AddMinutes(2)) return;
            if (!IsConfigured) throw new InvalidOperationException("Siscomex sem chave de acesso (Siscomex:ClientId/ClientSecret/Cnpj).");
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{O.BaseUrl.TrimEnd('/')}/{O.AuthPath.TrimStart('/')}");
            request.Headers.TryAddWithoutValidation("Client-Id", O.ClientId);
            request.Headers.TryAddWithoutValidation("Client-Secret", O.ClientSecret);
            request.Headers.TryAddWithoutValidation("Role-Type", O.RoleType);
            using var response = await http.SendAsync(request, ct);
            await EnsureSuccessAsync(response, ct);
            _jwt = response.Headers.TryGetValues("Set-Token", out var jwt) ? jwt.FirstOrDefault() : null;
            _csrf = response.Headers.TryGetValues("X-CSRF-Token", out var csrf) ? csrf.FirstOrDefault() : null;
            _csrfExpiresAt = response.Headers.TryGetValues("X-CSRF-Expiration", out var exp) && long.TryParse(exp.FirstOrDefault(), out var ms)
                ? DateTimeOffset.FromUnixTimeMilliseconds(ms)
                : clock.GetUtcNow().AddMinutes(55);
            if (_jwt is null || _csrf is null) throw new InvalidOperationException("Autenticação no Portal Único sem Set-Token/X-CSRF-Token.");
            logger.LogInformation("Autenticado no Portal Único Siscomex (perfil {Role})", O.RoleType);
        }
        finally
        {
            _authLock.Release();
        }
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;
        var text = await response.Content.ReadAsStringAsync(ct);
        throw new HttpRequestException($"Portal Único respondeu {(int)response.StatusCode}: {(text.Length > 400 ? text[..400] : text)}", null, response.StatusCode);
    }

    private static string Timestamp(DateTime local) =>
        local.ToString("yyyy-MM-dd'T'HH:mm:ss.fff", CultureInfo.InvariantCulture) + "-0300";

    private static IEnumerable<JsonElement> Array(JsonElement e, string name) =>
        e.TryGetProperty(name, out var a) && a.ValueKind == JsonValueKind.Array ? a.EnumerateArray() : [];

    private static string? Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) ? v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.GetRawText(),
            _ => null,
        } : null;

    private static long? Long(JsonElement e, string name) =>
        long.TryParse(Str(e, name), NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : null;

    private static decimal? Dec(JsonElement e, string name) =>
        decimal.TryParse(Str(e, name), NumberStyles.Number, CultureInfo.InvariantCulture, out var v) ? v : null;

    private static DateTime? Date(string? raw) =>
        raw is not null && DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var d) ? d.UtcDateTime : null;
}
