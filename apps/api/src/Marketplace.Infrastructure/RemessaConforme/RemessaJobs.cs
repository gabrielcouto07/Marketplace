using Marketplace.Application.Abstractions;
using Marketplace.Application.Services;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.Background;
using Marketplace.Infrastructure.Gov;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.RemessaConforme;

/// <summary>Repasse de tributos ao operador e aviso de cancelamentos (a cada RemessaConforme:JobIntervalMinutes).</summary>
public sealed class RemessaJob(IServiceScopeFactory scopes, IOptions<RemessaConformeOptions> options, ILogger<RemessaJob> logger)
    : PeriodicJob(TimeSpan.FromMinutes(Math.Max(1, options.Value.JobIntervalMinutes)), logger)
{
    protected override async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var remessa = scope.ServiceProvider.GetRequiredService<RemessaService>();
        var remitted = await remessa.RemitPendingTaxesAsync(100, ct);
        var cancelled = await remessa.NotifyCancellationsAsync(50, ct);
        if (remitted + cancelled > 0) logger.LogInformation("Remessas: {Remitted} repasse(s) enviado(s), {Cancelled} cancelamento(s) avisado(s)", remitted, cancelled);
    }
}

/// <summary>
/// Sincroniza a situação aduaneira das remessas pela consulta da ECE no Portal Único. A consulta é assíncrona: a rodada
/// envia o pedido, aguarda o processamento por até ~2 min e, se não terminar, retoma o mesmo protocolo na próxima.
/// </summary>
public sealed class SiscomexSyncJob(
    IServiceScopeFactory scopes,
    IOptions<SiscomexOptions> options,
    ISiscomexRemessaClient client,
    TimeProvider clock,
    ILogger<SiscomexSyncJob> logger)
    : PeriodicJob(TimeSpan.FromMinutes(Math.Max(5, options.Value.SyncIntervalMinutes)), logger)
{
    private string? _pendingProtocol;

    public static DateTime? LastSuccessAt { get; private set; }
    public static string? LastResult { get; private set; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!client.IsConfigured)
        {
            logger.LogInformation("Siscomex sem chave de acesso: sincronização desligada (Siscomex__ClientId/ClientSecret/Cnpj)");
            return;
        }
        await base.ExecuteAsync(stoppingToken);
    }

    protected override async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var sync = scope.ServiceProvider.GetRequiredService<SiscomexSyncService>();
        var o = options.Value;
        if (_pendingProtocol is null)
        {
            var numbers = await sync.ShipmentNumbersToCheckAsync(o.LookbackDays, o.MaxShipmentsPerQuery, ct);
            if (numbers.Count == 0) return;
            var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
            _pendingProtocol = await client.RequestShipmentsQueryAsync(today.AddDays(-Math.Min(366, o.LookbackDays)), today, numbers, ct);
            logger.LogInformation("Consulta de {Count} remessa(s) enviada ao Portal Único (protocolo {Protocol})", numbers.Count, _pendingProtocol);
        }
        for (var attempt = 0; attempt < 8; attempt++)
        {
            await Task.Delay(TimeSpan.FromSeconds(15), ct);
            var result = await client.GetShipmentsQueryAsync(_pendingProtocol, ct);
            if (!result.Completed) continue;
            _pendingProtocol = null;
            var summary = await sync.ApplyAsync(result, o.OccurrenceMap, ct);
            LastSuccessAt = clock.GetUtcNow().UtcDateTime;
            LastResult = $"{summary.Updated} remessa(s) atualizada(s), {summary.NewOccurrences} ocorrência(s) nova(s), {summary.SuspendedSellers} loja(s) descredenciada(s)";
            logger.LogInformation("Siscomex: {Result}", LastResult);
            foreach (var error in result.Errors) logger.LogWarning("Siscomex (erro na consulta): {Error}", error);
            return;
        }
        logger.LogInformation("Protocolo {Protocol} ainda em processamento; retomando na próxima rodada", _pendingProtocol);
    }
}

/// <summary>Grava a PTAX de venda do dólar (Banco Central) como cotação USD→BRL quando muda ou está para vencer.</summary>
public sealed class PtaxRefreshJob(
    IServiceScopeFactory scopes,
    IOptions<PtaxOptions> options,
    TimeProvider clock,
    ILogger<PtaxRefreshJob> logger)
    : PeriodicJob(TimeSpan.FromMinutes(Math.Max(15, options.Value.RefreshIntervalMinutes)), logger)
{
    public static DateTime? LastSuccessAt { get; private set; }
    public static string? LastRate { get; private set; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Provider.Equals(BcbPtaxClient.ProviderName, StringComparison.OrdinalIgnoreCase)) return;
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
            logger.LogWarning(ex, "PTAX indisponível na subida; nova tentativa em {Minutes} min", options.Value.RefreshIntervalMinutes);
        }
        await base.ExecuteAsync(stoppingToken);
    }

    protected override async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var ptax = scope.ServiceProvider.GetRequiredService<BcbPtaxClient>();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var rate = await ptax.LatestUsdBrlAsync(ct);
        if (rate is null) return;
        var now = clock.GetUtcNow().UtcDateTime;
        var current = await db.ExchangeRates.AsNoTracking()
            .Where(r => r.From == CurrencyCode.USD && r.To == CurrencyCode.BRL && r.Source == BcbPtaxClient.ProviderName)
            .OrderByDescending(r => r.QuotedAt).FirstOrDefaultAsync(ct);
        LastSuccessAt = now;
        LastRate = rate.DisplayRate;
        if (current is not null && current.DisplayRate == rate.DisplayRate && current.ExpiresAt > now.AddHours(24)) return;
        // QuotedAt = momento da importação: a PTAX gravada passa a ser a cotação vigente (mais recente que a do seed/admin).
        db.ExchangeRates.Add(new ExchangeRate
        {
            Id = Guid.NewGuid(),
            From = CurrencyCode.USD,
            To = CurrencyCode.BRL,
            Numerator = rate.Numerator,
            Denominator = rate.Denominator,
            DisplayRate = rate.DisplayRate,
            QuotedAt = now,
            ExpiresAt = now.AddHours(Math.Max(24, options.Value.ValidityHours)),
            Source = BcbPtaxClient.ProviderName,
        });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Câmbio USD→BRL atualizado pela PTAX: {Rate}", rate.DisplayRate);
    }
}

/// <summary>Carrega a tabela NCM do cache na subida e atualiza do Siscomex uma vez por dia.</summary>
public sealed class NcmRefreshJob(SiscomexNcmCatalog catalog, IOptions<NcmOptions> options, ILogger<NcmRefreshJob> logger)
    : PeriodicJob(TimeSpan.FromHours(Math.Max(1, options.Value.RefreshHours)), logger)
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (options.Value.Source.Equals("Offline", StringComparison.OrdinalIgnoreCase)) return;
        await catalog.RefreshAsync(forceDownload: false, stoppingToken);
        await base.ExecuteAsync(stoppingToken);
    }

    protected override Task RunOnceAsync(CancellationToken ct) => catalog.RefreshAsync(forceDownload: true, ct);
}
