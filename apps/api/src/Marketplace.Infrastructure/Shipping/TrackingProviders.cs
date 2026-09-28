using System.Collections.Concurrent;
using Marketplace.Application.Abstractions;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Shipping;

public sealed class TrackingOptions
{
    /// <summary>"None" (só webhooks) ou "Fake" (avança eventos sozinho, para demo).</summary>
    public string Provider { get; set; } = "None";
    public int PollIntervalMinutes { get; set; } = 15;
    /// <summary>Fake: minutos entre cada evento simulado.</summary>
    public int FakeStepMinutes { get; set; } = 2;
}

/// <summary>Sem integração ativa: eventos chegam apenas por `POST /webhooks/shipping`.</summary>
public sealed class NullTrackingProvider : ITrackingProvider
{
    public Task<IReadOnlyList<CarrierTrackingEvent>> GetEventsAsync(string trackingCode, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<CarrierTrackingEvent>>([]);
}

/// <summary>Simula a jornada PY→BR liberando um evento a cada N minutos desde a primeira consulta.</summary>
public sealed class FakeTrackingProvider(IOptions<TrackingOptions> options, TimeProvider clock) : ITrackingProvider
{
    public static readonly (string Code, string Description, string Location)[] Journey =
    [
        ("POSTED", "Objeto postado", "Ciudad del Este, PY"),
        ("EXPORT", "Objeto encaminhado para exportação", "Asunción, PY"),
        ("ARRIVED_BR", "Objeto recebido no Brasil", "Curitiba, PR"),
        ("CUSTOMS", "Em fiscalização aduaneira", "Curitiba, PR"),
        ("CUSTOMS_RELEASED", "Liberado pela fiscalização", "Curitiba, PR"),
        ("OUT_FOR_DELIVERY", "Saiu para entrega", "Destino"),
        ("DELIVERED", "Objeto entregue ao destinatário", "Destino"),
    ];

    private readonly ConcurrentDictionary<string, DateTime> _firstSeen = new();

    public Task<IReadOnlyList<CarrierTrackingEvent>> GetEventsAsync(string trackingCode, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        var start = _firstSeen.GetOrAdd(trackingCode, now);
        var step = TimeSpan.FromMinutes(Math.Max(1, options.Value.FakeStepMinutes));
        var released = Math.Min(Journey.Length, (int)((now - start) / step) + 1);
        var events = Journey.Take(released).Select((j, i) =>
            new CarrierTrackingEvent($"{trackingCode}:{i}", j.Code, j.Description, j.Location, start + step * i)).ToList();
        return Task.FromResult<IReadOnlyList<CarrierTrackingEvent>>(events);
    }
}
