using Marketplace.Application.Abstractions;
using Marketplace.Application.Services;
using Marketplace.Domain;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.ExchangeRates;
using Marketplace.Infrastructure.Payments;
using Marketplace.Infrastructure.Providers;
using Marketplace.Infrastructure.Shipping;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Background;

/// <summary>Loop de job com intervalo fixo; uma falha numa rodada não derruba o job.</summary>
public abstract class PeriodicJob(TimeSpan interval, ILogger logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Falha no job {Job}", GetType().Name);
            }
        }
    }

    protected abstract Task RunOnceAsync(CancellationToken ct);
}

/// <summary>Expira cobranças vencidas (confirmando no gateway antes) e, com o gateway fake, aprova Pix/boleto após N segundos (demo).</summary>
public sealed class PaymentMaintenanceJob(
    IServiceScopeFactory scopes,
    IOptions<FakePaymentOptions> fakeOptions,
    TimeProvider clock,
    ILogger<PaymentMaintenanceJob> logger) : PeriodicJob(TimeSpan.FromSeconds(5), logger)
{
    protected override async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var payments = scope.ServiceProvider.GetRequiredService<PaymentService>();

        var expired = await payments.ExpirePendingAsync(ct);
        if (expired > 0) logger.LogInformation("{Count} pagamento(s) expirado(s)", expired);

        var seconds = fakeOptions.Value.AutoApproveAfterSeconds;
        if (seconds <= 0) return;
        var threshold = clock.GetUtcNow().UtcDateTime.AddSeconds(-seconds);
        var pending = await db.Payments
            .Where(p => p.Status == PaymentStatus.Pendente && p.Gateway == FakePaymentGateway.GatewayName && p.CreatedAt < threshold && p.Method != PaymentMethod.Cartao)
            .ToListAsync(ct);
        foreach (var payment in pending)
        {
            await payments.ApproveAsync(payment, clock.GetUtcNow().UtcDateTime, ct);
            logger.LogInformation("Pagamento {PaymentId} aprovado automaticamente (gateway fake)", payment.Id);
        }
    }
}

/// <summary>Sincroniza rastreio com as transportadoras (polling) e conclui pedidos entregues após o prazo.</summary>
public sealed class LogisticsJob(
    IServiceScopeFactory scopes,
    IOptions<TrackingOptions> trackingOptions,
    TimeProvider clock,
    ILogger<LogisticsJob> logger)
    : PeriodicJob(Interval(trackingOptions.Value), logger)
{
    private static TimeSpan Interval(TrackingOptions options) =>
        options.Provider.Equals(FakeTrackingProvider.ProviderName, StringComparison.OrdinalIgnoreCase)
            ? TimeSpan.FromSeconds(30)
            : TimeSpan.FromMinutes(Math.Max(1, options.PollIntervalMinutes));

    protected override async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var tracking = scope.ServiceProvider.GetRequiredService<TrackingService>();
        var updated = await tracking.SyncAsync(trackingOptions.Value.PollBatchSize, ct);
        if (updated > 0) logger.LogInformation("{Count} pedido(s) com rastreio atualizado", updated);
        await AutoCompleteAsync(scope.ServiceProvider, ct);
    }

    /// <summary>Entregue há mais de AutoCompleteDays (contados da entrega, não da última alteração) → Concluído.</summary>
    private async Task AutoCompleteAsync(IServiceProvider sp, CancellationToken ct)
    {
        var db = sp.GetRequiredService<IAppDbContext>();
        var settings = await sp.GetRequiredService<PlatformSettingsProvider>().GetAsync(ct);
        var orders = sp.GetRequiredService<OrderService>();
        var threshold = clock.GetUtcNow().UtcDateTime.AddDays(-settings.AutoCompleteDays);
        var delivered = await orders.FullOrders()
            .Where(o => o.Status == OrderStatus.Entregue && o.Events.Any(e => e.Status == OrderStatus.Entregue && e.OccurredAt < threshold))
            .ToListAsync(ct);
        foreach (var order in delivered) orders.Transition(order, OrderStatus.Concluido, "Concluído automaticamente após o prazo.", null, "system");
        if (delivered.Count > 0) await db.SaveChangesAsync(ct);
    }
}

public sealed class HousekeepingOptions
{
    public int IntervalMinutes { get; set; } = 60;
    /// <summary>Cotações de checkout (escritas por rota anônima) somem após este prazo contado do vencimento.</summary>
    public int QuoteRetentionHours { get; set; } = 24;
    /// <summary>Refresh tokens expirados/revogados e tokens de senha vencidos.</summary>
    public int TokenRetentionDays { get; set; } = 7;
    /// <summary>Webhooks já processados.</summary>
    public int WebhookRetentionDays { get; set; } = 90;
}

/// <summary>Limpeza de tabelas que crescem sem parar (cotações, tokens, webhooks).</summary>
public sealed class HousekeepingJob(
    IServiceScopeFactory scopes,
    IOptions<HousekeepingOptions> options,
    TimeProvider clock,
    ILogger<HousekeepingJob> logger)
    : PeriodicJob(TimeSpan.FromMinutes(Math.Max(1, options.Value.IntervalMinutes)), logger)
{
    protected override async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var now = clock.GetUtcNow().UtcDateTime;
        var o = options.Value;

        var quotes = await db.CheckoutQuotes.Where(q => q.LockedUntil < now.AddHours(-o.QuoteRetentionHours)).ExecuteDeleteAsync(ct);
        var tokenCutoff = now.AddDays(-o.TokenRetentionDays);
        var refresh = await db.RefreshTokens.Where(t => t.ExpiresAt < tokenCutoff || (t.RevokedAt != null && t.RevokedAt < tokenCutoff)).ExecuteDeleteAsync(ct);
        var reset = await db.PasswordResetTokens.Where(t => t.ExpiresAt < tokenCutoff).ExecuteDeleteAsync(ct);
        var webhooks = await db.WebhookEvents.Where(w => w.ProcessedAt != null && w.ReceivedAt < now.AddDays(-o.WebhookRetentionDays)).ExecuteDeleteAsync(ct);

        if (quotes + refresh + reset + webhooks > 0)
            logger.LogInformation("Limpeza: {Quotes} cotações, {Refresh} refresh tokens, {Reset} tokens de senha, {Webhooks} webhooks", quotes, refresh, reset, webhooks);
    }
}

/// <summary>Importa cotações de câmbio do provedor configurado (nada a fazer com o provedor Manual).</summary>
public sealed class ExchangeRateRefreshJob(
    IServiceScopeFactory scopes,
    IOptions<ExchangeRateOptions> options,
    TimeProvider clock,
    ILogger<ExchangeRateRefreshJob> logger)
    : PeriodicJob(TimeSpan.FromMinutes(Math.Max(1, options.Value.RefreshIntervalMinutes)), logger)
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (options.Value.Provider.Equals(ManualExchangeRateProvider.ProviderName, StringComparison.OrdinalIgnoreCase)) return;
        // Importa logo na subida, mas uma falha aqui (rede, provedor fora) não pode derrubar a API: o loop tenta de novo.
        try
        {
            await RunOnceAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Falha na primeira importação de câmbio ({Provider}); nova tentativa em {Minutes} min", options.Value.Provider, options.Value.RefreshIntervalMinutes);
        }
        await base.ExecuteAsync(stoppingToken);
    }

    protected override async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var provider = scope.ServiceProvider.GetRequiredService<ProviderCatalog<IExchangeRateProvider>>().Resolve(options.Value.Provider);
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var rates = await provider.FetchAsync(options.Value.ParsedPairs(), ct);
        if (rates.Count == 0) return;

        var now = clock.GetUtcNow().UtcDateTime;
        foreach (var r in rates)
        {
            db.ExchangeRates.Add(new ExchangeRate
            {
                Id = Guid.NewGuid(),
                From = r.From,
                To = r.To,
                Numerator = r.Numerator,
                Denominator = r.Denominator,
                DisplayRate = r.DisplayRate,
                QuotedAt = r.QuotedAt == default ? now : r.QuotedAt,
                ExpiresAt = (r.QuotedAt == default ? now : r.QuotedAt).AddHours(Math.Max(1, options.Value.ValidityHours)),
                Source = provider.Name,
            });
        }
        await db.SaveChangesAsync(ct);
        logger.LogInformation("{Count} cotação(ões) importada(s) de {Provider}", rates.Count, provider.Name);
    }
}
