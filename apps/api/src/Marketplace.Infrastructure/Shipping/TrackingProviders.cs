using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Domain.Shipping;
using Marketplace.Infrastructure.Payments;
using Marketplace.Infrastructure.Providers;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Shipping;

public sealed class TrackingOptions
{
    /// <summary>"None" (só webhooks), "Fake" (avança eventos sozinho, para demo) ou o nome de uma integração registrada.</summary>
    public string Provider { get; set; } = "None";
    public int PollIntervalMinutes { get; set; } = 15;
    /// <summary>Fake: minutos entre cada evento simulado.</summary>
    public int FakeStepMinutes { get; set; } = 2;
    /// <summary>Segredo do webhook genérico (`POST /webhooks/shipping`, HMAC-SHA256 do corpo em X-Signature).</summary>
    public string? WebhookSecret { get; set; }
    /// <summary>Limite de pedidos consultados por rodada do job (evita rajadas na transportadora).</summary>
    public int PollBatchSize { get; set; } = 200;
}

/// <summary>Simula a jornada PY→BR liberando um evento a cada N minutos desde a primeira consulta. Atende qualquer transportadora.</summary>
public sealed class FakeTrackingProvider(IOptions<TrackingOptions> options, TimeProvider clock) : ITrackingProvider
{
    public const string ProviderName = "fake";

    public static readonly (string Code, string Description, string Location)[] Journey =
    [
        (TrackingCodes.Posted, "Objeto postado", "Ciudad del Este, PY"),
        (TrackingCodes.Export, "Objeto encaminhado para exportação", "Asunción, PY"),
        (TrackingCodes.ArrivedBr, "Objeto recebido no Brasil", "Curitiba, PR"),
        (TrackingCodes.Customs, "Em fiscalização aduaneira", "Curitiba, PR"),
        (TrackingCodes.CustomsReleased, "Liberado pela fiscalização", "Curitiba, PR"),
        (TrackingCodes.OutForDelivery, "Saiu para entrega", "Destino"),
        (TrackingCodes.Delivered, "Objeto entregue ao destinatário", "Destino"),
    ];

    private readonly ConcurrentDictionary<string, DateTime> _firstSeen = new();

    public string Name => ProviderName;

    public bool Supports(string carrier) => true;

    public Task<IReadOnlyList<CarrierTrackingEvent>> GetEventsAsync(TrackingQuery query, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var start = _firstSeen.GetOrAdd(query.TrackingCode, now);
        var step = TimeSpan.FromMinutes(Math.Max(1, options.Value.FakeStepMinutes));
        var released = Math.Min(Journey.Length, (int)((now - start) / step) + 1);
        var events = Journey.Take(released).Select((j, i) =>
            new CarrierTrackingEvent($"{query.TrackingCode}:{i}", j.Code, j.Description, j.Location, start + step * i)).ToList();
        return Task.FromResult<IReadOnlyList<CarrierTrackingEvent>>(events);
    }
}

/// <summary>
/// Webhook genérico de rastreio (`POST /webhooks/shipping`): corpo
/// <c>{ id?, trackingCode, carrier?, events: [{ id?, code, description, location?, occurredAt }] }</c>,
/// assinado com HMAC-SHA256 do corpo em <c>X-Signature</c> (<c>Tracking:WebhookSecret</c>).
/// Integrações reais implementam o próprio <see cref="ITrackingWebhookParser"/> e são roteadas por `/webhooks/shipping/{provider}`.
/// </summary>
public sealed class GenericTrackingWebhookParser(IOptions<TrackingOptions> options) : ITrackingWebhookParser
{
    public const string ParserName = "generic";

    public string Name => ParserName;

    public Task<ShipmentWebhookEvent?> ParseAsync(WebhookRequest request, CancellationToken ct)
    {
        var secret = options.Value.WebhookSecret;
        if (string.IsNullOrWhiteSpace(secret))
            throw new UnauthorizedAccessException("Webhook de rastreio não configurado (Tracking:WebhookSecret).");
        if (!WebhookSignature.IsValid(secret, request.Body, request.Headers.GetValueOrDefault("x-signature")))
            throw new UnauthorizedAccessException("Assinatura inválida.");

        using var doc = JsonDocument.Parse(request.Body);
        var root = doc.RootElement;
        var trackingCode = root.TryGetProperty("trackingCode", out var tc) ? tc.GetString()?.Trim().ToUpperInvariant() : null;
        if (string.IsNullOrWhiteSpace(trackingCode) || !root.TryGetProperty("events", out var events) || events.ValueKind != JsonValueKind.Array)
            return Task.FromResult<ShipmentWebhookEvent?>(null);

        var carrier = root.TryGetProperty("carrier", out var c) ? c.GetString() : null;
        var list = new List<CarrierTrackingEvent>();
        foreach (var e in events.EnumerateArray())
        {
            var code = TrackingCodes.Normalize(e.TryGetProperty("code", out var codeEl) ? codeEl.GetString() : null);
            var occurredAt = e.TryGetProperty("occurredAt", out var at) && at.TryGetDateTime(out var dt) ? dt.ToUniversalTime() : DateTime.UtcNow;
            var description = e.TryGetProperty("description", out var d) ? d.GetString() ?? code : code;
            var location = e.TryGetProperty("location", out var l) ? l.GetString() ?? string.Empty : string.Empty;
            var id = e.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String ? idEl.GetString() : null;
            list.Add(new CarrierTrackingEvent(id ?? $"{trackingCode}:{code}:{occurredAt:O}", code, description, location, occurredAt));
        }

        var eventId = root.TryGetProperty("id", out var rootId) && rootId.ValueKind == JsonValueKind.String
            ? rootId.GetString()!
            : Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(request.Body)));
        return Task.FromResult<ShipmentWebhookEvent?>(new ShipmentWebhookEvent(eventId, trackingCode, carrier, list, request.Body));
    }
}

/// <summary>Escolhe o provedor pelo nome da transportadora informado no envio; parsers de webhook pelo nome da rota.</summary>
public sealed class TrackingProviderResolver(
    ProviderCatalog<ITrackingProvider> providers,
    ProviderCatalog<ITrackingWebhookParser> parsers) : ITrackingProviderResolver
{
    public IReadOnlyCollection<string> ProviderNames => providers.Names;

    public ITrackingProvider? ForCarrier(string? carrier)
    {
        if (string.IsNullOrWhiteSpace(carrier)) return null;
        foreach (var (_, provider) in providers.ResolveAll())
            if (provider.Supports(carrier)) return provider;
        return null;
    }

    public ITrackingWebhookParser? ParserFor(string providerName) =>
        parsers.TryResolve(providerName, out var parser) ? parser : null;
}
