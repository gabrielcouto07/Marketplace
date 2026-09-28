using Marketplace.Domain.Common;

namespace Marketplace.Application.Abstractions;

public sealed record PostalCodeInfo(string PostalCode, string Street, string Neighborhood, string City, string State);

/// <summary>Consulta de CEP (ViaCEP/BrasilAPI com cache). Retorna null quando o CEP não existe.</summary>
public interface IPostalCodeLookup
{
    Task<PostalCodeInfo?> LookupAsync(string postalCode, CancellationToken ct);
}

public sealed record ShippingParcel(int Units, long DeclaredValueAmount);

public sealed record ShippingRateOption(
    Guid Id,
    string Carrier,
    string Service,
    Money Price,
    DayRange EstimatedDays,
    string? Description);

/// <summary>Tabela de frete por vendedor/destino. Prazos em dias úteis, sempre em faixa.</summary>
public interface IShippingRateProvider
{
    Task<IReadOnlyList<ShippingRateOption>> QuoteAsync(
        Guid sellerId,
        string originCity,
        string destinationPostalCode,
        ShippingParcel parcel,
        bool freeShippingEligible,
        CancellationToken ct);
}

public sealed record CarrierTrackingEvent(
    string ExternalId,
    string Code,
    string Description,
    string Location,
    DateTime OccurredAt);

/// <summary>Rastreio junto à transportadora (Correo Paraguayo / Correios / courier).</summary>
public interface ITrackingProvider
{
    Task<IReadOnlyList<CarrierTrackingEvent>> GetEventsAsync(string trackingCode, CancellationToken ct);
}

public sealed record PresignedUpload(string UploadUrl, string PublicUrl, string StorageKey, IReadOnlyDictionary<string, string> Headers);

/// <summary>Armazenamento de imagens (Cloudflare R2/S3 ou disco local em dev).</summary>
public interface IImageStorage
{
    Task<PresignedUpload> CreateUploadAsync(string fileName, string contentType, long sizeBytes, CancellationToken ct);
    Task DeleteAsync(string storageKey, CancellationToken ct);
}

public sealed record EmailMessage(string To, string Subject, string TextBody, string? HtmlBody = null);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct);
}
