using Marketplace.Application.Abstractions;
using Marketplace.Application.Contracts;
using Marketplace.Application.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Marketplace.Infrastructure.Background;

public sealed class ComplianceMonitoringOptions
{
    public bool Enabled { get; set; } = true;
    /// <summary>Intervalo da rotina (verificação dos anúncios, padrões das lojas e prazos dos vendedores).</summary>
    public int IntervalMinutes { get; set; } = 360;
    /// <summary>Espera na subida da API antes da primeira rodada.</summary>
    public int StartupDelaySeconds { get; set; } = 120;
}

/// <summary>Monitoramento contínuo (Programa 6 e 8.2; Política 4.3, 5.2, 7.3 e 8.4) a cada ComplianceMonitoring:IntervalMinutes.</summary>
public sealed class ComplianceMonitorJob(
    IServiceScopeFactory scopes,
    IOptions<ComplianceMonitoringOptions> options,
    TimeProvider clock,
    ILogger<ComplianceMonitorJob> logger)
    : PeriodicJob(TimeSpan.FromMinutes(Math.Max(5, options.Value.IntervalMinutes)), logger)
{
    public static DateTime? LastRunAt { get; private set; }
    public static MonitoringRunResultDto? LastResult { get; private set; }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled) return;
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(Math.Max(0, options.Value.StartupDelaySeconds)), stoppingToken);
            await RunOnceAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Falha na primeira rodada do monitoramento de conformidade");
        }
        await base.ExecuteAsync(stoppingToken);
    }

    protected override async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var result = await scope.ServiceProvider.GetRequiredService<ComplianceMonitor>().RunAsync(ct);
        LastRunAt = clock.GetUtcNow().UtcDateTime;
        LastResult = result;
        if (result.NewAlerts + result.ListingsFlagged + result.NoticesCreated + result.SellersSuspended + result.SuspensionsLifted > 0)
            logger.LogInformation("Monitoramento: {Alerts} alerta(s), {Listings} anúncio(s) retirado(s), {Notices} aviso(s), {Suspended} suspensão(ões), {Lifted} liberação(ões)",
                result.NewAlerts, result.ListingsFlagged, result.NoticesCreated, result.SellersSuspended, result.SuspensionsLifted);
    }
}

/// <summary>
/// Envia por e-mail as comunicações gravadas para os vendedores (Política 8.5 e 10.3) e a decisão das denúncias para quem
/// denunciou com e-mail. Saída depois da gravação: nada é avisado sem ter sido registrado.
/// </summary>
public sealed class NoticeMailerJob(IServiceScopeFactory scopes, TimeProvider clock, ILogger<NoticeMailerJob> logger)
    : PeriodicJob(TimeSpan.FromMinutes(1), logger)
{
    protected override async Task RunOnceAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var email = scope.ServiceProvider.GetRequiredService<IEmailSender>();
        var links = scope.ServiceProvider.GetRequiredService<ILinkBuilder>();
        var brand = scope.ServiceProvider.GetRequiredService<IPlatformIdentityProvider>().Current.Brand;
        var now = clock.GetUtcNow().UtcDateTime;

        var notices = await db.SellerNotices.Where(n => n.EmailedAt == null && n.CreatedAt >= now.AddDays(-7))
            .OrderBy(n => n.CreatedAt).Take(50).ToListAsync(ct);
        foreach (var notice in notices)
        {
            var seller = await db.Sellers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == notice.SellerId, ct);
            var to = seller?.Email ?? (seller?.OwnerUserId is { } owner
                ? await db.Users.AsNoTracking().Where(u => u.Id == owner).Select(u => u.Email).FirstOrDefaultAsync(ct)
                : null);
            if (!string.IsNullOrWhiteSpace(to))
            {
                var due = notice.DueAt is { } d ? $"\n\nPrazo para responder: {d:dd/MM/yyyy}." : string.Empty;
                try
                {
                    await email.SendAsync(new EmailMessage(to, $"[{brand}] {notice.Title}",
                        $"{notice.Message}{due}\n\nVeja e responda no painel do vendedor: {links.SiteUrl.TrimEnd('/')}/vendedor/comunicacoes"), ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "Falha ao enviar a comunicação {Notice} por e-mail", notice.Id);
                    continue;
                }
            }
            notice.EmailedAt = now;
        }

        var reports = await db.ProductReports.Where(r => r.ResolvedAt != null && r.ReporterNotifiedAt == null)
            .OrderBy(r => r.ResolvedAt).Take(50).ToListAsync(ct);
        foreach (var report in reports)
        {
            var to = report.ReporterEmail ?? (report.ReporterUserId is { } uid
                ? await db.Users.AsNoTracking().Where(u => u.Id == uid).Select(u => u.Email).FirstOrDefaultAsync(ct)
                : null);
            if (!string.IsNullOrWhiteSpace(to) && !to.EndsWith("@anonimizado.local", StringComparison.Ordinal))
            {
                var outcome = report.Status == Domain.ProductReportStatus.Procedente
                    ? "A denúncia foi considerada procedente e as medidas da Política de Vendedores foram aplicadas."
                    : "Depois da análise, a equipe não encontrou irregularidade no anúncio.";
                try
                {
                    await email.SendAsync(new EmailMessage(to, $"[{brand}] Denúncia {report.Protocol}: decisão",
                        $"{outcome}{(string.IsNullOrWhiteSpace(report.ResolutionNote) ? "" : $"\n\n{report.ResolutionNote}")}\n\nObrigado por ajudar a manter a plataforma segura."), ct);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "Falha ao avisar a decisão da denúncia {Report}", report.Id);
                    continue;
                }
            }
            report.ReporterNotifiedAt = now;
        }
        if (notices.Count + reports.Count > 0) await db.SaveChangesAsync(ct);
    }
}
