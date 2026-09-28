using System.Net;
using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Shipping;

public sealed class PostalCodeOptions
{
    public string ViaCepUrl { get; set; } = "https://viacep.com.br/ws/{cep}/json/";
    public string BrasilApiUrl { get; set; } = "https://brasilapi.com.br/api/cep/v2/{cep}";
    public int CacheHours { get; set; } = 24;
    /// <summary>Sem internet (dev), devolve cidade/UF pela zona do CEP em vez de falhar.</summary>
    public bool AllowOfflineFallback { get; set; }
}

/// <summary>ViaCEP → BrasilAPI (fallback) com cache em memória. Inexistente = null.</summary>
public sealed class PostalCodeLookup(
    HttpClient http,
    IMemoryCache cache,
    IAppDbContext db,
    IOptions<PostalCodeOptions> options,
    ILogger<PostalCodeLookup> logger) : IPostalCodeLookup
{
    private static readonly PostalCodeInfo NotFoundMarker = new("", "", "", "", "");

    public async Task<PostalCodeInfo?> LookupAsync(string postalCode, CancellationToken ct)
    {
        var key = $"cep:{postalCode}";
        if (cache.TryGetValue(key, out PostalCodeInfo? cached))
            return ReferenceEquals(cached, NotFoundMarker) ? null : cached;

        var (info, definitive) = await FetchAsync(postalCode, ct);
        if (definitive)
            cache.Set(key, info ?? NotFoundMarker, TimeSpan.FromHours(options.Value.CacheHours));
        return info;
    }

    /// <returns>info e se a resposta é definitiva (cacheável). Falha de rede não é definitiva.</returns>
    private async Task<(PostalCodeInfo? Info, bool Definitive)> FetchAsync(string cep, CancellationToken ct)
    {
        var networkFailed = false;
        try
        {
            var viaCep = await FromViaCepAsync(cep, ct);
            if (viaCep is { } r) return (r.Info, true);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            networkFailed = true;
            logger.LogWarning(ex, "ViaCEP indisponível para {Cep}", cep);
        }
        try
        {
            var brasilApi = await FromBrasilApiAsync(cep, ct);
            if (brasilApi is { } r) return (r.Info, true);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            networkFailed = true;
            logger.LogWarning(ex, "BrasilAPI indisponível para {Cep}", cep);
        }
        if (networkFailed && options.Value.AllowOfflineFallback) return (await OfflineFallbackAsync(cep, ct), false);
        if (networkFailed) throw new HttpRequestException("Serviços de CEP indisponíveis.");
        return (null, true);
    }

    private async Task<(PostalCodeInfo? Info, bool Found)?> FromViaCepAsync(string cep, CancellationToken ct)
    {
        using var response = await http.GetAsync(options.Value.ViaCepUrl.Replace("{cep}", cep), ct);
        if (response.StatusCode == HttpStatusCode.BadRequest) return (null, false);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        if (root.TryGetProperty("erro", out var erro) && (erro.ValueKind == JsonValueKind.True || erro.ToString() == "true"))
            return (null, false);
        return (new PostalCodeInfo(cep,
            root.GetProperty("logradouro").GetString() ?? "",
            root.GetProperty("bairro").GetString() ?? "",
            root.GetProperty("localidade").GetString() ?? "",
            root.GetProperty("uf").GetString() ?? ""), true);
    }

    private async Task<(PostalCodeInfo? Info, bool Found)?> FromBrasilApiAsync(string cep, CancellationToken ct)
    {
        using var response = await http.GetAsync(options.Value.BrasilApiUrl.Replace("{cep}", cep), ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return (null, false);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;
        return (new PostalCodeInfo(cep,
            root.TryGetProperty("street", out var s) ? s.GetString() ?? "" : "",
            root.TryGetProperty("neighborhood", out var n) ? n.GetString() ?? "" : "",
            root.GetProperty("city").GetString() ?? "",
            root.GetProperty("state").GetString() ?? ""), true);
    }

    private async Task<PostalCodeInfo?> OfflineFallbackAsync(string cep, CancellationToken ct)
    {
        var zone = await db.ShippingZones.AsNoTracking().FirstOrDefaultAsync(z => z.Prefix == cep.Substring(0, 1), ct);
        if (zone is null) return null;
        return new PostalCodeInfo(cep, "", "", zone.City, zone.State);
    }
}
