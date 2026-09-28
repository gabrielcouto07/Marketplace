using Marketplace.Application.Abstractions;
using Marketplace.Application.Services;
using Marketplace.Domain;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.Payments;
using Marketplace.Infrastructure.Shipping;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Background;

/// <summary>Expira cobranças vencidas e, com o gateway fake, aprova Pix/boleto após N segundos (demo).</summary>
public sealed class PaymentMaintenanceJob(
    IServiceScopeFactory scopes,
    IOptions<FakePaymentOptions> fakeOptions,
    TimeProvider clock,
    ILogger<PaymentMaintenanceJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
                var payments = scope.ServiceProvider.GetRequiredService<PaymentService>();
                var gateway = scope.ServiceProvider.GetRequiredService<IPaymentGateway>();

                var expired = await payments.ExpirePendingAsync(stoppingToken);
                if (expired > 0) logger.LogInformation("{Count} pagamento(s) expirado(s)", expired);

                var seconds = fakeOptions.Value.AutoApproveAfterSeconds;
                if (gateway.Name == "fake" && seconds > 0)
                {
                    var threshold = clock.GetUtcNow().UtcDateTime.AddSeconds(-seconds);
                    var pending = await db.Payments
                        .Where(p => p.Status == PaymentStatus.Pendente && p.Gateway == "fake" && p.CreatedAt < threshold && p.Method != PaymentMethod.Cartao)
                        .ToListAsync(stoppingToken);
                    foreach (var payment in pending)
                    {
                        await payments.ApproveAsync(payment, clock.GetUtcNow().UtcDateTime, stoppingToken);
                        logger.LogInformation("Pagamento {PaymentId} aprovado automaticamente (gateway fake)", payment.Id);
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Falha no job de pagamentos");
            }
        }
    }
}

/// <summary>Sincroniza rastreio com a transportadora e conclui pedidos entregues após o prazo.</summary>
public sealed class LogisticsJob(
    IServiceScopeFactory scopes,
    IOptions<TrackingOptions> trackingOptions,
    TimeProvider clock,
    ILogger<LogisticsJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromMinutes(Math.Max(1, trackingOptions.Value.PollIntervalMinutes));
        if (trackingOptions.Value.Provider == "Fake") interval = TimeSpan.FromSeconds(30);
        using var timer = new PeriodicTimer(interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                await SyncTrackingAsync(scope.ServiceProvider, stoppingToken);
                await AutoCompleteAsync(scope.ServiceProvider, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Falha no job de logística");
            }
        }
    }

    private async Task SyncTrackingAsync(IServiceProvider sp, CancellationToken ct)
    {
        var provider = sp.GetRequiredService<ITrackingProvider>();
        if (provider is NullTrackingProvider) return;
        var orders = sp.GetRequiredService<OrderService>();
        var db = sp.GetRequiredService<IAppDbContext>();
        var inTransit = await orders.FullOrders()
            .Where(o => o.TrackingCode != null && (o.Status == OrderStatus.Enviado || o.Status == OrderStatus.EmTransitoInternacional))
            .ToListAsync(ct);
        foreach (var order in inTransit)
        {
            var events = await provider.GetEventsAsync(order.TrackingCode!, ct);
            var changed = TrackingSync.Apply(order, events, orders);
            if (changed) await db.SaveChangesAsync(ct);
        }
    }

    private async Task AutoCompleteAsync(IServiceProvider sp, CancellationToken ct)
    {
        var db = sp.GetRequiredService<IAppDbContext>();
        var settings = await sp.GetRequiredService<PlatformSettingsProvider>().GetAsync(ct);
        var orders = sp.GetRequiredService<OrderService>();
        var threshold = clock.GetUtcNow().UtcDateTime.AddDays(-settings.AutoCompleteDays);
        var delivered = await orders.FullOrders().Where(o => o.Status == OrderStatus.Entregue && o.UpdatedAt < threshold).ToListAsync(ct);
        foreach (var order in delivered) orders.Transition(order, OrderStatus.Concluido, "Concluído automaticamente após o prazo.", null, "system");
        if (delivered.Count > 0) await db.SaveChangesAsync(ct);
    }
}

/// <summary>Aplica eventos da transportadora ao pedido (dedupe por ExternalId) e transita o status.</summary>
public static class TrackingSync
{
    public static bool Apply(Order order, IReadOnlyList<CarrierTrackingEvent> events, OrderService orders)
    {
        var known = order.TrackingEvents.Select(e => e.ExternalId).Where(e => e is not null).ToHashSet();
        var changed = false;
        foreach (var e in events.OrderBy(e => e.OccurredAt))
        {
            if (known.Contains(e.ExternalId)) continue;
            order.TrackingEvents.Add(new TrackingEvent
            {
                OrderId = order.Id,
                Code = e.Code,
                Description = e.Description,
                Location = e.Location,
                OccurredAt = e.OccurredAt,
                ExternalId = e.ExternalId,
            });
            changed = true;
            var target = e.Code switch
            {
                "ARRIVED_BR" or "CUSTOMS" or "CUSTOMS_RELEASED" => OrderStatus.EmTransitoInternacional,
                "DELIVERED" => OrderStatus.Entregue,
                _ => (OrderStatus?)null,
            };
            if (target is { } t && t != order.Status && OrderStateMachine.CanTransition(order.Status, t))
                orders.Transition(order, t, null, e.Location, "carrier");
        }
        return changed;
    }
}
