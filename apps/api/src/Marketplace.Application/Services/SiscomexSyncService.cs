using System.Globalization;
using System.Text;
using Marketplace.Application.Abstractions;
using Marketplace.Domain;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

public sealed record SiscomexSyncSummary(int Shipments, int Updated, int NewOccurrences, int SuspendedSellers);

/// <summary>
/// Lê no Portal Único (consulta de remessas da ECE) a situação de cada remessa, as ocorrências e as divergências do
/// despacho e transforma o que derruba indicador em <see cref="ComplianceOccurrence"/> (fonte Siscomex). É assim que o
/// painel de conformidade acompanha, com os dados da própria Receita, os três indicadores da Portaria Coana 193/2026.
/// </summary>
public sealed class SiscomexSyncService(
    IAppDbContext db,
    ISiscomexRemessaClient client,
    ComplianceService compliance,
    TimeProvider clock,
    ILogger<SiscomexSyncService> logger)
{
    /// <summary>Situações da remessa, pela tabela de eventos de alteração de situação da API de Remessas Internacionais.</summary>
    public static readonly IReadOnlyDictionary<int, string> StatusNames = new Dictionary<int, string>
    {
        [2] = "Manifestada",
        [4] = "Em fiscalização",
        [10] = "Liberada",
        [11] = "Não liberada",
        [12] = "Desembaraçada",
        [13] = "Em divergência por abandono (ocorrência sem resolução)",
        [14] = "Em divergência por abandono (falta de declaração)",
        [15] = "Em divergência por abandono (sem pagamento)",
        [17] = "Em devolução / declaração cancelada",
        [18] = "Baixada (sem presença de carga)",
        [19] = "Abandonada",
        [20] = "Em perdimento",
        [21] = "Destruída",
        [22] = "Descaracterizada / declaração cancelada",
        [27] = "Em fiscalização por revisão",
    };

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public bool IsConfigured => client.IsConfigured;

    /// <summary>Remessas postadas na janela que ainda podem mudar de situação.</summary>
    public async Task<IReadOnlyList<string>> ShipmentNumbersToCheckAsync(int lookbackDays, int max, CancellationToken ct)
    {
        var from = Now.AddDays(-lookbackDays);
        return await db.Shipments.AsNoTracking()
            .Where(s => s.TrackingCode != null && s.PostedAt != null && s.PostedAt >= from && s.Status != ShipmentStatus.Cancelada)
            .OrderBy(s => s.CustomsCheckedAt ?? DateTime.MinValue)
            .Select(s => s.TrackingCode!)
            .Take(max)
            .ToListAsync(ct);
    }

    /// <summary>Aplica o resultado de uma consulta já processada pelo Portal Único.</summary>
    public async Task<SiscomexSyncSummary> ApplyAsync(SiscomexQueryResult result, IReadOnlyDictionary<string, string> occurrenceMap, CancellationToken ct)
    {
        var numbers = result.Shipments.Select(s => s.ShipmentNumber.Trim().ToUpperInvariant()).ToList();
        var shipments = await db.Shipments.Include(s => s.Order)
            .Where(s => s.TrackingCode != null && numbers.Contains(s.TrackingCode))
            .ToDictionaryAsync(s => s.TrackingCode!, ct);
        var before = db.ComplianceOccurrences.Local.Count;
        var sellers = new HashSet<Guid>();
        var updated = 0;

        foreach (var remote in result.Shipments)
        {
            if (!shipments.TryGetValue(remote.ShipmentNumber.Trim().ToUpperInvariant(), out var shipment)) continue;
            updated++;
            shipment.DirNumber = remote.DirNumber ?? shipment.DirNumber;
            shipment.CustomsStatusCode = remote.StatusCode;
            shipment.CustomsStatus = remote.StatusCode is { } code
                ? StatusNames.GetValueOrDefault(code, $"Situação {code:00}") + (remote.UnderInspection ? " · selecionada para fiscalização" : "")
                : remote.UnderInspection ? "Selecionada para fiscalização" : null;
            shipment.CustomsCheckedAt = Now;

            foreach (var o in remote.Occurrences)
            {
                var indicator = Classify(o.Code, $"{o.Name} {o.Note}", "oc", occurrenceMap);
                if (indicator is null)
                {
                    logger.LogInformation("Ocorrência Siscomex {Code} \"{Name}\" na remessa {Number} não mapeada para indicador", o.Code, o.Name, remote.ShipmentNumber);
                    continue;
                }
                await compliance.AddOccurrenceAsync(indicator.Value, OccurrenceSource.Siscomex, $"SISCOMEX_OC_{o.Code}",
                    $"{o.Name}{(string.IsNullOrWhiteSpace(o.Note) ? "" : " — " + o.Note)} (remessa {remote.ShipmentNumber})",
                    shipment.SellerId, null, shipment.OrderId, shipment.Id, $"oc:{o.Id}", o.InsertedAt ?? Now, ct);
                sellers.Add(shipment.SellerId);
            }

            foreach (var d in remote.Divergences.Where(d => d.Active))
            {
                var indicator = Classify(d.Code, d.Justification ?? "", "div", occurrenceMap);
                if (indicator is null) continue;
                await compliance.AddOccurrenceAsync(indicator.Value, OccurrenceSource.Siscomex, $"SISCOMEX_DIV_{d.Code}",
                    $"Divergência {d.Code}: {d.Justification} (remessa {remote.ShipmentNumber})",
                    shipment.SellerId, null, shipment.OrderId, shipment.Id, $"div:{remote.ShipmentNumber}:{d.Code}", Now, ct);
                sellers.Add(shipment.SellerId);
            }

            // Subvaloração: valor tributável do despacho maior que o declarado (margem de R$ 1,00 + 1% para câmbio).
            if (remote.TaxableValueBrl is { } taxable && shipment.Order.TaxBreakdown is { } ours)
            {
                var declared = ours.CustomsValue.Amount / 100m;
                if (taxable > declared * 1.01m + 1m)
                {
                    await compliance.AddOccurrenceAsync(ComplianceIndicator.Subvaloracao, OccurrenceSource.Siscomex, "VALOR_MAJORADO",
                        string.Create(CultureInfo.GetCultureInfo("pt-BR"),
                            $"Valor tributável no despacho R$ {taxable:N2} acima do declarado R$ {declared:N2} (remessa {remote.ShipmentNumber})."),
                        shipment.SellerId, null, shipment.OrderId, shipment.Id, $"val:{remote.ShipmentNumber}", Now, ct);
                    sellers.Add(shipment.SellerId);
                }
            }
        }

        await db.SaveChangesAsync(ct);
        var created = db.ComplianceOccurrences.Local.Count - before;
        var suspended = 0;
        foreach (var seller in sellers)
            if (await compliance.EvaluateSellerStrikesAsync(seller, ct)) suspended++;
        return new SiscomexSyncSummary(result.Shipments.Count, updated, Math.Max(0, created), suspended);
    }

    /// <summary>
    /// Indicador de uma ocorrência/divergência: primeiro o mapa configurado (Siscomex:OccurrenceMap, chave "oc:123" ou
    /// "div:12" → Contrafacao | Subvaloracao | QualidadeDeclaracao | Ignorar), depois palavras-chave do texto.
    /// </summary>
    public static ComplianceIndicator? Classify(int code, string text, string kind, IReadOnlyDictionary<string, string> map)
    {
        if (map.TryGetValue($"{kind}:{code}", out var mapped))
            return Enum.TryParse<ComplianceIndicator>(mapped, true, out var configured) ? configured : null;
        var t = Fold(text);
        if (ContainsAny(t, "contrafa", "falsifica", "pirata", "pirataria", "marca registrada", "propriedade intelectual")) return ComplianceIndicator.Contrafacao;
        if (ContainsAny(t, "subvalor", "subfatur", "valor declarado", "valor aduaneiro", "valor da mercadoria", "arbitramento", "majora")) return ComplianceIndicator.Subvaloracao;
        if (ContainsAny(t, "cpf", "destinatario", "remetente", "descricao", "ncm", "classificacao", "regime de tributacao",
                "conteudo", "falsa declaracao", "declaracao inexata", "dados do"))
            return ComplianceIndicator.QualidadeDeclaracao;
        return null;
    }

    private static bool ContainsAny(string text, params string[] needles) => needles.Any(n => text.Contains(n, StringComparison.Ordinal));

    private static string Fold(string text)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(char.ToLowerInvariant(c));
        return sb.ToString();
    }
}
