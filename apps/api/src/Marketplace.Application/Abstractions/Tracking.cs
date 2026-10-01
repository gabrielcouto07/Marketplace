namespace Marketplace.Application.Abstractions;

/// <summary>Evento bruto da transportadora. <see cref="Code"/> deve ser um código normalizado (ver Domain.Shipping.TrackingCodes).</summary>
public sealed record CarrierTrackingEvent(
    string ExternalId,
    string Code,
    string Description,
    string Location,
    DateTime OccurredAt);

public sealed record TrackingQuery(Guid OrderId, string Carrier, string TrackingCode);

/// <summary>
/// Consulta de rastreio junto à transportadora (Correo Paraguayo, Correios, courier ou agregador). Um provedor
/// por transportadora; o <see cref="ITrackingProviderResolver"/> escolhe pelo nome informado no envio.
/// </summary>
public interface ITrackingProvider
{
    string Name { get; }

    /// <summary>Se este provedor sabe consultar a transportadora (nome livre digitado pelo vendedor, case-insensitive).</summary>
    bool Supports(string carrier);

    Task<IReadOnlyList<CarrierTrackingEvent>> GetEventsAsync(TrackingQuery query, CancellationToken ct);
}

/// <summary>Webhook de rastreio já validado e traduzido para o formato interno.</summary>
public sealed record ShipmentWebhookEvent(
    string EventId,
    string TrackingCode,
    string? Carrier,
    IReadOnlyList<CarrierTrackingEvent> Events,
    string RawPayload);

/// <summary>Valida a assinatura e traduz o webhook de um provedor de rastreio (um parser por provedor).</summary>
public interface ITrackingWebhookParser
{
    string Name { get; }

    /// <summary>Retorna null quando o evento deve ser ignorado. Lança UnauthorizedAccessException se a assinatura for inválida.</summary>
    Task<ShipmentWebhookEvent?> ParseAsync(WebhookRequest request, CancellationToken ct);
}

public interface ITrackingProviderResolver
{
    IReadOnlyCollection<string> ProviderNames { get; }
    ITrackingProvider? ForCarrier(string? carrier);
    ITrackingWebhookParser? ParserFor(string providerName);
}
