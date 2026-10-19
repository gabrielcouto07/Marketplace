using System.Globalization;
using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Compliance;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

/// <summary>
/// Monitoramento das operações (Programa 6.1 a 6.5; Política 7.1 a 7.3): fracionamento de compras, aumento abrupto de
/// remessas, concentração para o mesmo destinatário, divergência reiterada entre anunciado e enviado e valor declarado
/// diferente do cobrado. Cada indício vira um alerta julgado pela equipe; o fracionamento dentro da mesma loja segura a
/// etiqueta até o julgamento.
/// </summary>
public sealed class MonitoringService(
    IAppDbContext db,
    PlatformSettingsProvider settingsProvider,
    SellerGovernanceService governance,
    ICurrentUser currentUser,
    TimeProvider clock,
    ILogger<MonitoringService> logger)
{
    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");
    private static readonly OrderStatus[] Dropped = [OrderStatus.Cancelado, OrderStatus.Reembolsado, OrderStatus.Devolvido];

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    /// <summary>Abre o alerta ou atualiza o aberto com a mesma chave (o mesmo indício não gera dois alertas). Não salva.</summary>
    public async Task<(MonitoringAlert Alert, bool Created)> RaiseAsync(MonitoringAlertType type, string dedupKey, Guid? sellerId, Guid? buyerUserId,
        string summary, IReadOnlyList<Guid> orderIds, object details, bool holdsShipments, CancellationToken ct)
    {
        var key = dedupKey.Length > 200 ? dedupKey[..200] : dedupKey;
        var alert = db.MonitoringAlerts.Local.FirstOrDefault(a => a.DedupKey == key && a.Status == MonitoringAlertStatus.Aberto)
                    ?? await db.MonitoringAlerts.FirstOrDefaultAsync(a => a.DedupKey == key && a.Status == MonitoringAlertStatus.Aberto, ct);
        var created = alert is null;
        if (alert is null)
        {
            // Alerta já julgado com a mesma chave não reabre (ex.: concentração do mesmo mês).
            if (await db.MonitoringAlerts.AnyAsync(a => a.DedupKey == key, ct)) return (await db.MonitoringAlerts.FirstAsync(a => a.DedupKey == key, ct), false);
            alert = new MonitoringAlert { Id = Guid.NewGuid(), Type = type, DedupKey = key, Summary = string.Empty, DetectedAt = Now };
            db.MonitoringAlerts.Add(alert);
            governance.LogAction(EnforcementActionKind.AlertaMonitoramento, summary, "Alerta aberto para análise da equipe.", sellerId, alertId: alert.Id, automatic: true);
        }
        alert.SellerId = sellerId;
        alert.BuyerUserId = buyerUserId;
        alert.Summary = summary.Length > 500 ? summary[..500] : summary;
        alert.OrderIds = orderIds.Distinct().ToList();
        alert.DetailsJson = JsonSerializer.Serialize(details);
        alert.HoldsShipments = holdsShipments;
        alert.UpdatedAt = Now;
        if (created) logger.LogWarning("Alerta de monitoramento {Type}: {Summary}", type, summary);
        return (alert, created);
    }

    // =================================================================================================================
    // Fracionamento (Programa 6.4)
    // =================================================================================================================

    /// <summary>
    /// Depois de cada compra: pedidos do mesmo comprador, para o mesmo endereço, nos últimos 7 dias, cuja soma muda a faixa
    /// de tributação de algum deles ou passa do limite do regime simplificado. Se a mesma loja tem mais de um desses
    /// pedidos (fracionamento atribuível ao vendedor, 6.5), a etiqueta fica retida até a equipe julgar. Salva.
    /// </summary>
    public async Task<MonitoringAlert?> CheckFractioningAsync(Guid userId, IReadOnlyList<Guid> newOrderIds, CancellationToken ct)
    {
        var since = Now.AddDays(-ProgramDeadlines.FractioningWindowDays);
        var orders = await db.Orders.AsNoTracking()
            .Where(o => o.UserId == userId && o.CreatedAt >= since && !Dropped.Contains(o.Status))
            .Select(o => new { o.Id, o.Number, o.SellerId, o.ShippingAddress, o.TaxBreakdown, o.CreatedAt })
            .ToListAsync(ct);
        var current = orders.Where(o => newOrderIds.Contains(o.Id)).ToList();
        if (current.Count == 0) return null;
        var addressKey = Fractioning.AddressKey(current[0].ShippingAddress.PostalCode, current[0].ShippingAddress.Number, current[0].ShippingAddress.Complement);
        var group = orders
            .Where(o => Fractioning.AddressKey(o.ShippingAddress.PostalCode, o.ShippingAddress.Number, o.ShippingAddress.Complement) == addressKey)
            .Where(o => o.TaxBreakdown?.CustomsValueUsdCents is not null)
            .OrderBy(o => o.CreatedAt)
            .ToList();
        var values = group.Select(o => o.TaxBreakdown!.CustomsValueUsdCents!.Value).ToList();
        if (!Fractioning.IsIndication(values)) return null;

        var sameSeller = group.GroupBy(o => o.SellerId).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
        var total = values.Sum();
        var summary = string.Create(PtBr,
            $"{group.Count} pedidos do mesmo comprador para o mesmo endereço em até 7 dias somam US$ {total / 100m:N2} e mudam a faixa de tributação " +
            $"({string.Join(", ", group.Select(o => o.Number))}).{(sameSeller.Count > 0 ? " Há mais de um pedido da mesma loja: etiqueta retida até a análise." : "")}");
        // Compra nova no mesmo grupo atualiza o alerta aberto; julgado o alerta, um grupo maior abre outro.
        var prefix = $"frac:{userId:N}:{addressKey}:";
        var openKey = await db.MonitoringAlerts.Where(a => a.Status == MonitoringAlertStatus.Aberto && a.DedupKey.StartsWith(prefix))
            .Select(a => a.DedupKey).FirstOrDefaultAsync(ct);
        var (alert, _) = await RaiseAsync(MonitoringAlertType.Fracionamento, openKey ?? $"{prefix}{group[0].Id:N}:{group.Count}",
            sameSeller.Count == 1 ? sameSeller[0] : group.Select(o => o.SellerId).Distinct().Count() == 1 ? group[0].SellerId : null,
            userId, summary, group.Select(o => o.Id).ToList(),
            new { totalUsdCents = total, orders = group.Select(o => new { o.Number, usdCents = o.TaxBreakdown!.CustomsValueUsdCents, o.SellerId }) },
            holdsShipments: sameSeller.Count > 0, ct);
        await db.SaveChangesAsync(ct);
        return alert;
    }

    /// <summary>Remessa retida por um alerta em aberto (o vendedor não gera etiqueta até o julgamento).</summary>
    public async Task<MonitoringAlert?> HoldingAlertAsync(Guid orderId, CancellationToken ct)
    {
        var open = await db.MonitoringAlerts.AsNoTracking().Where(a => a.Status == MonitoringAlertStatus.Aberto && a.HoldsShipments).ToListAsync(ct);
        return open.FirstOrDefault(a => a.OrderIds.Contains(orderId));
    }

    // =================================================================================================================
    // Padrões das lojas (Política 7.3 a, b, e) — rotina diária
    // =================================================================================================================

    private static readonly string[] DivergenceCodes = ["CONTEUDO", "DIVERGENCIA", "DESCRICAO", "DECLARATION_ERROR"];

    public async Task<int> DetectSellerPatternsAsync(CancellationToken ct)
    {
        var settings = await settingsProvider.GetAsync(ct);
        var now = Now;
        var created = 0;

        // a) Aumento abrupto: remessas da loja na última semana × média semanal das 8 anteriores.
        var shipped = await db.OrderEvents.AsNoTracking()
            .Where(e => e.Status == OrderStatus.Enviado && e.OccurredAt >= now.AddDays(-63))
            .Join(db.Orders, e => e.OrderId, o => o.Id, (e, o) => new { o.SellerId, e.OccurredAt })
            .ToListAsync(ct);
        var week = ISOWeek.GetWeekOfYear(now);
        foreach (var bySeller in shipped.GroupBy(s => s.SellerId))
        {
            var last = bySeller.Count(s => s.OccurredAt >= now.AddDays(-7));
            var before = bySeller.Count(s => s.OccurredAt < now.AddDays(-7)) / 8.0;
            if (last < settings.AbruptIncreaseMinShipments || last < settings.AbruptIncreaseFactor * Math.Max(1, before)) continue;
            var (_, isNew) = await RaiseAsync(MonitoringAlertType.AumentoAbrupto, $"abrupt:{bySeller.Key:N}:{now.Year}-W{week}", bySeller.Key, null,
                string.Create(PtBr, $"{last} remessas nos últimos 7 dias contra média de {before:N1} por semana nas 8 semanas anteriores."), [],
                new { lastWeek = last, weeklyAverage = before }, holdsShipments: false, ct);
            if (isNew) created++;
        }

        // b) Concentração: remessas da mesma loja para o mesmo destinatário (CPF) ou endereço em 30 dias.
        var recent = await db.Orders.AsNoTracking()
            .Where(o => o.CreatedAt >= now.AddDays(-30) && !Dropped.Contains(o.Status) && o.Status != OrderStatus.AguardandoPagamento)
            .Select(o => new { o.Id, o.Number, o.SellerId, o.RecipientDocument, o.ShippingAddress })
            .ToListAsync(ct);
        foreach (var bySeller in recent.GroupBy(o => o.SellerId))
        {
            var groups = bySeller.GroupBy(o => Documents.OnlyDigits(o.RecipientDocument)).Where(g => g.Key.Length == 11)
                .Select(g => (Key: $"cpf:{g.Key}", Label: $"CPF {Mappers.MaskDocument(g.Key)}", Orders: g.ToList()))
                .Concat(bySeller.GroupBy(o => Fractioning.AddressKey(o.ShippingAddress.PostalCode, o.ShippingAddress.Number, o.ShippingAddress.Complement))
                    .Select(g => (Key: $"end:{g.Key}", Label: $"endereço CEP {g.First().ShippingAddress.PostalCode}", Orders: g.ToList())))
                .Where(g => g.Orders.Count >= settings.ConcentrationThreshold);
            foreach (var g in groups)
            {
                var (_, isNew) = await RaiseAsync(MonitoringAlertType.ConcentracaoDestinatario, $"conc:{bySeller.Key:N}:{g.Key}:{now:yyyyMM}", bySeller.Key, null,
                    $"{g.Orders.Count} remessas da loja para o mesmo destinatário ({g.Label}) em 30 dias.", g.Orders.Select(o => o.Id).ToList(),
                    new { orders = g.Orders.Select(o => o.Number) }, holdsShipments: false, ct);
                if (isNew) created++;
            }
        }

        // e) Divergência reiterada entre o produto anunciado e o enviado: ocorrências da Receita e infrações de divergência
        //    (denúncias procedentes, alertas julgados) em 90 dias.
        var since = now.AddDays(-90);
        var divergences = await ComplianceService.FromReceita(db.ComplianceOccurrences.AsNoTracking())
            .Where(o => o.SellerId != null && o.Status != OccurrenceStatus.Anulada && o.OccurredAt >= since)
            .Select(o => new { SellerId = o.SellerId!.Value, o.Code, o.OrderId })
            .ToListAsync(ct);
        divergences.AddRange(await db.SellerInfractions.AsNoTracking()
            .Where(i => i.OccurredAt >= since && i.Code == "DIVERGENCIA")
            .Select(i => new { i.SellerId, i.Code, i.OrderId })
            .ToListAsync(ct));
        foreach (var bySeller in divergences.Where(d => DivergenceCodes.Any(c => d.Code.Contains(c, StringComparison.OrdinalIgnoreCase))).GroupBy(d => d.SellerId))
        {
            if (bySeller.Count() < 2) continue;
            var (_, isNew) = await RaiseAsync(MonitoringAlertType.DivergenciaReiterada, $"div:{bySeller.Key:N}:{now:yyyyMM}", bySeller.Key, null,
                $"{bySeller.Count()} registros de divergência entre o anunciado e o enviado em 90 dias.",
                bySeller.Where(d => d.OrderId is not null).Select(d => d.OrderId!.Value).ToList(), new { codes = bySeller.Select(d => d.Code) }, false, ct);
            if (isNew) created++;
        }

        await db.SaveChangesAsync(ct);
        return created;
    }

    // =================================================================================================================
    // Fila de alertas (admin)
    // =================================================================================================================

    public async Task<PagedResult<MonitoringAlertDto>> ListAsync(MonitoringAlertStatus? status, MonitoringAlertType? type, int? page, int? pageSize, CancellationToken ct)
    {
        var source = db.MonitoringAlerts.AsNoTracking();
        if (status is { } s) source = source.Where(a => a.Status == s);
        if (type is { } t) source = source.Where(a => a.Type == t);
        var (p, size) = Pagination.Normalize(page, pageSize, 20);
        var total = await source.CountAsync(ct);
        var rows = await source.OrderBy(a => a.Status == MonitoringAlertStatus.Aberto ? 0 : 1).ThenByDescending(a => a.DetectedAt)
            .Skip((p - 1) * size).Take(size).ToListAsync(ct);
        return new PagedResult<MonitoringAlertDto>(await ToDtosAsync(rows, ct), p, size, total);
    }

    private async Task<List<MonitoringAlertDto>> ToDtosAsync(IReadOnlyList<MonitoringAlert> rows, CancellationToken ct)
    {
        var sellerIds = rows.Where(r => r.SellerId is not null).Select(r => r.SellerId!.Value).Distinct().ToList();
        var buyerIds = rows.Where(r => r.BuyerUserId is not null).Select(r => r.BuyerUserId!.Value).Distinct().ToList();
        var orderIds = rows.SelectMany(r => r.OrderIds).Distinct().ToList();
        var sellers = await db.Sellers.AsNoTracking().Where(s => sellerIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.Name, ct);
        var buyers = await db.Users.AsNoTracking().Where(u => buyerIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Email, ct);
        var numbers = await db.Orders.AsNoTracking().Where(o => orderIds.Contains(o.Id)).ToDictionaryAsync(o => o.Id, o => o.Number, ct);
        return rows.Select(a => new MonitoringAlertDto(a.Id, a.Type, a.Status, a.SellerId, a.SellerId is { } sid ? sellers.GetValueOrDefault(sid) : null,
            a.BuyerUserId, a.BuyerUserId is { } bid ? buyers.GetValueOrDefault(bid) : null, a.Summary,
            a.OrderIds.Select(id => numbers.GetValueOrDefault(id) ?? id.ToString()[..8]).ToList(), a.HoldsShipments, a.DetectedAt, a.Attribution,
            a.ResolutionNote, a.ResolvedAt)).ToList();
    }

    /// <summary>
    /// Julgamento do indício. Procedente atribuído ao vendedor registra a infração (Programa 6.5 → Política). O julgamento
    /// libera a etiqueta retida.
    /// </summary>
    public async Task<MonitoringAlertDto> ResolveAsync(Guid id, MonitoringAlertResolveRequest request, CancellationToken ct)
    {
        var alert = await db.MonitoringAlerts.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw AppException.NotFound("Alerta");
        if (alert.Status != MonitoringAlertStatus.Aberto) throw AppException.Conflict("ALERT_RESOLVED", "Este alerta já foi julgado.");
        var note = request.Note?.Trim() ?? string.Empty;
        new ValidationErrors()
            .AddIf(note.Length < 5, "note", "Registre a conclusão da análise.")
            .AddIf(note.Length > 1000, "note", "Máximo de 1.000 caracteres.")
            .AddIf(request.Upheld && request.Attribution is null, "attribution", "Informe a quem o indício é atribuído.")
            .AddIf(request.RegisterInfraction && (request.Attribution != AlertAttribution.Vendedor || alert.SellerId is null), "registerInfraction",
                "A infração é registrada quando o indício é atribuído a uma loja.")
            .ThrowIfAny();
        alert.Status = request.Upheld ? MonitoringAlertStatus.Procedente : MonitoringAlertStatus.Improcedente;
        alert.Attribution = request.Upheld ? request.Attribution : null;
        alert.ResolutionNote = note;
        alert.ResolvedAt = Now;
        alert.ResolvedByUserId = currentUser.UserId;
        alert.HoldsShipments = false;
        if (request.Upheld && request.RegisterInfraction && alert.SellerId is { } sellerId)
        {
            var code = alert.Type switch
            {
                MonitoringAlertType.Fracionamento => "FRACIONAMENTO",
                MonitoringAlertType.PrecoMuitoAbaixo or MonitoringAlertType.ValorDeclarado => "SUBFATURAMENTO",
                MonitoringAlertType.DivergenciaReiterada => "DIVERGENCIA",
                MonitoringAlertType.Remetente => "OCULTACAO_REMETENTE",
                MonitoringAlertType.OcorrenciasReceita => "OCORRENCIAS_RECEITA",
                _ => "PADRAO_ANOMALO",
            };
            var infraction = await governance.AddInfractionAsync(sellerId, code, $"{alert.Summary} Conclusão: {note}",
                request.Severity ?? InfractionSeverity.Media, false, alert.DetectedAt, alertId: alert.Id, ct: ct);
            alert.InfractionId = infraction.Id;
        }
        governance.LogAction(EnforcementActionKind.AlertaMonitoramento, note,
            request.Upheld ? $"Indício procedente ({request.Attribution})." : "Indício improcedente.", alert.SellerId, alertId: alert.Id);
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.alert.resolve", Target = alert.Id.ToString(), OccurredAt = Now, Details = alert.Status.ToString() });
        await db.SaveChangesAsync(ct);
        return (await ToDtosAsync([alert], ct))[0];
    }
}
