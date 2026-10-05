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
/// Programa de conformidade (Portaria Coana 130/2023, art. 8º, IV e V; Portaria Coana 193/2026): regras que um produto
/// cumpre antes da vitrine, denúncias, ocorrências dos três indicadores, apuração mensal por faixa e descredenciamento
/// automático de vendedores reincidentes.
/// </summary>
public sealed class ComplianceService(
    IAppDbContext db,
    PlatformSettingsProvider settingsProvider,
    INcmCatalog ncmCatalog,
    ICatalogCache catalogCache,
    ICurrentUser currentUser,
    TimeProvider clock,
    ILogger<ComplianceService> logger)
{
    /// <summary>Motivos de análise que o próprio sistema aplica (e retira quando deixam de valer).</summary>
    public const string ReasonProtectedBrand = "MARCA_PROTEGIDA";
    public const string ReasonPriceFloor = "PRECO_ABAIXO_REFERENCIA";
    public const string ReasonReport = "DENUNCIA";
    public const string ReasonCounterfeit = "CONTRAFACAO";

    private static readonly HashSet<string> AutomaticReasons = [ReasonProtectedBrand, ReasonPriceFloor];

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    private void Audit(string action, string? target, string? details = null) =>
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = action, Target = target, OccurredAt = Now, IpAddress = currentUser.IpAddress, Details = details });

    // =================================================================================================================
    // Produto: NCM, descrição e checagens de contrafação/subvaloração
    // =================================================================================================================

    /// <summary>
    /// NCM do produto: obrigatório fora de rascunho, 8 dígitos, existente na tabela oficial (quando carregada), fora dos
    /// capítulos proibidos e coerente com a categoria. Devolve o código normalizado.
    /// </summary>
    public async Task<string?> ValidateNcmAsync(string? raw, string categorySlug, bool required, CancellationToken ct)
    {
        var code = Ncm.Normalize(raw);
        if (code is null)
        {
            if (required) throw AppException.Validation("hsCode", "Informe o NCM do produto (8 dígitos). Ele vai na declaração de importação.");
            return null;
        }
        if (!Ncm.IsWellFormed(code))
            throw AppException.Validation("hsCode", "O NCM tem 8 dígitos, ex.: 8517.13.00.");
        if (Ncm.ProhibitionReason(code) is { } prohibited)
            throw AppException.Validation("hsCode", prohibited);
        if (!Ncm.MatchesCategory(categorySlug, code))
            throw AppException.Validation("hsCode", $"O NCM {Ncm.Format(code)} (capítulo {Ncm.Chapter(code)}) não corresponde à categoria escolhida.");
        if (ncmCatalog.IsLoaded && await ncmCatalog.FindAsync(code, ct) is null)
            throw AppException.Validation("hsCode", $"O NCM {Ncm.Format(code)} não existe na tabela oficial vigente.");
        return code;
    }

    public sealed record ListingDecision(ProductStatus Status, string? Reason, string? Note);

    /// <summary>
    /// Status final de um produto salvo pelo vendedor. Bloqueado continua bloqueado; marca protegida ou preço muito
    /// abaixo da mediana do mesmo NCM vão para análise, a não ser que o admin já tenha liberado este nome e preço.
    /// </summary>
    public async Task<ListingDecision> DecideListingAsync(Product product, ProductStatus requested, CancellationToken ct)
    {
        if (product.Status == ProductStatus.Bloqueado)
            return new ListingDecision(ProductStatus.Bloqueado, product.ModerationReason, product.ModerationNote);
        if (requested == ProductStatus.Rascunho)
            return new ListingDecision(ProductStatus.Rascunho, null, null);

        var settings = await settingsProvider.GetAsync(ct);
        var approved = product.ApprovedName is not null && product.ApprovedName == product.Name
                       && product.ApprovedPriceAmount is { } approvedPrice && product.PriceAmount * 10 >= approvedPrice * 9;

        if (!approved)
        {
            if (BrandWatch.FindProtectedBrand(product.Name, settings.ProtectedBrandList()) is { } brand)
                return new ListingDecision(ProductStatus.EmAnalise, ReasonProtectedBrand,
                    $"Marca {brand}: a equipe confere a origem (nota de compra ou autorização do distribuidor) antes de publicar.");

            if (product.HsCode is { } code && await ReferencePriceAsync(product.Id, code, ct) is { } median
                && product.PriceAmount * 100 < median * settings.PriceFloorPercent)
                return new ListingDecision(ProductStatus.EmAnalise, ReasonPriceFloor,
                    string.Create(System.Globalization.CultureInfo.GetCultureInfo("pt-BR"),
                        $"Preço abaixo de {settings.PriceFloorPercent}% da mediana (R$ {median / 100m:N2}) de produtos com o mesmo NCM. Risco de subvaloração na declaração."));
        }

        // Análise aberta por denúncia ou pela equipe só sai pelo admin.
        if (product.Status == ProductStatus.EmAnalise && product.ModerationReason is { } reason && !AutomaticReasons.Contains(reason) && !approved)
            return new ListingDecision(ProductStatus.EmAnalise, reason, product.ModerationNote);

        return new ListingDecision(ProductStatus.Ativo, null, null);
    }

    /// <summary>Mediana do preço dos produtos ativos com o mesmo NCM (mín. 3); senão, da mesma posição de 4 dígitos.</summary>
    public async Task<long?> ReferencePriceAsync(Guid productId, string ncm, CancellationToken ct)
    {
        var same = await db.Products.AsNoTracking()
            .Where(p => p.Id != productId && p.Status == ProductStatus.Ativo && p.HsCode == ncm)
            .Select(p => p.PriceAmount).ToListAsync(ct);
        if (same.Count < 3)
        {
            var heading = ncm[..4];
            same = await db.Products.AsNoTracking()
                .Where(p => p.Id != productId && p.Status == ProductStatus.Ativo && p.HsCode != null && p.HsCode.StartsWith(heading))
                .Select(p => p.PriceAmount).ToListAsync(ct);
        }
        if (same.Count < 3) return null;
        same.Sort();
        var mid = same.Count / 2;
        return same.Count % 2 == 1 ? same[mid] : (same[mid - 1] + same[mid]) / 2;
    }

    // =================================================================================================================
    // Denúncias
    // =================================================================================================================

    public async Task<ProductReportDto> ReportProductAsync(Guid productId, ProductReportRequest request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var details = request.Details?.Trim() ?? string.Empty;
        new ValidationErrors()
            .AddIf(details.Length > 1000, "details", "Conte em até 1.000 caracteres.")
            .AddIf(request.Reason == ProductReportReason.Outro && details.Length < 10, "details", "Explique o problema em pelo menos 10 caracteres.")
            .ThrowIfAny();
        var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == productId, ct) ?? throw AppException.NotFound("Produto");
        if (await db.ProductReports.AnyAsync(r => r.ProductId == productId && r.ReporterUserId == userId && r.Status == ProductReportStatus.Aberta, ct))
            throw AppException.Conflict("REPORT_ALREADY_OPEN", "Você já denunciou este produto. A equipe está analisando.");

        var report = new ProductReport
        {
            Id = Guid.NewGuid(),
            ProductId = product.Id,
            SellerId = product.SellerId,
            ReporterUserId = userId,
            Reason = request.Reason,
            Details = details,
            CreatedAt = Now,
        };
        db.ProductReports.Add(report);
        Audit("product.report", product.Slug, request.Reason.ToString());
        await db.SaveChangesAsync(ct);
        return await ReportsQuery(db.ProductReports.AsNoTracking().Where(r => r.Id == report.Id)).FirstAsync(ct);
    }

    /// <summary>Projeta denúncias já filtradas e ordenadas (filtrar depois da projeção não traduz para SQL).</summary>
    private IQueryable<ProductReportDto> ReportsQuery(IQueryable<ProductReport> source) =>
        from r in source
        join p in db.Products on r.ProductId equals p.Id
        join s in db.Sellers on r.SellerId equals s.Id
        join u in db.Users on r.ReporterUserId equals u.Id into users
        from u in users.DefaultIfEmpty()
        select new ProductReportDto(r.Id, p.Id, p.Name, p.Slug, p.Status, s.Id, s.Name, r.Reason, r.Details, r.Status, r.CreatedAt,
            u == null ? null : u.Email, r.ResolvedAt, r.ResolutionNote, r.OccurrenceId);

    public async Task<PagedResult<ProductReportDto>> ListReportsAsync(ProductReportStatus? status, int? page, int? pageSize, CancellationToken ct)
    {
        var source = db.ProductReports.AsNoTracking();
        if (status is { } s) source = source.Where(r => r.Status == s);
        var (p, size) = (Math.Max(1, page ?? 1), Math.Clamp(pageSize ?? 20, 1, 100));
        var total = await source.CountAsync(ct);
        var items = await ReportsQuery(source.OrderByDescending(r => r.CreatedAt).Skip((p - 1) * size).Take(size)).ToListAsync(ct);
        return new PagedResult<ProductReportDto>(items, p, size, total);
    }

    public static ComplianceIndicator IndicatorFor(ProductReportReason reason) => reason switch
    {
        ProductReportReason.Falsificado => ComplianceIndicator.Contrafacao,
        ProductReportReason.PrecoSuspeito => ComplianceIndicator.Subvaloracao,
        _ => ComplianceIndicator.QualidadeDeclaracao,
    };

    public async Task<ProductReportDto> ResolveReportAsync(Guid id, ProductReportResolveRequest request, CancellationToken ct)
    {
        var report = await db.ProductReports.FirstOrDefaultAsync(r => r.Id == id, ct) ?? throw AppException.NotFound("Denúncia");
        if (report.Status != ProductReportStatus.Aberta)
            throw AppException.Conflict("REPORT_ALREADY_RESOLVED", "Esta denúncia já foi resolvida.");
        var note = request.Note?.Trim();
        if (note is { Length: > 500 }) throw AppException.Validation("note", "Máximo de 500 caracteres.");

        report.Status = request.Upheld ? ProductReportStatus.Procedente : ProductReportStatus.Improcedente;
        report.ResolvedAt = Now;
        report.ResolvedByUserId = currentUser.UserId;
        report.ResolutionNote = note;

        if (request.Upheld)
        {
            var indicator = request.Indicator ?? IndicatorFor(report.Reason);
            var occurrence = await AddOccurrenceAsync(indicator, OccurrenceSource.Denuncia, $"DENUNCIA_{report.Reason.ToString().ToUpperInvariant()}",
                note ?? $"Denúncia procedente: {report.Reason}.", report.SellerId, report.ProductId, null, null, $"report:{report.Id}", Now, ct);
            report.OccurrenceId = occurrence.Id;
            if (request.BlockProduct)
            {
                var product = await db.Products.FirstAsync(p => p.Id == report.ProductId, ct);
                product.Status = ProductStatus.Bloqueado;
                product.ModerationReason = report.Reason == ProductReportReason.Falsificado ? ReasonCounterfeit : ReasonReport;
                product.ModerationNote = note ?? "Bloqueado após denúncia procedente.";
                product.ModeratedAt = Now;
                product.UpdatedAt = Now;
            }
        }
        Audit("admin.report.resolve", report.Id.ToString(), $"{report.Status}{(request.BlockProduct ? "+block" : "")}");
        await db.SaveChangesAsync(ct);
        if (request.Upheld) await EvaluateSellerStrikesAsync(report.SellerId, ct);
        await catalogCache.InvalidateAsync(ct);
        return await ReportsQuery(db.ProductReports.AsNoTracking().Where(r => r.Id == id)).FirstAsync(ct);
    }

    // =================================================================================================================
    // Ocorrências
    // =================================================================================================================

    /// <summary>Registra (ou devolve, se já existir com o mesmo ExternalId na mesma origem) uma ocorrência. Não salva.</summary>
    public async Task<ComplianceOccurrence> AddOccurrenceAsync(
        ComplianceIndicator indicator, OccurrenceSource source, string code, string description, Guid? sellerId, Guid? productId,
        Guid? orderId, Guid? shipmentId, string? externalId, DateTime occurredAt, CancellationToken ct)
    {
        if (externalId is not null)
        {
            var existing = await db.ComplianceOccurrences.FirstOrDefaultAsync(o => o.Source == source && o.ExternalId == externalId, ct);
            if (existing is not null) return existing;
            var pending = db.ComplianceOccurrences.Local.FirstOrDefault(o => o.Source == source && o.ExternalId == externalId);
            if (pending is not null) return pending;
        }
        var occurrence = new ComplianceOccurrence
        {
            Id = Guid.NewGuid(),
            Indicator = indicator,
            Source = source,
            Code = code.Length > 60 ? code[..60] : code,
            Description = description.Length > 1000 ? description[..1000] : description,
            SellerId = sellerId,
            ProductId = productId,
            OrderId = orderId,
            ShipmentId = shipmentId,
            ExternalId = externalId,
            OccurredAt = occurredAt,
            RegisteredAt = Now,
            RegisteredByUserId = currentUser.UserId,
        };
        db.ComplianceOccurrences.Add(occurrence);
        logger.LogWarning("Ocorrência {Indicator}/{Code} registrada ({Source}) para a loja {SellerId}", indicator, code, source, sellerId);
        return occurrence;
    }

    public async Task<ComplianceOccurrenceDto> RegisterOccurrenceAsync(ComplianceOccurrenceInput input, CancellationToken ct)
    {
        var description = input.Description?.Trim() ?? string.Empty;
        var code = (input.Code ?? string.Empty).Trim().ToUpperInvariant().Replace(' ', '_');
        new ValidationErrors()
            .AddIf(code.Length is < 3 or > 60, "code", "Informe o código da ocorrência (ex.: CPF_DESTINATARIO).")
            .AddIf(description.Length < 5, "description", "Descreva a ocorrência.")
            .AddIf(input.OccurredAt > Now.AddDays(1), "occurredAt", "A data não pode estar no futuro.")
            .ThrowIfAny();

        Guid? sellerId = input.SellerId, productId = input.ProductId, orderId = null, shipmentId = null;
        if (!string.IsNullOrWhiteSpace(input.OrderNumber))
        {
            var number = input.OrderNumber.Trim().ToUpperInvariant();
            var order = await db.Orders.AsNoTracking().Include(o => o.Shipment).FirstOrDefaultAsync(o => o.Number == number, ct)
                        ?? throw AppException.Validation("orderNumber", "Pedido não encontrado.");
            orderId = order.Id;
            sellerId ??= order.SellerId;
            shipmentId = order.Shipment?.Id;
        }
        if (sellerId is { } sid && !await db.Sellers.AnyAsync(s => s.Id == sid, ct))
            throw AppException.Validation("sellerId", "Loja não encontrada.");

        var occurrence = await AddOccurrenceAsync(input.Indicator, input.Source, code, description, sellerId, productId, orderId, shipmentId,
            null, input.OccurredAt ?? Now, ct);
        Audit("admin.occurrence.create", occurrence.Id.ToString(), $"{input.Indicator}/{code}");
        await db.SaveChangesAsync(ct);
        if (sellerId is { } seller) await EvaluateSellerStrikesAsync(seller, ct);
        return await OccurrencesQuery(db.ComplianceOccurrences.AsNoTracking().Where(o => o.Id == occurrence.Id)).FirstAsync(ct);
    }

    public async Task<ComplianceOccurrenceDto> SetOccurrenceStatusAsync(Guid id, OccurrenceStatusRequest request, CancellationToken ct)
    {
        var occurrence = await db.ComplianceOccurrences.FirstOrDefaultAsync(o => o.Id == id, ct) ?? throw AppException.NotFound("Ocorrência");
        var reason = request.Reason?.Trim();
        new ValidationErrors()
            .AddIf(request.Status != OccurrenceStatus.Confirmada && (reason is null || reason.Length < 5), "reason",
                "Informe o motivo (contestação só cabe por erro material, falha de sistema ou duplicidade).")
            .AddIf(reason is { Length: > 500 }, "reason", "Máximo de 500 caracteres.")
            .ThrowIfAny();
        occurrence.Status = request.Status;
        occurrence.StatusReason = reason;
        occurrence.StatusChangedAt = Now;
        Audit("admin.occurrence.status", occurrence.Id.ToString(), request.Status.ToString());
        await db.SaveChangesAsync(ct);
        return await OccurrencesQuery(db.ComplianceOccurrences.AsNoTracking().Where(o => o.Id == id)).FirstAsync(ct);
    }

    private IQueryable<ComplianceOccurrenceDto> OccurrencesQuery(IQueryable<ComplianceOccurrence> source) =>
        from o in source
        join s in db.Sellers on o.SellerId equals s.Id into sellers
        from s in sellers.DefaultIfEmpty()
        join p in db.Products on o.ProductId equals p.Id into products
        from p in products.DefaultIfEmpty()
        join ord in db.Orders on o.OrderId equals ord.Id into orders
        from ord in orders.DefaultIfEmpty()
        select new ComplianceOccurrenceDto(o.Id, o.Indicator, o.Source, o.Status, o.Code, o.Description,
            o.SellerId, s == null ? null : s.Name, o.ProductId, p == null ? null : p.Name, o.OrderId, ord == null ? null : ord.Number,
            o.ExternalId, o.OccurredAt, o.RegisteredAt, o.StatusReason);

    public async Task<PagedResult<ComplianceOccurrenceDto>> ListOccurrencesAsync(
        ComplianceIndicator? indicator, Guid? sellerId, OccurrenceStatus? status, int? page, int? pageSize, CancellationToken ct)
    {
        var source = db.ComplianceOccurrences.AsNoTracking();
        if (indicator is { } i) source = source.Where(o => o.Indicator == i);
        if (sellerId is { } sid) source = source.Where(o => o.SellerId == sid);
        if (status is { } st) source = source.Where(o => o.Status == st);
        var (p, size) = (Math.Max(1, page ?? 1), Math.Clamp(pageSize ?? 20, 1, 100));
        var total = await source.CountAsync(ct);
        var items = await OccurrencesQuery(source.OrderByDescending(o => o.OccurredAt).Skip((p - 1) * size).Take(size)).ToListAsync(ct);
        return new PagedResult<ComplianceOccurrenceDto>(items, p, size, total);
    }

    public async Task<IReadOnlyList<ComplianceOccurrenceDto>> SellerOccurrencesAsync(Guid sellerId, int take, CancellationToken ct) =>
        await OccurrencesQuery(db.ComplianceOccurrences.AsNoTracking().Where(o => o.SellerId == sellerId).OrderByDescending(o => o.OccurredAt).Take(take)).ToListAsync(ct);

    // =================================================================================================================
    // Reincidência
    // =================================================================================================================

    public async Task<int> CountSellerOccurrencesAsync(Guid sellerId, CancellationToken ct)
    {
        var settings = await settingsProvider.GetAsync(ct);
        var from = Now.AddDays(-settings.StrikeWindowDays);
        return await db.ComplianceOccurrences.CountAsync(o => o.SellerId == sellerId && o.Status != OccurrenceStatus.Anulada && o.OccurredAt >= from, ct);
    }

    /// <summary>Descredencia (suspende) a loja que atingiu o limite de ocorrências na janela. Devolve true se suspendeu.</summary>
    public async Task<bool> EvaluateSellerStrikesAsync(Guid sellerId, CancellationToken ct)
    {
        var settings = await settingsProvider.GetAsync(ct);
        if (settings.SellerStrikeLimit <= 0) return false;
        var count = await CountSellerOccurrencesAsync(sellerId, ct);
        if (count < settings.SellerStrikeLimit) return false;
        var seller = await db.Sellers.FirstOrDefaultAsync(s => s.Id == sellerId, ct);
        if (seller is null || seller.Status == SellerStatus.Suspenso) return false;

        seller.Status = SellerStatus.Suspenso;
        seller.SuspendedAt = Now;
        seller.SuspensionReason =
            $"Descredenciada automaticamente: {count} ocorrências de conformidade em {settings.StrikeWindowDays} dias (limite {settings.SellerStrikeLimit}).";
        db.AuditLogs.Add(new AuditLog { UserId = null, Action = "compliance.seller.suspend", Target = seller.Slug, OccurredAt = Now, Details = seller.SuspensionReason });
        await db.SaveChangesAsync(ct);
        await catalogCache.InvalidateAsync(ct);
        logger.LogWarning("Loja {Seller} descredenciada por reincidência ({Count} ocorrências)", seller.Slug, count);
        return true;
    }

    // =================================================================================================================
    // Indicadores
    // =================================================================================================================

    public async Task<ComplianceDashboardDto> DashboardAsync(int? cycleStartYear, CancellationToken ct)
    {
        var settings = await settingsProvider.GetAsync(ct);
        var year = cycleStartYear ?? ComplianceBands.CycleStartYear(Now);
        var (start, end) = ComplianceBands.CycleRange(year);

        // Remessas movimentadas = pedidos que saíram para o operador (evento Enviado) no mês.
        var shippedAt = await db.OrderEvents.AsNoTracking()
            .Where(e => e.Status == OrderStatus.Enviado && e.OccurredAt >= start && e.OccurredAt < end)
            .GroupBy(e => e.OrderId)
            .Select(g => g.Min(e => e.OccurredAt))
            .ToListAsync(ct);
        var occurrences = await db.ComplianceOccurrences.AsNoTracking()
            .Where(o => o.Status != OccurrenceStatus.Anulada && o.OccurredAt >= start && o.OccurredAt < end)
            .Select(o => new { o.Indicator, o.OccurredAt })
            .ToListAsync(ct);

        var months = new List<ComplianceMonthDto>();
        var lastMonth = Now < end ? new DateTime(Now.Year, Now.Month, 1, 0, 0, 0, DateTimeKind.Utc) : end.AddMonths(-1);
        for (var m = start; m <= lastMonth && m < end; m = m.AddMonths(1))
        {
            var next = m.AddMonths(1);
            var shipments = shippedAt.Count(d => d >= m && d < next);
            var indicators = Enum.GetValues<ComplianceIndicator>()
                .Select(i => Indicator(i, shipments, occurrences.Count(o => o.Indicator == i && o.OccurredAt >= m && o.OccurredAt < next)))
                .ToList();
            months.Add(new ComplianceMonthDto(m.Year, m.Month, shipments, indicators));
        }

        var cycleIndicators = Enum.GetValues<ComplianceIndicator>()
            .Select(i => Indicator(i, shippedAt.Count, occurrences.Count(o => o.Indicator == i)))
            .ToList();

        var windowStart = Now.AddDays(-settings.StrikeWindowDays);
        var risk = await db.ComplianceOccurrences.AsNoTracking()
            .Where(o => o.SellerId != null && o.Status != OccurrenceStatus.Anulada && o.OccurredAt >= windowStart)
            .GroupBy(o => o.SellerId!.Value)
            .Select(g => new { SellerId = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count).Take(10)
            .ToListAsync(ct);
        var riskIds = risk.Select(r => r.SellerId).ToList();
        var sellers = await db.Sellers.AsNoTracking().Where(s => riskIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);
        var openReportsBySeller = await db.ProductReports.AsNoTracking()
            .Where(r => r.Status == ProductReportStatus.Aberta && riskIds.Contains(r.SellerId))
            .GroupBy(r => r.SellerId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var atRisk = risk.Where(r => sellers.ContainsKey(r.SellerId))
            .Select(r => new SellerRiskDto(r.SellerId, sellers[r.SellerId].Name, sellers[r.SellerId].Status, r.Count, openReportsBySeller.GetValueOrDefault(r.SellerId)))
            .ToList();

        return new ComplianceDashboardDto(
            year, new DateRange(start, end.AddTicks(-1)), shippedAt.Count, shippedAt.Count >= ComplianceBands.SealMinimumShipments,
            ComplianceBands.SealMinimumShipments, cycleIndicators, months, atRisk,
            await db.ProductReports.CountAsync(r => r.Status == ProductReportStatus.Aberta, ct),
            await db.Products.CountAsync(p => p.Status == ProductStatus.EmAnalise, ct),
            await db.Sellers.CountAsync(s => s.Status == SellerStatus.Pendente, ct),
            settings.SellerStrikeLimit, settings.StrikeWindowDays);
    }

    private static ComplianceIndicatorDto Indicator(ComplianceIndicator indicator, int shipments, int occurrences)
    {
        var permyriad = ComplianceBands.CompliancePermyriad(shipments, occurrences);
        var band = ComplianceBands.BandOf(permyriad);
        return new ComplianceIndicatorDto(indicator, occurrences, permyriad, band, ComplianceBands.Consequence(band));
    }

    // =================================================================================================================
    // Moderação de produto
    // =================================================================================================================

    public async Task<AdminProductListItemDto> ModerateProductAsync(Guid id, ProductModerationRequest request, CancellationToken ct)
    {
        var product = await db.Products.Include(p => p.Images).Include(p => p.Seller).Include(p => p.Category)
                          .FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Produto");
        var action = request.Action?.Trim().ToLowerInvariant();
        var note = request.Note?.Trim();
        switch (action)
        {
            case "aprovar":
                if (product.HsCode is null)
                    throw AppException.Validation("action", "O produto não tem NCM; peça ao vendedor para completar antes de aprovar.");
                product.Status = ProductStatus.Ativo;
                product.ApprovedName = product.Name;
                product.ApprovedPriceAmount = product.PriceAmount;
                product.ModerationReason = null;
                product.ModerationNote = note;
                break;
            case "bloquear":
                var reason = request.Reason?.Trim().ToUpperInvariant().Replace(' ', '_');
                if (string.IsNullOrWhiteSpace(reason)) throw AppException.Validation("reason", "Informe o motivo do bloqueio.");
                product.Status = ProductStatus.Bloqueado;
                product.ModerationReason = reason.Length > 64 ? reason[..64] : reason;
                product.ModerationNote = note;
                break;
            case "analisar":
                product.Status = ProductStatus.EmAnalise;
                product.ModerationReason = string.IsNullOrWhiteSpace(request.Reason) ? ReasonReport : request.Reason.Trim().ToUpperInvariant();
                product.ModerationNote = note;
                break;
            default:
                throw AppException.Validation("action", "Ação inválida (aprovar, bloquear ou analisar).");
        }
        if (note is { Length: > 500 }) throw AppException.Validation("note", "Máximo de 500 caracteres.");
        product.ModeratedAt = Now;
        product.UpdatedAt = Now;
        Audit($"admin.product.{action}", product.Slug, product.ModerationReason);
        await db.SaveChangesAsync(ct);
        await catalogCache.InvalidateAsync(ct);
        var openReports = await db.ProductReports.CountAsync(r => r.ProductId == product.Id && r.Status == ProductReportStatus.Aberta, ct);
        return new AdminProductListItemDto(product.Id, product.Slug, product.Name, product.Thumbnail(), product.Price, product.Stock, product.Status,
            product.SellerId, product.Seller.Name, product.Category.Name, product.SoldCount, product.UpdatedAt, product.ModerationReason, product.HsCode, openReports);
    }
}
