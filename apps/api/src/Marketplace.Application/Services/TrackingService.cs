using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Domain;
using Marketplace.Domain.Entities;
using Marketplace.Domain.Shipping;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

/// <summary>
/// Rastreio: aplica eventos da transportadora ao pedido (dedupe por ExternalId), transita o status, recebe
/// webhooks por provedor e alimenta o job de polling. Transportadoras entram só por <see cref="ITrackingProvider"/>
/// e <see cref="ITrackingWebhookParser"/>.
/// </summary>
public sealed class TrackingService(
    IAppDbContext db,
    OrderService orders,
    ITrackingProviderResolver resolver,
    TimeProvider clock,
    ILogger<TrackingService> logger)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    /// <summary>Aplica eventos novos ao pedido. Retorna se algo mudou (eventos ou status).</summary>
    public bool Apply(Order order, IReadOnlyList<CarrierTrackingEvent> events)
    {
        var known = order.TrackingEvents.Select(e => e.ExternalId).Where(e => e is not null).ToHashSet();
        // O vendedor já registra a postagem ao informar o código; a transportadora repete o mesmo evento depois.
        var sellerCodes = order.TrackingEvents
            .Where(e => e.ExternalId is not null && e.ExternalId.StartsWith("seller:", StringComparison.Ordinal))
            .Select(e => e.Code)
            .ToHashSet();
        var changed = false;
        foreach (var e in events.OrderBy(e => e.OccurredAt))
        {
            if (known.Contains(e.ExternalId)) continue;
            known.Add(e.ExternalId);
            var code = TrackingCodes.Normalize(e.Code);
            if (sellerCodes.Contains(code)) continue;

            order.TrackingEvents.Add(new TrackingEvent
            {
                OrderId = order.Id,
                Code = code,
                Description = e.Description,
                Location = e.Location,
                OccurredAt = e.OccurredAt,
                ExternalId = e.ExternalId,
            });
            changed = true;
            if (TrackingCodes.TargetStatus(code) is { } target && target != order.Status && OrderStateMachine.CanTransition(order.Status, target))
                orders.Transition(order, target, null, e.Location, "carrier");
        }
        return changed;
    }

    /// <summary>
    /// Webhook de um provedor. Idempotente por (provedor, id do evento) e registrado em webhook_events; em falha o
    /// registro guarda o erro e o provedor reenvia (não recebe 2xx). Código de rastreio desconhecido = 404.
    /// </summary>
    public async Task<(bool Received, bool Changed)> HandleWebhookAsync(string providerName, WebhookRequest request, CancellationToken ct)
    {
        var parser = resolver.ParserFor(providerName) ?? throw AppException.NotFound("Provedor de rastreio");
        var evt = await parser.ParseAsync(request, ct);
        if (evt is null) return (false, false);

        var provider = $"shipping:{parser.Name}";
        var record = await db.WebhookEvents.FirstOrDefaultAsync(w => w.Provider == provider && w.ExternalId == evt.EventId, ct);
        if (record?.ProcessedAt is not null) return (true, false);
        if (record is null)
        {
            record = new WebhookEvent
            {
                Provider = provider,
                ExternalId = evt.EventId,
                Type = "shipment.updated",
                PayloadJson = evt.RawPayload,
                ReceivedAt = Now,
            };
            db.WebhookEvents.Add(record);
        }
        record.Attempts++;
        await db.SaveChangesAsync(ct);

        try
        {
            var order = await orders.FullOrders().FirstOrDefaultAsync(o => o.TrackingCode == evt.TrackingCode, ct);
            if (order is null)
            {
                record.Error = "Pedido não encontrado para o código de rastreio.";
                await db.SaveChangesAsync(ct);
                throw AppException.NotFound("Pedido");
            }
            if (!string.IsNullOrWhiteSpace(evt.Carrier) && string.IsNullOrWhiteSpace(order.Carrier)) order.Carrier = evt.Carrier.Trim();
            var changed = Apply(order, evt.Events);
            record.ProcessedAt = Now;
            record.Error = null;
            await db.SaveChangesAsync(ct);
            return (true, changed);
        }
        catch (Exception ex) when (ex is not AppException)
        {
            logger.LogError(ex, "Erro ao processar webhook de rastreio {Provider}/{EventId}", provider, evt.EventId);
            db.ChangeTracker.Clear();
            record.Error = ex.Message;
            db.WebhookEvents.Update(record);
            await db.SaveChangesAsync(ct);
            throw;
        }
    }

    /// <summary>Job: consulta a transportadora para pedidos em trânsito que têm provedor registrado. Retorna quantos mudaram.</summary>
    public async Task<int> SyncAsync(int batchSize, CancellationToken ct)
    {
        if (resolver.ProviderNames.Count == 0) return 0;
        var inTransit = await orders.FullOrders()
            .Where(o => o.TrackingCode != null && (o.Status == OrderStatus.Enviado || o.Status == OrderStatus.EmTransitoInternacional))
            .OrderBy(o => o.UpdatedAt)
            .Take(Math.Max(1, batchSize))
            .ToListAsync(ct);

        var updated = 0;
        foreach (var order in inTransit)
        {
            var provider = resolver.ForCarrier(order.Carrier);
            if (provider is null) continue;
            try
            {
                var events = await provider.GetEventsAsync(new TrackingQuery(order.Id, order.Carrier ?? string.Empty, order.TrackingCode!), ct);
                if (Apply(order, events))
                {
                    await db.SaveChangesAsync(ct);
                    updated++;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Um pedido com falha não derruba a rodada inteira.
                logger.LogWarning(ex, "Rastreio {Provider} falhou para {TrackingCode}", provider.Name, order.TrackingCode);
            }
        }
        return updated;
    }
}
