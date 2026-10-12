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
/// Política de Admissão e de Monitoramento de Vendedores: comunicações formais com prazo (4.6, 6.2, 8.4 a 8.6, 10.3),
/// infrações e reincidência (1.1 d, 7.2, 8.3), medidas graduadas (8.1 e 8.2), aceite da Política (2.2), confirmação anual
/// dos dados (4.3), recusa de recadastro de loja excluída (3.5) e o registro das ações e resultados (Programa 8.9).
/// </summary>
public sealed class SellerGovernanceService(
    IAppDbContext db,
    PlatformSettingsProvider settingsProvider,
    ICatalogCache catalogCache,
    DocumentLinks links,
    ICurrentUser currentUser,
    TimeProvider clock,
    ILogger<SellerGovernanceService> logger)
{
    /// <summary>Itens que a equipe confere antes de liberar a loja (Política 3.3). Aprovar exige todos.</summary>
    public static readonly IReadOnlyList<string> VerificationItems =
    [
        "dados-cadastrais", "ruc", "constancia-ruc", "certificado-tributario", "atos-constitutivos",
        "documento-representante", "meio-de-pagamento", "endereco-origem", "aceite-politica",
    ];

    public const string CodeDataNotUpdated = "DADOS_CADASTRAIS";

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    // =================================================================================================================
    // Registro das ações e resultados (Programa 8.9; Política 6.8)
    // =================================================================================================================

    /// <summary>Registra a ação (não salva). Sem usuário na requisição, a ação é do sistema.</summary>
    public void LogAction(EnforcementActionKind kind, string reason, string result, Guid? sellerId = null, Guid? productId = null,
        Guid? reportId = null, Guid? measureId = null, Guid? noticeId = null, Guid? alertId = null, bool automatic = false)
    {
        var system = automatic || currentUser.UserId is null;
        db.EnforcementActions.Add(new EnforcementAction
        {
            Kind = kind,
            OccurredAt = Now,
            ActorUserId = system ? null : currentUser.UserId,
            Automatic = system,
            SellerId = sellerId,
            ProductId = productId,
            ReportId = reportId,
            MeasureId = measureId,
            NoticeId = noticeId,
            AlertId = alertId,
            Reason = Cut(reason, 1000),
            Result = Cut(result, 1000),
        });
    }

    public async Task<PagedResult<EnforcementActionDto>> ListActionsAsync(EnforcementActionKind? kind, Guid? sellerId, int? page, int? pageSize, CancellationToken ct)
    {
        var source = db.EnforcementActions.AsNoTracking();
        if (kind is { } k) source = source.Where(a => a.Kind == k);
        if (sellerId is { } sid) source = source.Where(a => a.SellerId == sid);
        var (p, size) = Pagination.Normalize(page, pageSize, 30);
        var total = await source.CountAsync(ct);
        var rows = await (from a in source.OrderByDescending(a => a.OccurredAt).ThenByDescending(a => a.Id).Skip((p - 1) * size).Take(size)
                          join u in db.Users on a.ActorUserId equals u.Id into users
                          from u in users.DefaultIfEmpty()
                          join s in db.Sellers on a.SellerId equals s.Id into sellers
                          from s in sellers.DefaultIfEmpty()
                          join pr in db.Products on a.ProductId equals pr.Id into products
                          from pr in products.DefaultIfEmpty()
                          select new EnforcementActionDto(a.Id, a.Kind, a.OccurredAt, a.Automatic, u == null ? null : u.Email, a.SellerId,
                              s == null ? null : s.Name, a.ProductId, pr == null ? null : pr.Name, a.ReportId, a.Reason, a.Result))
            .ToListAsync(ct);
        return new PagedResult<EnforcementActionDto>(rows, p, size, total);
    }

    // =================================================================================================================
    // Comunicações ao vendedor
    // =================================================================================================================

    /// <summary>
    /// Cria a comunicação (não salva). O e-mail sai pelo <c>NoticeMailerJob</c> depois de gravada (sem perder aviso se a
    /// transação falhar).
    /// </summary>
    public SellerNotice Notify(Guid sellerId, SellerNoticeType type, string title, string message, DateTime? dueAt = null,
        Guid? productId = null, Guid? orderId = null, Guid? measureId = null, Guid? infractionId = null, Guid? auditId = null,
        DocumentRequestKind? documentKind = null)
    {
        var notice = new SellerNotice
        {
            Id = Guid.NewGuid(),
            SellerId = sellerId,
            Type = type,
            DocumentKind = documentKind,
            Title = Cut(title, 200),
            Message = Cut(message, 4000),
            ProductId = productId,
            OrderId = orderId,
            MeasureId = measureId,
            InfractionId = infractionId,
            AuditId = auditId,
            CreatedAt = Now,
            CreatedByUserId = currentUser.UserId,
            DueAt = dueAt,
        };
        db.SellerNotices.Add(notice);
        return notice;
    }

    private IQueryable<SellerNoticeDto> NoticesQuery(IQueryable<SellerNotice> source, DateTime now) =>
        from n in source
        join s in db.Sellers on n.SellerId equals s.Id
        join p in db.Products on n.ProductId equals p.Id into products
        from p in products.DefaultIfEmpty()
        join o in db.Orders on n.OrderId equals o.Id into orders
        from o in orders.DefaultIfEmpty()
        select new SellerNoticeDto(n.Id, n.SellerId, s.Name, n.Type, n.Status, n.DocumentKind, n.Title, n.Message,
            n.ProductId, p == null ? null : p.Name, p == null ? null : p.Slug, n.OrderId, o == null ? null : o.Number, n.MeasureId,
            n.CreatedAt, n.DueAt, n.Status == SellerNoticeStatus.Aberta && n.DueAt != null && n.DueAt < now, n.ReadAt,
            n.ResponseText, new List<DocumentRefDto>(), n.RespondedAt, n.Resolution, n.ResolvedAt);

    /// <summary>Os arquivos da resposta viram links assinados depois da consulta (fora do SQL).</summary>
    private async Task<List<SellerNoticeDto>> MaterializeAsync(IQueryable<SellerNotice> source, CancellationToken ct)
    {
        var rows = await NoticesQuery(source, Now).ToListAsync(ct);
        if (rows.Count == 0) return rows;
        var ids = rows.Select(r => r.Id).ToList();
        var files = await db.SellerNotices.AsNoTracking().Where(n => ids.Contains(n.Id)).Select(n => new { n.Id, n.ResponseFiles }).ToListAsync(ct);
        var map = files.ToDictionary(f => f.Id, f => f.ResponseFiles);
        return rows.Select(r => r with { ResponseFiles = links.Refs(map.GetValueOrDefault(r.Id) ?? []) }).ToList();
    }

    public async Task<PagedResult<SellerNoticeDto>> ListNoticesAsync(Guid? sellerId, SellerNoticeStatus? status, SellerNoticeType? type, int? page, int? pageSize, CancellationToken ct)
    {
        var source = db.SellerNotices.AsNoTracking();
        if (sellerId is { } sid) source = source.Where(n => n.SellerId == sid);
        if (status is { } st) source = source.Where(n => n.Status == st);
        if (type is { } t) source = source.Where(n => n.Type == t);
        var (p, size) = Pagination.Normalize(page, pageSize, 20);
        var total = await source.CountAsync(ct);
        var items = await MaterializeAsync(source.OrderByDescending(n => n.CreatedAt).Skip((p - 1) * size).Take(size), ct);
        return new PagedResult<SellerNoticeDto>(items, p, size, total);
    }

    public async Task<SellerNoticeDto> GetNoticeAsync(Guid id, Guid? sellerId, bool markRead, CancellationToken ct)
    {
        var notice = await db.SellerNotices.FirstOrDefaultAsync(n => n.Id == id && (sellerId == null || n.SellerId == sellerId), ct)
                     ?? throw AppException.NotFound("Comunicação");
        if (markRead && notice.ReadAt is null)
        {
            notice.ReadAt = Now;
            await db.SaveChangesAsync(ct);
        }
        return (await MaterializeAsync(db.SellerNotices.AsNoTracking().Where(n => n.Id == id), ct)).First();
    }

    /// <summary>Resposta do vendedor, com documentos (Política 4.6, 6.2, 8.6).</summary>
    public async Task<SellerNoticeDto> RespondAsync(Guid id, Guid sellerId, SellerNoticeResponseRequest request, CancellationToken ct)
    {
        var notice = await db.SellerNotices.FirstOrDefaultAsync(n => n.Id == id && n.SellerId == sellerId, ct) ?? throw AppException.NotFound("Comunicação");
        if (notice.Status == SellerNoticeStatus.Encerrada)
            throw AppException.Conflict("NOTICE_CLOSED", "Esta comunicação já foi encerrada pela equipe.");
        if (notice.Type is SellerNoticeType.Aviso or SellerNoticeType.AlteracaoPolitica)
            throw AppException.Conflict("NOTICE_NO_RESPONSE", "Esta comunicação não pede resposta.");
        var text = request.Text?.Trim() ?? string.Empty;
        var files = (request.Files ?? []).Select(DocumentLinks.Normalize).Where(f => f is not null).Select(f => f!).Distinct().ToList();
        new ValidationErrors()
            .AddIf(text.Length < 10, "text", "Explique a resposta em pelo menos 10 caracteres.")
            .AddIf(text.Length > 4000, "text", "Máximo de 4.000 caracteres.")
            .AddIf(files.Count > 10, "files", "Máximo de 10 arquivos.")
            .AddIf(files.Any(f => !DocumentLinks.IsValidReference(f)), "files", "Arquivo inválido.")
            .AddIf(notice.Type == SellerNoticeType.SolicitacaoDocumentos && files.Count == 0, "files", "Envie os documentos pedidos.")
            .ThrowIfAny();
        notice.ResponseText = text;
        notice.ResponseFiles = files;
        notice.RespondedAt = Now;
        notice.RespondedByUserId = currentUser.UserId;
        // Política 8.4: o pedido de correção só se encerra com os dados corrigidos ou confirmados no cadastro
        // (MarkDataConfirmedAsync); a resposta escrita fica registrada, mas não para o prazo de 10 dias.
        if (notice.Type != SellerNoticeType.AtualizacaoCadastral) notice.Status = SellerNoticeStatus.Respondida;
        notice.ReadAt ??= Now;
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "seller.notice.respond", Target = notice.Id.ToString(), OccurredAt = Now, IpAddress = currentUser.IpAddress });
        await db.SaveChangesAsync(ct);
        return await GetNoticeAsync(id, sellerId, markRead: false, ct);
    }

    /// <summary>Admin: pedido de documentos (autenticidade, valor, registros), correção de dados ou aviso.</summary>
    public async Task<SellerNoticeDto> CreateNoticeAsync(Guid sellerId, SellerNoticeCreateRequest request, CancellationToken ct)
    {
        var seller = await db.Sellers.FirstOrDefaultAsync(s => s.Id == sellerId, ct) ?? throw AppException.NotFound("Loja");
        var message = request.Message?.Trim() ?? string.Empty;
        new ValidationErrors()
            .AddIf(request.Type is SellerNoticeType.Medida or SellerNoticeType.AlteracaoPolitica, "type", "Medidas e mudanças da Política têm fluxo próprio.")
            .AddIf(message.Length < 10, "message", "Escreva a comunicação (mínimo 10 caracteres).")
            .AddIf(request.Type == SellerNoticeType.SolicitacaoDocumentos && request.DocumentKind is null, "documentKind", "Escolha o que os documentos devem comprovar.")
            .ThrowIfAny();

        Product? product = null;
        if (request.ProductId is { } pid)
            product = await db.Products.FirstOrDefaultAsync(p => p.Id == pid && p.SellerId == sellerId, ct)
                      ?? throw AppException.Validation("productId", "Produto não encontrado nesta loja.");
        Order? order = null;
        if (!string.IsNullOrWhiteSpace(request.OrderNumber))
        {
            var number = request.OrderNumber.Trim().ToUpperInvariant();
            order = await db.Orders.FirstOrDefaultAsync(o => o.Number == number && o.SellerId == sellerId, ct)
                    ?? throw AppException.Validation("orderNumber", "Pedido não encontrado nesta loja.");
        }
        if (request.DocumentKind == DocumentRequestKind.Autenticidade && product is null)
            throw AppException.Validation("productId", "Escolha o produto cuja autenticidade deve ser comprovada.");

        var title = string.IsNullOrWhiteSpace(request.Title) ? DefaultTitle(request.Type, request.DocumentKind) : request.Title.Trim();
        var due = request.Type == SellerNoticeType.Aviso ? (DateTime?)null : Now.AddDays(ProgramDeadlines.SellerResponseDays);
        var notice = Notify(seller.Id, request.Type, title, message, due, product?.Id, order?.Id, documentKind: request.DocumentKind);

        // Indício de contrafação: o anúncio sai da vitrine até a comprovação (Programa 8.4; Política 6.2).
        if (request.DocumentKind == DocumentRequestKind.Autenticidade && product is { Status: ProductStatus.Ativo })
        {
            product.Status = ProductStatus.EmAnalise;
            product.ModerationReason = ComplianceService.ReasonAuthenticity;
            product.ModerationNote = "Aguardando documentos que comprovem a autenticidade.";
            product.ModeratedAt = Now;
            product.UpdatedAt = Now;
        }
        if (request.DocumentKind == DocumentRequestKind.Autenticidade)
            LogAction(EnforcementActionKind.AutenticidadeSolicitada, message,
                product?.Status == ProductStatus.EmAnalise ? "Anúncio fora da vitrine até a comprovação; prazo de 10 dias." : "Prazo de 10 dias para comprovar.",
                seller.Id, product?.Id, noticeId: notice.Id);
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.seller.notice", Target = seller.Slug, OccurredAt = Now, Details = $"{request.Type}/{request.DocumentKind}" });
        await db.SaveChangesAsync(ct);
        if (product is not null) await catalogCache.InvalidateAsync(ct);
        return await GetNoticeAsync(notice.Id, null, markRead: false, ct);
    }

    private static string DefaultTitle(SellerNoticeType type, DocumentRequestKind? kind) => (type, kind) switch
    {
        (SellerNoticeType.SolicitacaoDocumentos, DocumentRequestKind.Autenticidade) => "Comprove a autenticidade do produto",
        (SellerNoticeType.SolicitacaoDocumentos, DocumentRequestKind.ValorDaOperacao) => "Envie os documentos do valor da operação",
        (SellerNoticeType.SolicitacaoDocumentos, DocumentRequestKind.Registros) => "Envie os registros das suas operações",
        (SellerNoticeType.AtualizacaoCadastral, _) => "Corrija os dados cadastrais da loja",
        _ => "Comunicado da plataforma",
    };

    /// <summary>Admin: aceita ou recusa a resposta e encerra. Autenticidade aceita devolve o anúncio à vitrine.</summary>
    public async Task<SellerNoticeDto> ResolveNoticeAsync(Guid id, SellerNoticeResolveRequest request, CancellationToken ct)
    {
        var notice = await db.SellerNotices.FirstOrDefaultAsync(n => n.Id == id, ct) ?? throw AppException.NotFound("Comunicação");
        if (notice.Status == SellerNoticeStatus.Encerrada) throw AppException.Conflict("NOTICE_CLOSED", "Comunicação já encerrada.");
        var resolution = request.Resolution?.Trim();
        if (resolution is null || resolution.Length < 5) throw AppException.Validation("resolution", "Registre a conclusão (o vendedor vê este texto).");
        notice.Status = SellerNoticeStatus.Encerrada;
        notice.Resolution = Cut(resolution, 1000);
        notice.ResolvedAt = Now;
        notice.ResolvedByUserId = currentUser.UserId;

        if (notice.DocumentKind == DocumentRequestKind.Autenticidade && notice.ProductId is { } productId)
        {
            var product = await db.Products.FirstAsync(p => p.Id == productId, ct);
            if (request.Accepted)
            {
                if (product is { Status: ProductStatus.EmAnalise, ModerationReason: ComplianceService.ReasonAuthenticity })
                {
                    product.Status = ProductStatus.Ativo;
                    product.ModerationReason = null;
                    product.ModerationNote = null;
                    product.ApprovedName = product.Name;
                    product.ApprovedPriceAmount = product.PriceAmount;
                    product.ApprovedFingerprint = product.ListingFingerprint();
                }
                LogAction(EnforcementActionKind.AutenticidadeComprovada, resolution, "Documentos aceitos; anúncio liberado.", notice.SellerId, productId, noticeId: notice.Id);
            }
            else
            {
                product.Status = ProductStatus.Bloqueado;
                product.ModerationReason = ComplianceService.ReasonCounterfeit;
                product.ModerationNote = Cut($"Autenticidade não comprovada: {resolution}", 500);
                LogAction(EnforcementActionKind.AutenticidadeNaoComprovada, resolution, "Anúncio removido (Política 6.3).", notice.SellerId, productId, noticeId: notice.Id);
            }
            product.ModeratedAt = Now;
            product.UpdatedAt = Now;
        }

        // Correção cadastral recusada (Política 8.4): o prazo continua contado da solicitação original. Vencido, a loja é
        // suspensa; senão, o pedido volta aberto com o mesmo prazo.
        if (notice.Type == SellerNoticeType.AtualizacaoCadastral && !request.Accepted)
        {
            var due = notice.DueAt ?? notice.CreatedAt.AddDays(ProgramDeadlines.SellerResponseDays);
            var seller = await db.Sellers.FirstAsync(s => s.Id == notice.SellerId, ct);
            if (due <= Now)
            {
                if (seller.Status == SellerStatus.Aprovado) await SuspendForDataNotUpdatedAsync(seller.Id, Now, ct);
                notice.Resolution = Cut($"{resolution}\n\nPrazo de 10 dias vencido sem a correção: loja suspensa (Política 8.4).", 1000);
            }
            else
            {
                Notify(seller.Id, SellerNoticeType.AtualizacaoCadastral, notice.Title,
                    $"A correção enviada não foi aceita. Motivo: {resolution}\n\n{notice.Message}\n\nO prazo continua o da solicitação original: " +
                    $"{due:dd/MM/yyyy HH:mm} (UTC). Sem a correção, a loja é suspensa (Política de Vendedores, item 8.4).",
                    due);
            }
        }
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.seller.notice.resolve", Target = notice.Id.ToString(), OccurredAt = Now, Details = request.Accepted ? "aceita" : "recusada" });
        await db.SaveChangesAsync(ct);
        await catalogCache.InvalidateAsync(ct);
        return await GetNoticeAsync(id, null, markRead: false, ct);
    }

    // =================================================================================================================
    // Infrações, reincidência e medidas
    // =================================================================================================================

    public async Task<int> CountInfractionsAsync(Guid sellerId, DateTime since, CancellationToken ct) =>
        await db.SellerInfractions.CountAsync(i => i.SellerId == sellerId && i.OccurredAt >= since, ct);

    /// <summary>Registra a infração (não salva) e marca a reincidência: outra infração nos 12 meses anteriores (8.3).</summary>
    public async Task<SellerInfraction> AddInfractionAsync(Guid sellerId, string code, string description, InfractionSeverity severity,
        bool intentional, DateTime occurredAt, Guid? productId = null, Guid? orderId = null, Guid? occurrenceId = null,
        Guid? reportId = null, Guid? alertId = null, CancellationToken ct = default)
    {
        var since = occurredAt.AddMonths(-ProgramDeadlines.RecidivismMonths);
        var recidivist = await db.SellerInfractions.AnyAsync(i => i.SellerId == sellerId && i.OccurredAt >= since && i.OccurredAt <= occurredAt, ct)
                         || db.SellerInfractions.Local.Any(i => i.SellerId == sellerId && i.OccurredAt >= since && i.OccurredAt <= occurredAt);
        var infraction = new SellerInfraction
        {
            Id = Guid.NewGuid(),
            SellerId = sellerId,
            Code = Cut(code.Trim().ToUpperInvariant().Replace(' ', '_'), 40),
            Description = Cut(description, 1000),
            Severity = severity,
            Intentional = intentional,
            ProductId = productId,
            OrderId = orderId,
            OccurrenceId = occurrenceId,
            ReportId = reportId,
            AlertId = alertId,
            OccurredAt = occurredAt,
            RegisteredAt = Now,
            RegisteredByUserId = currentUser.UserId,
            Recidivist = recidivist,
        };
        db.SellerInfractions.Add(infraction);
        LogAction(EnforcementActionKind.InfracaoRegistrada, $"{infraction.Code}: {description}",
            recidivist ? "Infração registrada; vendedor reincidente (Política 8.3)." : "Infração registrada.", sellerId, productId, reportId, alertId: alertId);
        return infraction;
    }

    public async Task<MeasureRecommendationDto> RecommendAsync(Guid sellerId, InfractionSeverity severity, bool intentional, bool hasProduct, DateTime at, Guid? excludeInfractionId, CancellationToken ct)
    {
        var since = at.AddMonths(-ProgramDeadlines.RecidivismMonths);
        var prior = await db.SellerInfractions.CountAsync(i => i.SellerId == sellerId && i.OccurredAt >= since && i.Id != excludeInfractionId, ct);
        var (type, days) = MeasureGuide.Recommend(severity, prior, intentional, hasProduct);
        var rationale = $"Gravidade {severity.ToString().ToLowerInvariant()}, {prior} infração(ões) nos 12 meses anteriores" +
                        (intentional ? ", com intenção" : string.Empty) + ".";
        return new MeasureRecommendationDto(type, days, prior, prior > 0, rationale);
    }

    /// <summary>Admin: registra a infração e devolve a medida sugerida (8.2).</summary>
    public async Task<SellerInfractionResultDto> RegisterInfractionAsync(Guid sellerId, SellerInfractionInput input, CancellationToken ct)
    {
        var seller = await db.Sellers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sellerId, ct) ?? throw AppException.NotFound("Loja");
        var code = (input.Code ?? string.Empty).Trim();
        var description = input.Description?.Trim() ?? string.Empty;
        new ValidationErrors()
            .AddIf(code.Length is < 3 or > 40, "code", "Informe o tipo da infração (ex.: CONTRAFACAO).")
            .AddIf(description.Length < 10, "description", "Descreva a infração (mínimo 10 caracteres).")
            .AddIf(input.OccurredAt > Now.AddDays(1), "occurredAt", "A data não pode estar no futuro.")
            .ThrowIfAny();
        if (input.ProductId is { } pid && !await db.Products.AnyAsync(p => p.Id == pid && p.SellerId == sellerId, ct))
            throw AppException.Validation("productId", "Produto não encontrado nesta loja.");
        Guid? orderId = null;
        if (!string.IsNullOrWhiteSpace(input.OrderNumber))
        {
            var number = input.OrderNumber.Trim().ToUpperInvariant();
            orderId = await db.Orders.Where(o => o.Number == number && o.SellerId == sellerId).Select(o => (Guid?)o.Id).FirstOrDefaultAsync(ct)
                      ?? throw AppException.Validation("orderNumber", "Pedido não encontrado nesta loja.");
        }
        var occurredAt = input.OccurredAt ?? Now;
        var infraction = await AddInfractionAsync(sellerId, code, description, input.Severity, input.Intentional, occurredAt, input.ProductId, orderId, ct: ct);
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.seller.infraction", Target = seller.Slug, OccurredAt = Now, Details = infraction.Code });
        await db.SaveChangesAsync(ct);
        var recommendation = await RecommendAsync(sellerId, input.Severity, input.Intentional, input.ProductId is not null, occurredAt, infraction.Id, ct);
        return new SellerInfractionResultDto((await InfractionsAsync(sellerId, ct)).First(i => i.Id == infraction.Id), recommendation);
    }

    private async Task<List<SellerInfractionDto>> InfractionsAsync(Guid sellerId, CancellationToken ct) =>
        await (from i in db.SellerInfractions.AsNoTracking().Where(i => i.SellerId == sellerId)
               join p in db.Products on i.ProductId equals p.Id into products
               from p in products.DefaultIfEmpty()
               join o in db.Orders on i.OrderId equals o.Id into orders
               from o in orders.DefaultIfEmpty()
               orderby i.OccurredAt descending
               select new SellerInfractionDto(i.Id, i.Code, i.Description, i.Severity, i.Intentional, i.ProductId, p == null ? null : p.Name,
                   o == null ? null : o.Number, i.OccurredAt, i.RegisteredAt, i.Recidivist))
            .ToListAsync(ct);

    private static bool IsActive(SellerMeasure m, DateTime now) =>
        m.RevokedAt is null && (m.Type == SellerMeasureType.RemocaoAnuncio || m.EndsAt is null || m.EndsAt > now);

    private SellerMeasureDto ToDto(SellerMeasure m, string? productName) =>
        new(m.Id, m.Type, m.Reason, m.InfractionId, m.ProductId, productName, m.AppliedAt, m.Automatic, m.EndsAt, m.RevokedAt,
            m.RevocationReason, IsActive(m, Now), m.NoticeId);

    private async Task<List<SellerMeasureDto>> MeasuresAsync(Guid sellerId, CancellationToken ct)
    {
        var rows = await (from m in db.SellerMeasures.AsNoTracking().Where(m => m.SellerId == sellerId)
                          join p in db.Products on m.ProductId equals p.Id into products
                          from p in products.DefaultIfEmpty()
                          orderby m.AppliedAt descending
                          select new { Measure = m, ProductName = p == null ? null : p.Name })
            .ToListAsync(ct);
        return rows.Select(r => ToDto(r.Measure, r.ProductName)).ToList();
    }

    /// <summary>
    /// Aplica a medida (8.1), comunica o motivo ao vendedor com prazo de resposta de 10 dias (8.5 e 8.6) e registra a ação.
    /// Não salva quando <paramref name="save"/> é falso (uso interno numa transação maior).
    /// </summary>
    public async Task<SellerMeasure> ApplyMeasureAsync(Guid sellerId, SellerMeasureInput input, bool automatic, CancellationToken ct, bool save = true,
        string? moderationReason = null)
    {
        var seller = await db.Sellers.FirstOrDefaultAsync(s => s.Id == sellerId, ct) ?? throw AppException.NotFound("Loja");
        var reason = input.Reason?.Trim() ?? string.Empty;
        new ValidationErrors()
            .AddIf(reason.Length < 10, "reason", "Explique o motivo da medida (o vendedor recebe este texto).")
            .AddIf(input.Type == SellerMeasureType.RemocaoAnuncio && input.ProductId is null, "productId", "Escolha o anúncio a remover.")
            .AddIf(input.SuspensionDays is < 1 or > 365, "suspensionDays", "Suspensão entre 1 e 365 dias (vazio = até a revisão da equipe).")
            .AddIf(seller.Status == SellerStatus.Excluido && input.Type != SellerMeasureType.RemocaoAnuncio, "type", "A loja já foi excluída.")
            .ThrowIfAny();
        // A infração pode ter sido registrada nesta mesma operação (ainda não gravada).
        if (input.InfractionId is { } infractionId
            && !db.SellerInfractions.Local.Any(i => i.Id == infractionId && i.SellerId == sellerId)
            && !await db.SellerInfractions.AnyAsync(i => i.Id == infractionId && i.SellerId == sellerId, ct))
            throw AppException.Validation("infractionId", "Infração não encontrada nesta loja.");

        var measure = new SellerMeasure
        {
            Id = Guid.NewGuid(),
            SellerId = sellerId,
            Type = input.Type,
            Reason = Cut(reason, 1000),
            InfractionId = input.InfractionId,
            ProductId = input.ProductId,
            AppliedAt = Now,
            AppliedByUserId = automatic ? null : currentUser.UserId,
            Automatic = automatic,
        };
        string result, what;
        switch (input.Type)
        {
            case SellerMeasureType.RemocaoAnuncio:
                var product = await db.Products.FirstOrDefaultAsync(p => p.Id == input.ProductId && p.SellerId == sellerId, ct)
                              ?? throw AppException.Validation("productId", "Produto não encontrado nesta loja.");
                product.Status = ProductStatus.Bloqueado;
                product.ModerationReason = Cut(moderationReason ?? ComplianceService.ReasonMeasure, 64);
                product.ModerationNote = Cut(reason, 500);
                product.ModeratedAt = Now;
                product.UpdatedAt = Now;
                what = $"Remoção do anúncio \"{product.Name}\"";
                result = "Anúncio retirado da vitrine; o vendedor não pode reativá-lo.";
                break;
            case SellerMeasureType.SuspensaoTemporaria:
                measure.EndsAt = input.SuspensionDays is { } days ? Now.AddDays(days) : null;
                seller.Status = SellerStatus.Suspenso;
                seller.SuspendedAt = Now;
                seller.SuspendedUntil = measure.EndsAt;
                seller.SuspensionReason = Cut(reason, 500);
                what = measure.EndsAt is { } end
                    ? $"Suspensão temporária até {end:dd/MM/yyyy}"
                    : "Suspensão temporária até a revisão da equipe";
                result = "Loja fora da vitrine durante a suspensão.";
                break;
            default:
                seller.Status = SellerStatus.Excluido;
                seller.ExcludedAt = Now;
                seller.SuspendedAt ??= Now;
                seller.SuspendedUntil = null;
                seller.SuspensionReason = Cut(reason, 500);
                what = "Suspensão permanente, com exclusão da plataforma";
                result = "Loja excluída; novo cadastro com os mesmos dados ou documentos será recusado (Política 3.5).";
                break;
        }
        db.SellerMeasures.Add(measure);
        var notice = Notify(sellerId, SellerNoticeType.Medida, what,
            $"{what}.\n\nMotivo: {reason}\n\nVocê pode responder em até {ProgramDeadlines.SellerResponseDays} dias, com os documentos que tiver " +
            "(Política de Vendedores, item 8.6). A resposta é analisada pela equipe.",
            Now.AddDays(ProgramDeadlines.SellerResponseDays), input.ProductId, measureId: measure.Id, infractionId: input.InfractionId);
        measure.NoticeId = notice.Id;
        LogAction(EnforcementActionKind.MedidaAplicada, $"{what}: {reason}", result, sellerId, input.ProductId, measureId: measure.Id,
            noticeId: notice.Id, automatic: automatic);
        db.AuditLogs.Add(new AuditLog { UserId = automatic ? null : currentUser.UserId, Action = $"compliance.measure.{input.Type}", Target = seller.Slug, OccurredAt = Now, Details = Cut(reason, 500) });
        if (save)
        {
            await db.SaveChangesAsync(ct);
            await catalogCache.InvalidateAsync(ct);
        }
        logger.LogWarning("Medida {Type} aplicada à loja {Seller} ({Automatic})", input.Type, seller.Slug, automatic ? "automática" : "manual");
        return measure;
    }

    public async Task<SellerMeasureDto> ApplyMeasureAsync(Guid sellerId, SellerMeasureInput input, CancellationToken ct)
    {
        var measure = await ApplyMeasureAsync(sellerId, input, automatic: false, ct);
        return (await MeasuresAsync(sellerId, ct)).First(m => m.Id == measure.Id);
    }

    /// <summary>Revoga a medida (resposta do vendedor acolhida, suspensão vencida ou dados corrigidos). Não salva.</summary>
    private async Task RevokeAsync(SellerMeasure measure, string reason, bool automatic, CancellationToken ct)
    {
        measure.RevokedAt = Now;
        measure.RevocationReason = Cut(reason, 500);
        measure.RevokedByUserId = automatic ? null : currentUser.UserId;
        var seller = await db.Sellers.FirstAsync(s => s.Id == measure.SellerId, ct);
        if (measure.Type == SellerMeasureType.RemocaoAnuncio && measure.ProductId is { } productId)
        {
            var product = await db.Products.FirstAsync(p => p.Id == productId, ct);
            if (product.Status == ProductStatus.Bloqueado && Ncm.ProhibitionReason(product.HsCode ?? string.Empty) is null)
            {
                // Volta para análise: a equipe confere de novo antes da vitrine.
                product.Status = ProductStatus.EmAnalise;
                product.ModerationReason = "REVISAO";
                product.ModerationNote = Cut($"Medida revogada: {reason}", 500);
                product.UpdatedAt = Now;
            }
        }
        else
        {
            var others = await db.SellerMeasures.Where(m => m.SellerId == seller.Id && m.Id != measure.Id && m.RevokedAt == null &&
                                                            m.Type != SellerMeasureType.RemocaoAnuncio).ToListAsync(ct);
            var stillActive = others.Any(m => IsActive(m, Now));
            if (!stillActive && seller.Status is SellerStatus.Suspenso or SellerStatus.Excluido)
            {
                seller.Status = seller.VerifiedAt is null ? SellerStatus.Pendente : SellerStatus.Aprovado;
                seller.SuspendedAt = null;
                seller.SuspendedUntil = null;
                seller.ExcludedAt = null;
                seller.SuspensionReason = null;
            }
        }
        Notify(seller.Id, SellerNoticeType.Aviso, "Medida revogada", $"A medida \"{measure.Reason}\" foi revogada. Motivo: {reason}", measureId: measure.Id);
        LogAction(EnforcementActionKind.MedidaRevogada, reason, measure.Type == SellerMeasureType.RemocaoAnuncio
            ? "Anúncio volta para análise da equipe." : "Loja liberada.", seller.Id, measure.ProductId, measureId: measure.Id, automatic: automatic);
    }

    /// <summary>Suspensão ou exclusão em vigor (medida da Política, não a recusa do cadastro).</summary>
    public async Task<bool> HasActiveSuspensionAsync(Guid sellerId, CancellationToken ct)
    {
        var measures = await db.SellerMeasures.AsNoTracking()
            .Where(m => m.SellerId == sellerId && m.RevokedAt == null && m.Type != SellerMeasureType.RemocaoAnuncio).ToListAsync(ct);
        return measures.Any(m => IsActive(m, Now));
    }

    /// <summary>Revoga as suspensões e a exclusão em vigor (o admin liberou a loja). Não salva. Devolve se havia alguma.</summary>
    public async Task<bool> RevokeActiveSuspensionsAsync(Guid sellerId, string reason, CancellationToken ct)
    {
        var measures = await db.SellerMeasures.Where(m => m.SellerId == sellerId && m.RevokedAt == null && m.Type != SellerMeasureType.RemocaoAnuncio)
            .ToListAsync(ct);
        var active = measures.Where(m => IsActive(m, Now)).ToList();
        foreach (var measure in active) await RevokeAsync(measure, reason, automatic: false, ct);
        return active.Count > 0;
    }

    public async Task<SellerMeasureDto> RevokeMeasureAsync(Guid sellerId, Guid measureId, RevokeMeasureRequest request, CancellationToken ct)
    {
        var measure = await db.SellerMeasures.FirstOrDefaultAsync(m => m.Id == measureId && m.SellerId == sellerId, ct) ?? throw AppException.NotFound("Medida");
        if (measure.RevokedAt is not null) throw AppException.Conflict("MEASURE_REVOKED", "A medida já foi revogada.");
        var reason = request.Reason?.Trim();
        if (reason is null || reason.Length < 5) throw AppException.Validation("reason", "Explique por que a medida foi revogada.");
        await RevokeAsync(measure, reason, automatic: false, ct);
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.seller.measure.revoke", Target = measure.Id.ToString(), OccurredAt = Now, Details = reason });
        await db.SaveChangesAsync(ct);
        await catalogCache.InvalidateAsync(ct);
        return (await MeasuresAsync(sellerId, ct)).First(m => m.Id == measureId);
    }

    // =================================================================================================================
    // Aceite da Política (2.2 e 10.3) e confirmação dos dados (4.3 e 8.4)
    // =================================================================================================================

    /// <summary>Registra o aceite do representante legal (não salva).</summary>
    public void RecordAcceptance(Seller seller, Guid userId, string representativeName, string version)
    {
        db.SellerPolicyAcceptances.Add(new SellerPolicyAcceptance
        {
            Id = Guid.NewGuid(),
            SellerId = seller.Id,
            UserId = userId,
            PolicyVersion = version,
            AcceptedAt = Now,
            RepresentativeName = Cut(representativeName.Trim(), 160),
            RepresentativeDocumentType = seller.ResponsibleDocumentType,
            RepresentativeDocument = seller.ResponsibleDocument,
            IpAddress = currentUser.IpAddress,
            UserAgent = currentUser.UserAgent is { Length: > 512 } ua ? ua[..512] : currentUser.UserAgent,
        });
        seller.PolicyVersionAccepted = version;
        seller.PolicyAcceptedAt = Now;
        foreach (var notice in db.SellerNotices.Local.Where(n => n.SellerId == seller.Id && n.Type == SellerNoticeType.AlteracaoPolitica && n.Status != SellerNoticeStatus.Encerrada))
            CloseNotice(notice, $"Nova versão aceita em {Now:dd/MM/yyyy}.");
    }

    public async Task CloseOpenPolicyNoticesAsync(Guid sellerId, CancellationToken ct)
    {
        var open = await db.SellerNotices.Where(n => n.SellerId == sellerId && n.Type == SellerNoticeType.AlteracaoPolitica && n.Status != SellerNoticeStatus.Encerrada).ToListAsync(ct);
        foreach (var notice in open) CloseNotice(notice, $"Nova versão aceita em {Now:dd/MM/yyyy}.");
    }

    private void CloseNotice(SellerNotice notice, string resolution)
    {
        notice.Status = SellerNoticeStatus.Encerrada;
        notice.Resolution = resolution;
        notice.ResolvedAt = Now;
        notice.ReadAt ??= Now;
    }

    /// <summary>Avisa todas as lojas da nova versão da Política (10.3). Não salva.</summary>
    public async Task<int> NotifyPolicyChangeAsync(string version, CancellationToken ct)
    {
        var sellers = await db.Sellers.Where(s => s.Status != SellerStatus.Excluido).Select(s => s.Id).ToListAsync(ct);
        foreach (var id in sellers)
            Notify(id, SellerNoticeType.AlteracaoPolitica, $"Nova versão da Política de Vendedores ({version})",
                "A Política de Admissão e de Monitoramento de Vendedores foi alterada. Leia a nova versão e registre o aceite no painel " +
                "(Política, item 10.3). O texto está em /politica-de-vendedores.");
        return sellers.Count;
    }

    /// <summary>
    /// O vendedor confirmou ou atualizou os dados (4.2 e 4.3): fecha os pedidos de atualização em aberto e, se a loja foi
    /// suspensa só por não corrigir os dados no prazo (8.4), libera quando o cadastro está completo. Não salva.
    /// </summary>
    public async Task MarkDataConfirmedAsync(Seller seller, string how, CancellationToken ct)
    {
        seller.DataConfirmedAt = Now;
        var open = await db.SellerNotices.Where(n => n.SellerId == seller.Id && n.Type == SellerNoticeType.AtualizacaoCadastral &&
                                                     n.Status == SellerNoticeStatus.Aberta).ToListAsync(ct);
        foreach (var notice in open)
        {
            var line = $"{how} em {Now:dd/MM/yyyy HH:mm} (UTC).";
            notice.Status = SellerNoticeStatus.Respondida;
            notice.ResponseText = string.IsNullOrWhiteSpace(notice.ResponseText) ? line : Cut($"{notice.ResponseText}\n\n{line}", 4000);
            notice.RespondedAt = Now;
            notice.RespondedByUserId = currentUser.UserId;
        }
        if (seller.Status == SellerStatus.Suspenso && seller.HasAdmissionData)
        {
            var dataMeasures = await (from m in db.SellerMeasures
                                      join i in db.SellerInfractions on m.InfractionId equals i.Id
                                      where m.SellerId == seller.Id && m.RevokedAt == null && m.Automatic && i.Code == CodeDataNotUpdated
                                      select m).ToListAsync(ct);
            foreach (var measure in dataMeasures) await RevokeAsync(measure, "Dados cadastrais atualizados pelo vendedor.", automatic: true, ct);
        }
    }

    /// <summary>Pede ao vendedor que corrija ou confirme os dados em 10 dias (8.4). Não salva.</summary>
    public SellerNotice RequestDataUpdate(Guid sellerId, string message, string? title = null) =>
        Notify(sellerId, SellerNoticeType.AtualizacaoCadastral, title ?? "Corrija ou confirme os dados cadastrais da loja",
            message + $"\n\nPrazo: {ProgramDeadlines.SellerResponseDays} dias. Sem a correção, a loja é suspensa (Política de Vendedores, item 8.4).",
            Now.AddDays(ProgramDeadlines.SellerResponseDays));

    // =================================================================================================================
    // Recadastro de loja excluída (3.5)
    // =================================================================================================================

    /// <summary>
    /// Lojas excluídas com dados ou documentos dos itens 3.1 e 3.2 iguais aos informados. <c>Strong</c> = RUC, documento
    /// do representante ou conta (o cadastro é recusado); os demais (denominação, e-mail, telefone) ficam para a equipe.
    /// </summary>
    public async Task<(IReadOnlyList<string> Strong, IReadOnlyList<string> Weak)> MatchExcludedAsync(Guid? sellerId, string? ruc, string? legalName,
        SellerDocumentType? documentType, string? document, string? payoutAccount, string? email, string? phone, CancellationToken ct)
    {
        var excluded = await db.Sellers.AsNoTracking().Where(s => s.Status == SellerStatus.Excluido && s.Id != sellerId).ToListAsync(ct);
        var strong = new List<string>();
        var weak = new List<string>();
        static string Digits(string? v) => Documents.OnlyDigits(v);
        foreach (var s in excluded)
        {
            if (!string.IsNullOrWhiteSpace(ruc) && Digits(s.Ruc) == Digits(ruc)) strong.Add($"RUC igual ao da loja excluída {s.Name}");
            if (!string.IsNullOrWhiteSpace(document) && documentType == s.ResponsibleDocumentType &&
                string.Equals(s.ResponsibleDocument, document, StringComparison.OrdinalIgnoreCase))
                strong.Add($"Documento do representante igual ao da loja excluída {s.Name}");
            if (!string.IsNullOrWhiteSpace(payoutAccount) && !string.IsNullOrWhiteSpace(s.PayoutAccount) &&
                TextFold.Fold(s.PayoutAccount).Replace(" ", "") == TextFold.Fold(payoutAccount).Replace(" ", ""))
                strong.Add($"Conta de recebimento igual à da loja excluída {s.Name}");
            if (!string.IsNullOrWhiteSpace(legalName) && !string.IsNullOrWhiteSpace(s.LegalName) && TextFold.Fold(s.LegalName) == TextFold.Fold(legalName))
                weak.Add($"Denominação social igual à da loja excluída {s.Name}");
            if (!string.IsNullOrWhiteSpace(email) && string.Equals(s.Email, email.Trim(), StringComparison.OrdinalIgnoreCase))
                weak.Add($"E-mail igual ao da loja excluída {s.Name}");
            if (!string.IsNullOrWhiteSpace(phone) && Digits(phone).Length >= 8 && Digits(s.Phone) == Digits(phone))
                weak.Add($"Telefone igual ao da loja excluída {s.Name}");
        }
        return (strong, weak);
    }

    // =================================================================================================================
    // Visões
    // =================================================================================================================

    public static IReadOnlyList<string> MissingAdmissionData(Seller s)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(s.LegalName)) missing.Add("Denominação social");
        if (string.IsNullOrWhiteSpace(s.LegalAddress)) missing.Add("Endereço");
        if (string.IsNullOrWhiteSpace(s.Phone)) missing.Add("Telefone");
        if (string.IsNullOrWhiteSpace(s.Email)) missing.Add("E-mail");
        if (!Documents.IsValidRuc(s.Ruc)) missing.Add("RUC válido");
        if (s.PayoutMethod is null || string.IsNullOrWhiteSpace(s.PayoutAccount) || string.IsNullOrWhiteSpace(s.PayoutHolder)) missing.Add("Meio de pagamento");
        if (string.IsNullOrWhiteSpace(s.ResponsibleName) || s.ResponsibleDocumentType is null || string.IsNullOrWhiteSpace(s.ResponsibleDocument)) missing.Add("Representante legal");
        if (string.IsNullOrWhiteSpace(s.IdentityDocumentUrl)) missing.Add("Documento do representante");
        if (string.IsNullOrWhiteSpace(s.RucCertificateUrl)) missing.Add("Constancia de RUC");
        if (string.IsNullOrWhiteSpace(s.TaxComplianceCertificateUrl)) missing.Add("Certificado de Cumplimiento Tributario");
        if (string.IsNullOrWhiteSpace(s.ArticlesOfIncorporationUrl)) missing.Add("Atos constitutivos e registro comercial");
        return missing;
    }

    public static DateTime DataConfirmationDueAt(Seller s) =>
        (s.DataConfirmedAt ?? s.VerifiedAt ?? s.MemberSince).AddMonths(ProgramDeadlines.DataConfirmationMonths);

    public async Task<SellerComplianceStatusDto> StatusForSellerAsync(Seller seller, CancellationToken ct)
    {
        var settings = await settingsProvider.GetAsync(ct);
        var now = Now;
        var open = await db.SellerNotices.AsNoTracking().Where(n => n.SellerId == seller.Id && n.Status == SellerNoticeStatus.Aberta)
            .Select(n => new { n.DueAt }).ToListAsync(ct);
        var measures = (await MeasuresAsync(seller.Id, ct)).Where(m => m.Active).ToList();
        var due = DataConfirmationDueAt(seller);
        return new SellerComplianceStatusDto(
            seller.Status, seller.SuspensionReason, seller.SuspendedUntil, settings.SellerPolicyVersion, seller.PolicyVersionAccepted,
            seller.Status != SellerStatus.Excluido && seller.PolicyVersionAccepted != settings.SellerPolicyVersion,
            seller.DataConfirmedAt, due, due <= now.AddDays(30), seller.HasAdmissionData, MissingAdmissionData(seller),
            open.Count, open.Count(n => n.DueAt is { } d && d < now),
            await CountInfractionsAsync(seller.Id, now.AddMonths(-ProgramDeadlines.RecidivismMonths), ct), measures);
    }

    public async Task<SellerGovernanceDto> GovernanceAsync(Guid sellerId, CancellationToken ct)
    {
        var seller = await db.Sellers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sellerId, ct) ?? throw AppException.NotFound("Loja");
        var notices = await MaterializeAsync(db.SellerNotices.AsNoTracking().Where(n => n.SellerId == sellerId).OrderByDescending(n => n.CreatedAt).Take(50), ct);
        var acceptances = (await db.SellerPolicyAcceptances.AsNoTracking().Where(a => a.SellerId == sellerId).OrderByDescending(a => a.AcceptedAt).ToListAsync(ct))
            .Select(a => new SellerPolicyAcceptanceDto(a.PolicyVersion, a.AcceptedAt, a.RepresentativeName, Mappers.MaskDocument(a.RepresentativeDocument), a.IpAddress))
            .ToList();
        var audits = await AuditsQuery(db.SellerAudits.AsNoTracking().Where(a => a.SellerId == sellerId)).ToListAsync(ct);
        var (strong, weak) = await MatchExcludedAsync(seller.Id, seller.Ruc, seller.LegalName, seller.ResponsibleDocumentType, seller.ResponsibleDocument,
            seller.PayoutAccount, seller.Email, seller.Phone, ct);
        var infractions = await InfractionsAsync(sellerId, ct);
        var recent = infractions.Count(i => i.OccurredAt >= Now.AddMonths(-ProgramDeadlines.RecidivismMonths));
        return new SellerGovernanceDto(notices, infractions, await MeasuresAsync(sellerId, ct), acceptances, audits,
            [.. strong, .. weak], recent, infractions.Any(i => i.Recidivist && i.OccurredAt >= Now.AddMonths(-ProgramDeadlines.RecidivismMonths)));
    }

    public IQueryable<SellerAuditDto> AuditsQuery(IQueryable<SellerAudit> source) =>
        from a in source
        join s in db.Sellers on a.SellerId equals s.Id
        orderby a.PlannedAt descending
        select new SellerAuditDto(a.Id, a.SellerId, s.Name, a.Year, a.Reason, a.Status, a.PlannedAt, a.NoticeId, a.Outcome, a.Findings, a.CompletedAt);

    // =================================================================================================================
    // Rotina diária (ComplianceMonitorJob)
    // =================================================================================================================

    /// <summary>
    /// Confirmação anual (4.3) e cadastros incompletos: pede atualização em 10 dias; prazo vencido sem correção suspende a
    /// loja (8.4); suspensões temporárias vencidas são levantadas.
    /// </summary>
    public async Task<(int Notices, int Suspended, int Lifted)> RunDailyAsync(CancellationToken ct)
    {
        var now = Now;
        int notices = 0, suspended = 0, lifted = 0;

        var openDataNotices = await db.SellerNotices.Where(n => n.Type == SellerNoticeType.AtualizacaoCadastral && n.Status == SellerNoticeStatus.Aberta)
            .ToListAsync(ct);
        var withOpenRequest = openDataNotices.Select(n => n.SellerId).ToHashSet();

        var active = await db.Sellers.Where(s => s.Status == SellerStatus.Aprovado).ToListAsync(ct);
        foreach (var seller in active.Where(s => !withOpenRequest.Contains(s.Id)))
        {
            if (!seller.HasAdmissionData)
            {
                RequestDataUpdate(seller.Id,
                    $"O cadastro da loja está incompleto para a Política de Admissão de Vendedores (itens 3.1 e 3.2). Complete em Configurações: {string.Join(", ", MissingAdmissionData(seller))}.",
                    "Complete o cadastro da loja");
                notices++;
            }
            else if (DataConfirmationDueAt(seller) <= now)
            {
                RequestDataUpdate(seller.Id,
                    "Faz 12 meses desde a última confirmação dos dados cadastrais (Política de Vendedores, item 4.3). Confira os dados em Configurações e confirme.",
                    "Confirme os dados cadastrais da loja");
                notices++;
            }
        }

        foreach (var notice in openDataNotices.Where(n => n.DueAt is { } due && due < now))
        {
            var seller = await db.Sellers.FirstAsync(s => s.Id == notice.SellerId, ct);
            notice.Status = SellerNoticeStatus.Encerrada;
            notice.Resolution = "Prazo de 10 dias vencido sem a correção dos dados: loja suspensa (Política 8.4).";
            notice.ResolvedAt = now;
            if (seller.Status != SellerStatus.Aprovado) continue;
            await SuspendForDataNotUpdatedAsync(seller.Id, now, ct);
            suspended++;
        }

        var expired = await db.SellerMeasures.Where(m => m.Type == SellerMeasureType.SuspensaoTemporaria && m.RevokedAt == null && m.EndsAt != null && m.EndsAt <= now)
            .ToListAsync(ct);
        foreach (var measure in expired)
        {
            await RevokeAsync(measure, "Fim do prazo da suspensão temporária.", automatic: true, ct);
            lifted++;
        }

        if (notices + suspended + lifted > 0)
        {
            await db.SaveChangesAsync(ct);
            await catalogCache.InvalidateAsync(ct);
        }
        return (notices, suspended, lifted);
    }

    /// <summary>
    /// Infração e suspensão automática por dados não corrigidos em 10 dias (8.4). Automática para que a atualização do
    /// cadastro a revogue sozinha (<see cref="MarkDataConfirmedAsync"/>). Não salva.
    /// </summary>
    private async Task SuspendForDataNotUpdatedAsync(Guid sellerId, DateTime now, CancellationToken ct)
    {
        var infraction = await AddInfractionAsync(sellerId, CodeDataNotUpdated,
            "Dados cadastrais não corrigidos ou confirmados no prazo de 10 dias contados da solicitação.", InfractionSeverity.Leve, false, now, ct: ct);
        await ApplyMeasureAsync(sellerId, new SellerMeasureInput(SellerMeasureType.SuspensaoTemporaria,
            "Dados cadastrais não corrigidos em 10 dias contados da solicitação (Política de Vendedores, item 8.4). A suspensão termina quando o cadastro for atualizado.",
            infraction.Id, null, null), automatic: true, ct, save: false);
    }

    private static string Cut(string value, int max) => value.Length > max ? value[..max] : value;
}
