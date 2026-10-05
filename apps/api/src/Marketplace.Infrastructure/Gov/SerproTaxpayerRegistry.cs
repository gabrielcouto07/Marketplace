using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Domain.Common;
using Marketplace.Infrastructure.RemessaConforme;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Gov;

/// <summary>
/// Serpro — Consulta CPF v3. Token OAuth2 em <c>POST {BaseUrl}/token</c> (grant_type=client_credentials, Basic
/// base64(ConsumerKey:ConsumerSecret)) e consulta em <c>GET {BaseUrl}/consulta-cpf-df/v3/cpf/{cpf}</c>, que devolve
/// <c>{ ni, nome, situacao: { codigo, descricao } }</c>. Sem credencial, ou se o serviço falhar, a resposta é
/// <see cref="TaxpayerSituation.NaoVerificado"/> (só o dígito verificador vale) e a compra segue.
/// </summary>
public sealed class SerproTaxpayerRegistry(
    IHttpClientFactory httpFactory,
    IOptions<SerproOptions> options,
    IMemoryCache cache,
    TimeProvider clock,
    ILogger<SerproTaxpayerRegistry> logger) : ITaxpayerRegistry
{
    public const string HttpClientName = "serpro";

    private HttpClient http => httpFactory.CreateClient(HttpClientName);

    private readonly SemaphoreSlim _tokenLock = new(1, 1);
    private string? _token;
    private DateTimeOffset _tokenExpiresAt;

    private SerproOptions O => options.Value;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(O.ConsumerKey) && !string.IsNullOrWhiteSpace(O.ConsumerSecret);

    public async Task<TaxpayerCheck> CheckCpfAsync(string cpf, CancellationToken ct)
    {
        var digits = Documents.OnlyDigits(cpf);
        if (!Documents.IsValidCpf(digits)) return new TaxpayerCheck(TaxpayerSituation.Inexistente, null, "digito-verificador");
        if (!IsConfigured) return new TaxpayerCheck(TaxpayerSituation.NaoVerificado, null, "offline");
        if (cache.TryGetValue($"serpro:cpf:{digits}", out TaxpayerCheck? cached) && cached is not null) return cached;

        try
        {
            var token = await TokenAsync(ct);
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{O.BaseUrl.TrimEnd('/')}/{O.CpfPath.TrimStart('/').Replace("{cpf}", digits)}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            using var response = await http.SendAsync(request, ct);
            TaxpayerCheck result;
            if (response.StatusCode == HttpStatusCode.NotFound)
                result = new TaxpayerCheck(TaxpayerSituation.Inexistente, null, "serpro");
            else
            {
                if (response.StatusCode == HttpStatusCode.Unauthorized) _token = null;
                response.EnsureSuccessStatusCode();
                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
                var root = doc.RootElement;
                var name = root.TryGetProperty("nome", out var n) ? n.GetString() : null;
                string? code = null, description = null;
                if (root.TryGetProperty("situacao", out var s))
                {
                    code = s.TryGetProperty("codigo", out var c) ? c.ToString() : null;
                    description = s.TryGetProperty("descricao", out var d) ? d.GetString() : null;
                }
                result = new TaxpayerCheck(MapSituation(code, description), name, "serpro");
            }
            cache.Set($"serpro:cpf:{digits}", result, TimeSpan.FromHours(Math.Max(1, O.CacheHours)));
            return result;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Consulta CPF (Serpro) indisponível; seguindo só com o dígito verificador");
            return new TaxpayerCheck(TaxpayerSituation.NaoVerificado, null, "serpro-indisponivel");
        }
    }

    /// <summary>Situação cadastral: 0 Regular, 2 Suspensa, 3 Titular falecido, 4 Pendente de regularização, 5 e 9 Cancelada, 8 Nula.</summary>
    public static TaxpayerSituation MapSituation(string? code, string? description)
    {
        var d = (description ?? string.Empty).ToLowerInvariant();
        return code switch
        {
            "0" => TaxpayerSituation.Regular,
            "2" => TaxpayerSituation.Suspensa,
            "3" => TaxpayerSituation.TitularFalecido,
            "4" => TaxpayerSituation.PendenteDeRegularizacao,
            "5" or "9" => TaxpayerSituation.Cancelada,
            "8" => TaxpayerSituation.Nula,
            _ when d.Contains("regular") && !d.Contains("pendente") => TaxpayerSituation.Regular,
            _ when d.Contains("suspens") => TaxpayerSituation.Suspensa,
            _ when d.Contains("falecid") => TaxpayerSituation.TitularFalecido,
            _ when d.Contains("pendente") => TaxpayerSituation.PendenteDeRegularizacao,
            _ when d.Contains("cancelad") => TaxpayerSituation.Cancelada,
            _ when d.Contains("nula") => TaxpayerSituation.Nula,
            _ => TaxpayerSituation.NaoVerificado,
        };
    }

    private async Task<string> TokenAsync(CancellationToken ct)
    {
        if (_token is not null && _tokenExpiresAt > clock.GetUtcNow().AddMinutes(1)) return _token;
        await _tokenLock.WaitAsync(ct);
        try
        {
            if (_token is not null && _tokenExpiresAt > clock.GetUtcNow().AddMinutes(1)) return _token;
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{O.BaseUrl.TrimEnd('/')}/{O.TokenPath.TrimStart('/')}")
            {
                Content = new FormUrlEncodedContent([new("grant_type", "client_credentials")]),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                Convert.ToBase64String(Encoding.UTF8.GetBytes($"{O.ConsumerKey}:{O.ConsumerSecret}")));
            using var response = await http.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();
            using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
            _token = doc.RootElement.GetProperty("access_token").GetString();
            var seconds = doc.RootElement.TryGetProperty("expires_in", out var e) && e.TryGetInt32(out var s) ? s : 3600;
            _tokenExpiresAt = clock.GetUtcNow().AddSeconds(seconds);
            return _token ?? throw new InvalidOperationException("Token Serpro vazio.");
        }
        finally
        {
            _tokenLock.Release();
        }
    }
}
