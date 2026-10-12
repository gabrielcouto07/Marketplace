using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Compliance;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

/// <summary>
/// Relacionamento com a Receita Federal (Programa de Conformidade 3, 11 e 12): consulta mensal dos indicadores (11.2),
/// planos de ação em 30 dias (11.4), notificações saneadas em 30 dias (11.5), contestação só pelos fundamentos do 11.6
/// com indicador, remessas e fundamentação (11.7), manifestação do ciclo de 1º a 31 de outubro (11.8), ouvidoria em 5 dias
/// úteis (12.2) e comunicação de fatos (3.6). Cada registro fica com prazo, resposta e anexos.
/// </summary>
public sealed class ReceitaRelationsService(
    IAppDbContext db,
    DocumentLinks links,
    ICurrentUser currentUser,
    TimeProvider clock)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public static string ContestationReasonText(ContestationReason reason) => reason switch
    {
        ContestationReason.ErroMaterial => "erro material",
        ContestationReason.InconsistenciaSistemica => "inconsistência sistêmica",
        _ => "impropriedade na aplicação da metodologia de cálculo",
    };

    private async Task<RfInteractionDto> ToDtoAsync(RfInteraction r, CancellationToken ct)
    {
        var ids = new[] { r.CompletedByUserId, r.CreatedByUserId }.Where(i => i is not null).Select(i => i!.Value).ToList();
        var emails = await db.Users.AsNoTracking().Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Email, ct);
        return ToDto(r, emails);
    }

    private RfInteractionDto ToDto(RfInteraction r, IReadOnlyDictionary<Guid, string> emails) =>
        new(r.Id, r.Type, r.Status, r.Title, r.Description, r.Reference, r.OpenedAt, r.DueAt,
            r.Status == RfInteractionStatus.Pendente && r.DueAt is { } due && due < Now,
            r.Indicator, r.ContestationReason, r.OccurrenceIds, r.Year, r.Month,
            r.OfficialCounterfeitPermyriad, r.OfficialUndervaluationPermyriad, r.OfficialDeclarationQualityPermyriad,
            r.Response, links.Refs(r.Attachments), r.CompletedAt,
            r.CompletedByUserId is { } c ? emails.GetValueOrDefault(c) : null, r.CreatedAt,
            r.CreatedByUserId is { } cr ? emails.GetValueOrDefault(cr) : null);

    public async Task<PagedResult<RfInteractionDto>> ListAsync(RfInteractionType? type, RfInteractionStatus? status, int? page, int? pageSize, CancellationToken ct)
    {
        var source = db.RfInteractions.AsNoTracking();
        if (type is { } t) source = source.Where(r => r.Type == t);
        if (status is { } s) source = source.Where(r => r.Status == s);
        var (p, size) = Pagination.Normalize(page, pageSize, 20);
        var total = await source.CountAsync(ct);
        var rows = await source.OrderBy(r => r.Status).ThenByDescending(r => r.OpenedAt).Skip((p - 1) * size).Take(size).ToListAsync(ct);
        var ids = rows.SelectMany(r => new[] { r.CompletedByUserId, r.CreatedByUserId }).Where(i => i is not null).Select(i => i!.Value).Distinct().ToList();
        var emails = await db.Users.AsNoTracking().Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Email, ct);
        return new PagedResult<RfInteractionDto>(rows.Select(r => ToDto(r, emails)).ToList(), p, size, total);
    }

    /// <summary>Registra a interação com o prazo do Programa para o tipo.</summary>
    public async Task<RfInteractionDto> CreateAsync(RfInteractionInput input, CancellationToken ct)
    {
        if (input.Type == RfInteractionType.Contestacao)
            throw AppException.Validation("type", "Contestação é registrada a partir das ocorrências (indicador, remessas e fundamento).");
        var description = input.Description?.Trim() ?? string.Empty;
        var openedAt = input.OpenedAt ?? Now;
        var attachments = NormalizeAttachments(input.Attachments);
        var errors = new ValidationErrors()
            .AddIf(openedAt > Now.AddDays(1), "openedAt", "A data não pode estar no futuro.")
            .AddIf(description.Length > 4000, "description", "Máximo de 4.000 caracteres.")
            .AddIf(input.Reference is { Length: > 120 }, "reference", "Máximo de 120 caracteres.")
            .AddIf(input.OfficialCounterfeitPermyriad is < 0 or > 10000 || input.OfficialUndervaluationPermyriad is < 0 or > 10000 ||
                   input.OfficialDeclarationQualityPermyriad is < 0 or > 10000, "official", "Indicador entre 0% e 100%.");

        var interaction = new RfInteraction
        {
            Id = Guid.NewGuid(),
            Type = input.Type,
            Title = string.Empty,
            Description = description,
            Reference = input.Reference?.Trim(),
            OpenedAt = openedAt,
            Indicator = input.Indicator,
            Attachments = attachments,
            CreatedAt = Now,
            CreatedByUserId = currentUser.UserId,
        };
        switch (input.Type)
        {
            case RfInteractionType.ConsultaMensal:
                var year = input.Year ?? openedAt.Year;
                var month = input.Month ?? openedAt.Month;
                errors.AddIf(month is < 1 or > 12, "month", "Mês inválido.");
                if (await db.RfInteractions.AnyAsync(r => r.Type == RfInteractionType.ConsultaMensal && r.Year == year && r.Month == month, ct))
                    errors.Add("month", "A consulta deste mês já foi registrada.");
                interaction.Year = year;
                interaction.Month = month;
                interaction.Title = $"Consulta mensal dos indicadores — {month:00}/{year}";
                interaction.OfficialCounterfeitPermyriad = input.OfficialCounterfeitPermyriad;
                interaction.OfficialUndervaluationPermyriad = input.OfficialUndervaluationPermyriad;
                interaction.OfficialDeclarationQualityPermyriad = input.OfficialDeclarationQualityPermyriad;
                interaction.Status = RfInteractionStatus.Concluida;
                interaction.CompletedAt = Now;
                interaction.CompletedByUserId = currentUser.UserId;
                break;
            case RfInteractionType.PlanoDeAcao:
                errors.AddIf(input.Indicator is null, "indicator", "Informe o indicador do plano de ação.");
                interaction.Title = $"Plano de ação corretivo{(input.Indicator is { } ind ? $" — {ind}" : "")}";
                interaction.DueAt = openedAt.AddDays(ProgramDeadlines.ActionPlanDays);
                break;
            case RfInteractionType.NotificacaoCorretiva:
                errors.AddIf(description.Length < 10, "description", "Descreva as inconformidades apontadas na notificação.");
                interaction.Title = "Notificação para adotar medidas corretivas";
                interaction.DueAt = openedAt.AddDays(ProgramDeadlines.CorrectiveNotificationDays);
                break;
            case RfInteractionType.Ouvidoria:
                errors.AddIf(description.Length < 10, "description", "Resuma a reclamação recebida.");
                interaction.Title = "Reclamação da ouvidoria da Receita Federal";
                interaction.DueAt = input.DueAt ?? ProgramDeadlines.AddBusinessDays(openedAt, ProgramDeadlines.OmbudsmanBusinessDays);
                break;
            case RfInteractionType.ManifestacaoCiclo:
                var cycle = input.Year ?? ComplianceBands.CycleStartYear(openedAt.AddYears(-1));
                var (start, end) = ProgramDeadlines.AnnualManifestationWindow(openedAt.Year);
                errors.AddIf(openedAt < start || openedAt >= end, "openedAt", "A manifestação sobre o ciclo anual é apresentada de 1º a 31 de outubro (Programa 11.8).");
                interaction.Year = cycle;
                interaction.Title = $"Manifestação sobre o ciclo {cycle}/{cycle + 1}";
                interaction.DueAt = end.AddTicks(-1);
                break;
            case RfInteractionType.ComunicacaoDeFato:
                errors.AddIf(description.Length < 10, "description", "Descreva o fato comunicado à Receita.");
                interaction.Title = "Comunicação de fato que compromete o cumprimento do PRC";
                interaction.Status = RfInteractionStatus.Concluida;
                interaction.CompletedAt = Now;
                interaction.CompletedByUserId = currentUser.UserId;
                break;
            default:
                errors.AddIf(string.IsNullOrWhiteSpace(input.Title), "title", "Informe o assunto.");
                interaction.DueAt = input.DueAt;
                break;
        }
        if (!string.IsNullOrWhiteSpace(input.Title)) interaction.Title = input.Title.Trim();
        interaction.Title = interaction.Title.Length > 200 ? interaction.Title[..200] : interaction.Title;
        errors.ThrowIfAny();

        db.RfInteractions.Add(interaction);
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.rf.create", Target = interaction.Id.ToString(), OccurredAt = Now, Details = input.Type.ToString() });
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(interaction, ct);
    }

    /// <summary>Conclui (plano entregue, inconformidade saneada, resposta enviada). Contestação: acolhida anula as ocorrências.</summary>
    public async Task<RfInteractionDto> CompleteAsync(Guid id, RfInteractionCompleteRequest request, CancellationToken ct)
    {
        var interaction = await db.RfInteractions.FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw AppException.NotFound("Registro");
        if (interaction.Status == RfInteractionStatus.Concluida) throw AppException.Conflict("RF_DONE", "Este registro já foi concluído.");
        var response = request.Response?.Trim() ?? string.Empty;
        new ValidationErrors()
            .AddIf(response.Length < 5, "response", "Registre o que foi feito ou respondido.")
            .AddIf(response.Length > 4000, "response", "Máximo de 4.000 caracteres.")
            .AddIf(interaction.Type == RfInteractionType.Contestacao && request.ContestationAccepted is null, "contestationAccepted",
                "Informe se a Receita acolheu a contestação.")
            .ThrowIfAny();
        interaction.Response = response;
        interaction.Attachments = [.. interaction.Attachments, .. NormalizeAttachments(request.Attachments)];
        interaction.Status = RfInteractionStatus.Concluida;
        interaction.CompletedAt = Now;
        interaction.CompletedByUserId = currentUser.UserId;

        if (interaction.Type == RfInteractionType.Contestacao)
        {
            var accepted = request.ContestationAccepted == true;
            var occurrences = await db.ComplianceOccurrences.Where(o => interaction.OccurrenceIds.Contains(o.Id)).ToListAsync(ct);
            foreach (var o in occurrences)
            {
                o.Status = accepted ? OccurrenceStatus.Anulada : OccurrenceStatus.Confirmada;
                o.StatusReason = accepted ? $"Contestação acolhida pela Receita: {response}" : $"Contestação não acolhida: {response}";
                if (o.StatusReason.Length > 500) o.StatusReason = o.StatusReason[..500];
                o.StatusChangedAt = Now;
            }
        }
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.rf.complete", Target = interaction.Id.ToString(), OccurredAt = Now, Details = interaction.Type.ToString() });
        await db.SaveChangesAsync(ct);
        return await ToDtoAsync(interaction, ct);
    }

    /// <summary>
    /// Contesta um indicador: só por erro material, inconsistência sistêmica ou impropriedade na metodologia (11.6),
    /// indicando o indicador e as remessas, com fundamentação e evidências (11.7). As ocorrências continuam contando até a
    /// Receita decidir. Não salva quando <paramref name="save"/> é falso.
    /// </summary>
    public async Task<RfInteraction> ContestAsync(ContestationRequest request, CancellationToken ct, bool save = true)
    {
        var grounds = request.Grounds?.Trim() ?? string.Empty;
        var ids = (request.OccurrenceIds ?? []).Distinct().ToList();
        var evidence = NormalizeAttachments(request.Evidence);
        new ValidationErrors()
            .AddIf(ids.Count == 0, "occurrenceIds", "Escolha as remessas contestadas.")
            .AddIf(grounds.Length < 20, "grounds", "Fundamente a contestação (mínimo 20 caracteres).")
            .AddIf(grounds.Length > 2000, "grounds", "Máximo de 2.000 caracteres.")
            .ThrowIfAny();
        var occurrences = await db.ComplianceOccurrences.Where(o => ids.Contains(o.Id)).ToListAsync(ct);
        if (occurrences.Count != ids.Count) throw AppException.Validation("occurrenceIds", "Ocorrência não encontrada.");
        if (occurrences.Any(o => o.Indicator != request.Indicator))
            throw AppException.Validation("occurrenceIds", "Todas as remessas contestadas precisam ser do indicador escolhido.");
        if (occurrences.Any(o => o.Status != OccurrenceStatus.Confirmada))
            throw AppException.Validation("occurrenceIds", "Só ocorrências confirmadas podem ser contestadas.");

        var interaction = new RfInteraction
        {
            Id = Guid.NewGuid(),
            Type = RfInteractionType.Contestacao,
            Title = $"Contestação do indicador {request.Indicator} ({occurrences.Count} remessa(s))",
            Description = $"Fundamento: {ContestationReasonText(request.Reason)}.\n\n{grounds}",
            Reference = request.Reference?.Trim(),
            OpenedAt = Now,
            Indicator = request.Indicator,
            ContestationReason = request.Reason,
            OccurrenceIds = ids,
            Attachments = evidence,
            CreatedAt = Now,
            CreatedByUserId = currentUser.UserId,
        };
        db.RfInteractions.Add(interaction);
        foreach (var o in occurrences)
        {
            o.Status = OccurrenceStatus.Contestada;
            o.ContestationReason = request.Reason;
            o.ContestationGrounds = grounds;
            o.ContestationEvidence = evidence;
            o.ContestedAt = Now;
            o.RfInteractionId = interaction.Id;
            o.StatusReason = $"Contestada por {ContestationReasonText(request.Reason)}.";
            o.StatusChangedAt = Now;
        }
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.rf.contest", Target = interaction.Id.ToString(), OccurredAt = Now, Details = $"{request.Indicator}/{request.Reason}/{ids.Count}" });
        if (save) await db.SaveChangesAsync(ct);
        return interaction;
    }

    public async Task<RfInteractionDto> ContestAndSaveAsync(ContestationRequest request, CancellationToken ct) =>
        await ToDtoAsync(await ContestAsync(request, ct), ct);

    private static List<string> NormalizeAttachments(IReadOnlyList<string>? values)
    {
        var list = (values ?? []).Select(DocumentLinks.Normalize).Where(v => v is not null).Select(v => v!).Distinct().ToList();
        if (list.Count > 20) throw AppException.Validation("attachments", "Máximo de 20 anexos.");
        if (list.Any(v => !DocumentLinks.IsValidReference(v))) throw AppException.Validation("attachments", "Anexo inválido.");
        return list;
    }
}
