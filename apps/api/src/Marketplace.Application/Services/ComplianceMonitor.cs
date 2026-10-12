using Marketplace.Application.Contracts;

namespace Marketplace.Application.Services;

/// <summary>
/// Rotina do monitoramento (ComplianceMonitorJob ou o botão do admin): verifica os anúncios publicados (Política 5.2),
/// procura padrões anômalos nas lojas (7.3) e cuida dos prazos dos vendedores (confirmação anual dos dados, correção em
/// 10 dias e fim das suspensões temporárias).
/// </summary>
public sealed class ComplianceMonitor(ComplianceService compliance, MonitoringService monitoring, SellerGovernanceService governance)
{
    public async Task<MonitoringRunResultDto> RunAsync(CancellationToken ct)
    {
        var flagged = await compliance.ScreenPublishedListingsAsync(ct);
        var alerts = await monitoring.DetectSellerPatternsAsync(ct);
        var (notices, suspended, lifted) = await governance.RunDailyAsync(ct);
        return new MonitoringRunResultDto(alerts, flagged, notices, suspended, lifted);
    }
}
