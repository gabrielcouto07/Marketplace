using Marketplace.Domain.Common;

namespace Marketplace.Application.Abstractions;

// ----- CEP -----

public sealed record PostalCodeInfo(string PostalCode, string Street, string Neighborhood, string City, string State);

/// <summary>Consulta de CEP (ViaCEP/BrasilAPI com cache). Retorna null quando o CEP não existe.</summary>
public interface IPostalCodeLookup
{
    Task<PostalCodeInfo?> LookupAsync(string postalCode, CancellationToken ct);
}

// ----- Câmbio -----

public sealed record ExternalExchangeRate(
    CurrencyCode From,
    CurrencyCode To,
    long Numerator,
    long Denominator,
    string DisplayRate,
    DateTime QuotedAt);

/// <summary>
/// Fonte externa de cotações (ex.: Banco Central, Open Exchange Rates). "Manual" (padrão) não busca nada: as taxas
/// são cadastradas pelo admin. O ExchangeRateRefreshJob grava o que o provedor devolver em exchange_rates.
/// </summary>
public interface IExchangeRateProvider
{
    string Name { get; }
    Task<IReadOnlyList<ExternalExchangeRate>> FetchAsync(IReadOnlyList<(CurrencyCode From, CurrencyCode To)> pairs, CancellationToken ct);
}

// ----- Imagens -----

public sealed record PresignedUpload(string UploadUrl, string PublicUrl, string StorageKey, IReadOnlyDictionary<string, string> Headers);

/// <summary>Armazenamento de imagens (Cloudflare R2/S3 ou disco local em dev).</summary>
public interface IImageStorage
{
    Task<PresignedUpload> CreateUploadAsync(string fileName, string contentType, long sizeBytes, CancellationToken ct);
    Task DeleteAsync(string storageKey, CancellationToken ct);
}

// ----- E-mail -----

public sealed record EmailMessage(string To, string Subject, string TextBody, string? HtmlBody = null);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct);
}

// ----- Cache de catálogo -----

/// <summary>Invalida o cache de saída das rotas públicas de catálogo após edições de vendedor/admin.</summary>
public interface ICatalogCache
{
    Task InvalidateAsync(CancellationToken ct);
}

// ----- Tokens de download -----

public static class DownloadTokenPurposes
{
    public const string Boleto = "boleto";
}

/// <summary>Token assinado e com validade para links que abrem sem sessão (ex.: PDF do boleto).</summary>
public interface IDownloadTokenService
{
    string Issue(string purpose, string subject, TimeSpan lifetime);
    bool Validate(string purpose, string subject, string? token);
}
