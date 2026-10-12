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
/// Programa de conformidade (Portaria Coana 130/2023, art. 8º, IV e V; Portaria Coana 193/2026; Programa de Conformidade
/// Tributária e Aduaneira, itens 6 a 8 e 11): regras que um anúncio cumpre antes da vitrine e enquanto está publicado
/// (Anexo I da Política de Vendedores, descrição da declaração, contrafação, subvaloração), canal de denúncias aberto a
/// qualquer pessoa e decidido em 2 dias úteis, ocorrências dos três indicadores, apuração mensal por faixa e medidas
/// automáticas para vendedores reincidentes.
/// </summary>
public sealed class ComplianceService(
    IAppDbContext db,
    PlatformSettingsProvider settingsProvider,
    INcmCatalog ncmCatalog,
    ICatalogCache catalogCache,
    SellerGovernanceService governance,
    ReceitaRelationsService receita,
    ICurrentUser currentUser,
    TimeProvider clock,
    ILogger<ComplianceService> logger)
{
    /// <summary>Motivos de análise ou bloqueio gravados no produto.</summary>
    public const string ReasonProtectedBrand = "MARCA_PROTEGIDA";
    public const string ReasonPriceFloor = "PRECO_ABAIXO_REFERENCIA";
    public const string ReasonReport = "DENUNCIA";
    public const string ReasonCounterfeit = "CONTRAFACAO";
    /// <summary>NCM vedado pelo Anexo I (bloqueio).</summary>
    public const string ReasonProhibited = "PRODUTO_PROIBIDO";
    /// <summary>NCM que pede conferência (autorização, réplica de arma, bateria avulsa…).</summary>
    public const string ReasonRestricted = "PRODUTO_RESTRITO";
    /// <summary>Termo de oferta vedada no anúncio (Anexo I).</summary>
    public const string ReasonBannedTerm = "PRODUTO_VEDADO";
    /// <summary>Faltam dados da descrição da declaração (natureza, marca, material, quantidade, origem).</summary>
    public const string ReasonDeclarationData = "DADOS_DECLARACAO";
    /// <summary>Pedido de comprovação de autenticidade em aberto.</summary>
    public const string ReasonAuthenticity = "AUTENTICIDADE";
    /// <summary>Removido por medida da Política (8.1 a).</summary>
    public const string ReasonMeasure = "MEDIDA";

    /// <summary>Motivos que o próprio sistema aplica e retira quando deixam de valer.</summary>
    private static readonly HashSet<string> AutomaticReasons =
        [ReasonProtectedBrand, ReasonPriceFloor, ReasonRestricted, ReasonBannedTerm, ReasonDeclarationData];

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    private void Audit(string action, string? target, string? details = null) =>
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = action, Target = target, OccurredAt = Now, IpAddress = currentUser.IpAddress, Details = details });

    // =================================================================================================================
    // Produto: NCM, Anexo I, descrição da declaração e checagens de contrafação/subvaloração
    // =================================================================================================================

    /// <summary>
    /// NCM do produto: obrigatório fora de rascunho, 8 dígitos, existente na tabela oficial (quando carregada), fora das
    /// posições vedadas pelo Anexo I e coerente com a categoria. Devolve o código normalizado.
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

    /// <summary>Texto que a checagem do Anexo I lê como título (vale qualquer termo) e como corpo (só termos inequívocos).</summary>
    public static (string Title, string Body) ListingText(Product p) =>
        ($"{p.Name} {p.Nature} {p.Material} {p.Brand} {p.Model}", p.Description);

    /// <summary>
    /// Status final de um produto salvo pelo vendedor (Política 5.2: verificação antes da publicação). Bloqueado continua
    /// bloqueado; NCM vedado bloqueia; NCM restrito, termo de oferta vedada, marca protegida ou preço muito abaixo da
    /// mediana do mesmo NCM vão para análise, a não ser que o admin já tenha liberado este texto, nome e preço.
    /// </summary>
    /// <param name="commercialChecks">Marca protegida e preço de referência: só quando o vendedor salva (nome e preço mudaram).</param>
    public async Task<ListingDecision> DecideListingAsync(Product product, ProductStatus requested, CancellationToken ct, bool commercialChecks = true)
    {
        if (product.Status == ProductStatus.Bloqueado)
            return new ListingDecision(ProductStatus.Bloqueado, product.ModerationReason, product.ModerationNote);
        if (requested == ProductStatus.Rascunho)
            return new ListingDecision(ProductStatus.Rascunho, null, null);
        if (product.HsCode is { } blockedCode && ProhibitedGoods.CheckNcm(blockedCode) is { Level: RestrictionLevel.Bloqueio } blocked)
            return new ListingDecision(ProductStatus.Bloqueado, ReasonProhibited, blocked.Reason);
        if (!product.HasDeclarationData)
            return new ListingDecision(ProductStatus.EmAnalise, ReasonDeclarationData,
                "Complete a descrição da declaração: natureza, marca (ou \"sem marca\"), material, quantidade e país de origem (Programa de Conformidade 7.4 e 7.6).");

        var settings = await settingsProvider.GetAsync(ct);
        var approved = product.ApprovedName is not null && product.ApprovedName == product.Name
                       && product.ApprovedPriceAmount is { } approvedPrice && product.PriceAmount * 10 >= approvedPrice * 9;
        var textApproved = product.ApprovedFingerprint is not null && product.ApprovedFingerprint == product.ListingFingerprint();

        if (!textApproved)
        {
            if (product.HsCode is { } code && ProhibitedGoods.CheckNcm(code) is { Level: RestrictionLevel.Analise } restricted)
                return new ListingDecision(ProductStatus.EmAnalise, ReasonRestricted, restricted.Reason);
            var (title, body) = ListingText(product);
            if (ProhibitedGoods.CheckText(title, body) is { } term)
                return new ListingDecision(ProductStatus.EmAnalise, ReasonBannedTerm, term.Reason);
        }

        if (!approved && commercialChecks)
        {
            if (BrandWatch.FindProtectedBrand($"{product.Name} {product.Brand} {product.Model}", settings.ProtectedBrandList()) is { } brand)
                return new ListingDecision(ProductStatus.EmAnalise, ReasonProtectedBrand,
                    $"Marca {brand}: a equipe confere a origem (nota de compra ou autorização do distribuidor) antes de publicar.");

            if (product.HsCode is { } code && await ReferencePriceAsync(product.Id, code, ct) is { } median
                && product.PriceAmount * 100 < median * settings.PriceFloorPercent)
                return new ListingDecision(ProductStatus.EmAnalise, ReasonPriceFloor,
                    string.Create(System.Globalization.CultureInfo.GetCultureInfo("pt-BR"),
                        $"Preço abaixo de {settings.PriceFloorPercent}% da mediana (R$ {median / 100m:N2}) de produtos com o mesmo NCM. Risco de subvaloração na declaração."));
        }

        // Análise aberta por denúncia, pedido de autenticidade ou pela equipe só sai pelo admin.
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

    /// <summary>
    /// Verificação dos anúncios enquanto estão publicados (Política 5.2; Programa 8.2): aplica as regras atuais aos
    /// produtos ativos. NCM vedado remove o anúncio (medida 8.1 a, comunicada ao vendedor); termo vedado, NCM restrito ou
    /// dados da declaração incompletos tiram da vitrine para análise.
    /// </summary>
    public async Task<int> ScreenPublishedListingsAsync(CancellationToken ct)
    {
        var now = Now;
        var active = await db.Products.Where(p => p.Status == ProductStatus.Ativo).ToListAsync(ct);
        var flagged = 0;
        foreach (var product in active)
        {
            product.ScreenedAt = now;
            if (product.HsCode is { } code && ProhibitedGoods.CheckNcm(code) is { Level: RestrictionLevel.Bloqueio } blocked)
            {
                product.ModerationReason = ReasonProhibited;
                await governance.ApplyMeasureAsync(product.SellerId,
                    new SellerMeasureInput(SellerMeasureType.RemocaoAnuncio, $"Oferta vedada: {blocked.Reason}", null, product.Id, null),
                    automatic: true, ct, save: false, moderationReason: ReasonProhibited);
                flagged++;
                continue;
            }
            var decision = await DecideListingAsync(product, ProductStatus.Ativo, ct, commercialChecks: false);
            if (decision.Status == ProductStatus.Ativo) continue;
            product.Status = decision.Status;
            product.ModerationReason = decision.Reason;
            product.ModerationNote = decision.Note;
            product.ModeratedAt = now;
            product.UpdatedAt = now;
            governance.Notify(product.SellerId, SellerNoticeType.Aviso, $"Anúncio em análise: {product.Name}",
                $"A verificação periódica dos anúncios (Política de Vendedores 5.2) tirou o anúncio da vitrine para análise.\n\n{decision.Note}",
                productId: product.Id);
            governance.LogAction(EnforcementActionKind.AnuncioEmAnalise, decision.Note ?? decision.Reason ?? "Verificação periódica",
                "Anúncio fora da vitrine até a análise.", product.SellerId, product.Id, automatic: true);
            flagged++;
        }
        await db.SaveChangesAsync(ct);
        if (flagged > 0)
        {
            await catalogCache.InvalidateAsync(ct);
            logger.LogWarning("Verificação dos anúncios publicados: {Count} retirado(s) da vitrine", flagged);
        }
        return flagged;
    }

    // =================================================================================================================
    // Canal de denúncias (Programa 8.5; Política 6.4 e 6.5)
    // =================================================================================================================

    private sealed record ReportContact(string? Name, string? Email, bool IsRightsHolder, string? RightsHolderName, IReadOnlyList<string>? EvidenceUrls);

    /// <summary>Denúncia pela página do produto: com ou sem conta.</summary>
    public async Task<ProductReportDto> ReportProductAsync(Guid productId, ProductReportRequest request, CancellationToken ct)
    {
        var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == productId, ct) ?? throw AppException.NotFound("Produto");
        var report = await CreateReportAsync(product, request.Reason, request.Details, ReportChannel.PaginaDoProduto, request.Website,
            new ReportContact(request.ReporterName, request.ReporterEmail, request.IsRightsHolder, request.RightsHolderName, request.EvidenceUrls), ct);
        return await ReportsQuery(db.ProductReports.AsNoTracking().Where(r => r.Id == report.Id)).FirstAsync(ct);
    }

    /// <summary>Canal público (página "Canal de denúncias"): qualquer pessoa, cadastrada ou não, informa o anúncio pelo link.</summary>
    public async Task<ReportReceiptDto> SubmitPublicReportAsync(PublicReportRequest request, CancellationToken ct)
    {
        var product = await ResolveProductAsync(request.Product, ct);
        var report = await CreateReportAsync(product, request.Reason, request.Details, ReportChannel.CanalPublico, request.Website,
            new ReportContact(request.ReporterName, request.ReporterEmail, request.IsRightsHolder, request.RightsHolderName, request.EvidenceUrls), ct);
        return new ReportReceiptDto(report.Id, report.Protocol!, report.DueAt, product.Id, product.Name);
    }

    /// <summary>Link do anúncio (…/produto/slug), slug ou id.</summary>
    private async Task<Product> ResolveProductAsync(string? reference, CancellationToken ct)
    {
        var value = reference?.Trim() ?? string.Empty;
        if (value.Length == 0) throw AppException.Validation("product", "Informe o link do anúncio denunciado.");
        if (Guid.TryParse(value, out var id))
            return await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.Validation("product", "Anúncio não encontrado.");
        var marker = value.IndexOf("/produto/", StringComparison.OrdinalIgnoreCase);
        var slug = marker >= 0 ? value[(marker + "/produto/".Length)..] : value;
        slug = slug.Split('?', '#')[0].Trim('/').ToLowerInvariant();
        if (slug.Length is 0 or > 200) throw AppException.Validation("product", "Link do anúncio inválido.");
        return await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Slug == slug, ct)
               ?? throw AppException.Validation("product", "Anúncio não encontrado. Confira o link.");
    }

    private async Task<ProductReport> CreateReportAsync(Product product, ProductReportReason reason, string? rawDetails, ReportChannel channel,
        string? honeypot, ReportContact contact, CancellationToken ct)
    {
        // Robôs preenchem o campo escondido: some sem erro (não ensina o robô a contornar).
        if (!string.IsNullOrWhiteSpace(honeypot)) throw AppException.Validation("details", "Não foi possível registrar a denúncia.");
        var userId = currentUser.UserId;
        var details = rawDetails?.Trim() ?? string.Empty;
        var email = string.IsNullOrWhiteSpace(contact.Email) ? null : contact.Email.Trim().ToLowerInvariant();
        var evidence = (contact.EvidenceUrls ?? []).Select(e => e.Trim()).Where(e => e.Length > 0).Distinct().ToList();
        var minDetails = channel == ReportChannel.CanalPublico || reason == ProductReportReason.Outro ? 10 : 0;
        new ValidationErrors()
            .AddIf(details.Length > 2000, "details", "Conte em até 2.000 caracteres.")
            .AddIf(details.Length < minDetails, "details", "Explique o problema em pelo menos 10 caracteres.")
            .AddIf(email is not null && !Documents.IsValidEmail(email), "reporterEmail", "E-mail inválido.")
            .AddIf(contact.Name is { Length: > 160 }, "reporterName", "Nome muito longo.")
            .AddIf(contact.IsRightsHolder && string.IsNullOrWhiteSpace(contact.RightsHolderName), "rightsHolderName", "Informe o titular do direito (marca ou obra).")
            .AddIf(evidence.Count > 10, "evidenceUrls", "Máximo de 10 links.")
            .AddIf(evidence.Any(e => e.Length > 1024 || !e.StartsWith("http", StringComparison.OrdinalIgnoreCase)), "evidenceUrls", "Use links completos (https://…).")
            .ThrowIfAny();
        if (userId is { } uid && await db.ProductReports.AnyAsync(r => r.ProductId == product.Id && r.ReporterUserId == uid && r.Status == ProductReportStatus.Aberta, ct))
            throw AppException.Conflict("REPORT_ALREADY_OPEN", "Você já denunciou este produto. A equipe está analisando.");
        if (userId is null && email is not null && await db.ProductReports.AnyAsync(r => r.ProductId == product.Id && r.ReporterEmail == email && r.Status == ProductReportStatus.Aberta, ct))
            throw AppException.Conflict("REPORT_ALREADY_OPEN", "Já existe uma denúncia sua aberta para este anúncio. A equipe está analisando.");

        var now = Now;
        var report = new ProductReport
        {
            Id = Guid.NewGuid(),
            Protocol = await NextProtocolAsync(now, ct),
            Channel = channel,
            ProductId = product.Id,
            SellerId = product.SellerId,
            ReporterUserId = userId,
            ReporterName = string.IsNullOrWhiteSpace(contact.Name) ? null : contact.Name.Trim(),
            ReporterEmail = email,
            IsRightsHolder = contact.IsRightsHolder,
            RightsHolderName = contact.IsRightsHolder ? contact.RightsHolderName?.Trim() : null,
            EvidenceUrls = evidence,
            Reason = reason,
            Details = details,
            CreatedAt = now,
            DueAt = ProgramDeadlines.AddBusinessDays(now, ProgramDeadlines.ReportDecisionBusinessDays),
        };
        db.ProductReports.Add(report);
        governance.LogAction(EnforcementActionKind.DenunciaRecebida, $"{reason}: {details}",
            $"Protocolo {report.Protocol}; decisão até {report.DueAt:dd/MM/yyyy}.", product.SellerId, product.Id, report.Id, automatic: true);
        Audit("product.report", product.Slug, $"{reason}/{channel}");
        await db.SaveChangesAsync(ct);
        return report;
    }

    private async Task<string> NextProtocolAsync(DateTime now, CancellationToken ct)
    {
        var prefix = $"DEN-{now.Year}-";
        var count = await db.ProductReports.CountAsync(r => r.Protocol != null && r.Protocol.StartsWith(prefix), ct);
        var candidate = $"{prefix}{count + 1:000000}";
        while (await db.ProductReports.AnyAsync(r => r.Protocol == candidate, ct)) candidate = $"{prefix}{++count + 1:000000}";
        return candidate;
    }

    /// <summary>Projeta denúncias já filtradas e ordenadas (filtrar depois da projeção não traduz para SQL).</summary>
    private IQueryable<ProductReportDto> ReportsQuery(IQueryable<ProductReport> source)
    {
        var now = Now;
        return from r in source
               join p in db.Products on r.ProductId equals p.Id
               join s in db.Sellers on r.SellerId equals s.Id
               join u in db.Users on r.ReporterUserId equals u.Id into users
               from u in users.DefaultIfEmpty()
               select new ProductReportDto(r.Id, p.Id, p.Name, p.Slug, p.Status, s.Id, s.Name, r.Reason, r.Details, r.Status, r.CreatedAt,
                   u == null ? r.ReporterEmail : u.Email, r.ResolvedAt, r.ResolutionNote, r.OccurrenceId, r.Protocol, r.Channel,
                   u == null ? r.ReporterName : u.FullName, r.IsRightsHolder, r.RightsHolderName, r.EvidenceUrls, r.DueAt,
                   r.Status == ProductReportStatus.Aberta && r.DueAt < now);
    }

    public async Task<PagedResult<ProductReportDto>> ListReportsAsync(ProductReportStatus? status, int? page, int? pageSize, CancellationToken ct)
    {
        var source = db.ProductReports.AsNoTracking();
        if (status is { } s) source = source.Where(r => r.Status == s);
        var (p, size) = (Math.Max(1, page ?? 1), Math.Clamp(pageSize ?? 20, 1, 100));
        var total = await source.CountAsync(ct);
        // Abertas primeiro; dentro de cada grupo, as mais recentes.
        var items = await ReportsQuery(source.OrderBy(r => r.Status == ProductReportStatus.Aberta ? 0 : 1)
            .ThenByDescending(r => r.CreatedAt).Skip((p - 1) * size).Take(size)).ToListAsync(ct);
        return new PagedResult<ProductReportDto>(items, p, size, total);
    }

    public static ComplianceIndicator IndicatorFor(ProductReportReason reason) => reason switch
    {
        ProductReportReason.Falsificado or ProductReportReason.PropriedadeIntelectual => ComplianceIndicator.Contrafacao,
        ProductReportReason.PrecoSuspeito => ComplianceIndicator.Subvaloracao,
        _ => ComplianceIndicator.QualidadeDeclaracao,
    };

    private static (string Code, InfractionSeverity Severity, string Moderation) InfractionFor(ProductReportReason reason) => reason switch
    {
        ProductReportReason.Falsificado => ("CONTRAFACAO", InfractionSeverity.Grave, ReasonCounterfeit),
        ProductReportReason.PropriedadeIntelectual => ("PROPRIEDADE_INTELECTUAL", InfractionSeverity.Grave, ReasonCounterfeit),
        ProductReportReason.OrigemIlicita => ("ORIGEM_ILICITA", InfractionSeverity.Grave, "ORIGEM_ILICITA"),
        ProductReportReason.ProdutoProibido => ("PRODUTO_PROIBIDO", InfractionSeverity.Grave, ReasonProhibited),
        ProductReportReason.PrecoSuspeito => ("SUBFATURAMENTO", InfractionSeverity.Media, ReasonReport),
        ProductReportReason.DescricaoIncorreta => ("DIVERGENCIA", InfractionSeverity.Leve, ReasonReport),
        _ => ("OUTRO", InfractionSeverity.Leve, ReasonReport),
    };

    /// <summary>
    /// Decisão da denúncia (em até 2 dias úteis). Procedente: ocorrência no indicador, infração do vendedor (6.7) e,
    /// com bloqueio, remoção do anúncio comunicada ao vendedor (8.5). Quem denunciou com e-mail recebe a decisão.
    /// </summary>
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
            var (code, severity, moderation) = InfractionFor(report.Reason);
            var infraction = await governance.AddInfractionAsync(report.SellerId, code,
                note ?? $"Denúncia {report.Protocol} julgada procedente ({report.Reason}).", severity, false, Now, report.ProductId,
                occurrenceId: occurrence.Id, reportId: report.Id, ct: ct);
            if (request.BlockProduct)
                await governance.ApplyMeasureAsync(report.SellerId,
                    new SellerMeasureInput(SellerMeasureType.RemocaoAnuncio, note ?? $"Denúncia {report.Protocol} julgada procedente ({report.Reason}).",
                        infraction.Id, report.ProductId, null),
                    automatic: false, ct, save: false, moderationReason: moderation);
            governance.LogAction(EnforcementActionKind.DenunciaProcedente, note ?? report.Reason.ToString(),
                request.BlockProduct ? "Anúncio removido; ocorrência e infração registradas." : "Ocorrência e infração registradas.",
                report.SellerId, report.ProductId, report.Id);
        }
        else
        {
            governance.LogAction(EnforcementActionKind.DenunciaImprocedente, note ?? report.Reason.ToString(), "Anúncio mantido.",
                report.SellerId, report.ProductId, report.Id);
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

    /// <summary>
    /// Contestar exige o fundamento do item 11.6 e a fundamentação (11.7) e abre o registro no relacionamento com a
    /// Receita; anular ou confirmar registram o motivo.
    /// </summary>
    public async Task<ComplianceOccurrenceDto> SetOccurrenceStatusAsync(Guid id, OccurrenceStatusRequest request, CancellationToken ct)
    {
        var occurrence = await db.ComplianceOccurrences.FirstOrDefaultAsync(o => o.Id == id, ct) ?? throw AppException.NotFound("Ocorrência");
        if (request.Status == OccurrenceStatus.Contestada)
        {
            if (request.ContestationReason is not { } reason)
                throw AppException.Validation("contestationReason",
                    "A contestação só cabe por erro material, inconsistência sistêmica ou impropriedade na aplicação da metodologia de cálculo (Programa 11.6).");
            await receita.ContestAsync(new ContestationRequest(occurrence.Indicator, [occurrence.Id], reason, request.Grounds ?? request.Reason,
                request.Evidence, request.Reference), ct, save: false);
            Audit("admin.occurrence.status", occurrence.Id.ToString(), $"Contestada/{reason}");
            await db.SaveChangesAsync(ct);
            return await OccurrencesQuery(db.ComplianceOccurrences.AsNoTracking().Where(o => o.Id == id)).FirstAsync(ct);
        }

        var text = request.Reason?.Trim();
        new ValidationErrors()
            .AddIf(request.Status == OccurrenceStatus.Anulada && (text is null || text.Length < 5), "reason",
                "Informe o motivo da anulação (ex.: contestação acolhida pela Receita).")
            .AddIf(text is { Length: > 500 }, "reason", "Máximo de 500 caracteres.")
            .ThrowIfAny();
        occurrence.Status = request.Status;
        occurrence.StatusReason = text;
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
            o.ExternalId, o.OccurredAt, o.RegisteredAt, o.StatusReason, o.ContestationReason, o.ContestationGrounds, o.ContestedAt,
            o.RfInteractionId);

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

    /// <summary>
    /// Suspende a loja que atingiu o limite de ocorrências na janela: medida automática, comunicada ao vendedor com o
    /// motivo e prazo de resposta (Política 8.5 e 8.6). Devolve true se suspendeu.
    /// </summary>
    public async Task<bool> EvaluateSellerStrikesAsync(Guid sellerId, CancellationToken ct)
    {
        var settings = await settingsProvider.GetAsync(ct);
        if (settings.SellerStrikeLimit <= 0) return false;
        var count = await CountSellerOccurrencesAsync(sellerId, ct);
        if (count < settings.SellerStrikeLimit) return false;
        var seller = await db.Sellers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sellerId, ct);
        if (seller is null || seller.Status is SellerStatus.Suspenso or SellerStatus.Excluido) return false;

        var reason = $"Descredenciada automaticamente: {count} ocorrências de conformidade em {settings.StrikeWindowDays} dias (limite {settings.SellerStrikeLimit}). A suspensão vale até a revisão da equipe.";
        await governance.ApplyMeasureAsync(sellerId, new SellerMeasureInput(SellerMeasureType.SuspensaoTemporaria, reason, null, null, null), automatic: true, ct);
        db.AuditLogs.Add(new AuditLog { UserId = null, Action = "compliance.seller.suspend", Target = seller.Slug, OccurredAt = Now, Details = reason });
        await db.SaveChangesAsync(ct);
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
        if (note is { Length: > 500 }) throw AppException.Validation("note", "Máximo de 500 caracteres.");
        switch (action)
        {
            case "aprovar":
                if (product.HsCode is null)
                    throw AppException.Validation("action", "O produto não tem NCM; peça ao vendedor para completar antes de aprovar.");
                if (Ncm.ProhibitionReason(product.HsCode) is { } prohibited)
                    throw AppException.Validation("action", $"Oferta vedada: {prohibited}");
                if (!product.HasDeclarationData)
                    throw AppException.Validation("action", "Faltam dados da descrição da declaração (natureza, marca, material, quantidade ou origem). Peça ao vendedor para completar.");
                product.Status = ProductStatus.Ativo;
                product.ApprovedName = product.Name;
                product.ApprovedPriceAmount = product.PriceAmount;
                product.ApprovedFingerprint = product.ListingFingerprint();
                product.ModerationReason = null;
                product.ModerationNote = note;
                governance.LogAction(EnforcementActionKind.AnuncioLiberado, note ?? "Conferido pela equipe.", "Anúncio publicado.", product.SellerId, product.Id);
                break;
            case "bloquear":
                var reason = request.Reason?.Trim().ToUpperInvariant().Replace(' ', '_');
                if (string.IsNullOrWhiteSpace(reason)) throw AppException.Validation("reason", "Informe o motivo do bloqueio.");
                if (product.Status == ProductStatus.Bloqueado) throw AppException.Conflict("PRODUCT_BLOCKED", "O produto já está bloqueado.");
                // Remoção do anúncio é medida da Política (8.1 a): comunicada ao vendedor com o motivo e prazo de resposta.
                await governance.ApplyMeasureAsync(product.SellerId,
                    new SellerMeasureInput(SellerMeasureType.RemocaoAnuncio, note is { Length: >= 10 } ? note : $"Anúncio removido pela equipe: {reason}.", null, product.Id, null),
                    automatic: false, ct, save: false, moderationReason: reason.Length > 64 ? reason[..64] : reason);
                break;
            case "analisar":
                product.Status = ProductStatus.EmAnalise;
                product.ModerationReason = string.IsNullOrWhiteSpace(request.Reason) ? ReasonReport : request.Reason.Trim().ToUpperInvariant();
                product.ModerationNote = note;
                governance.Notify(product.SellerId, SellerNoticeType.Aviso, $"Anúncio em análise: {product.Name}",
                    $"A equipe tirou o anúncio da vitrine para análise.{(note is null ? "" : $"\n\n{note}")}", productId: product.Id);
                governance.LogAction(EnforcementActionKind.AnuncioEmAnalise, note ?? product.ModerationReason, "Anúncio fora da vitrine até a análise.",
                    product.SellerId, product.Id);
                break;
            default:
                throw AppException.Validation("action", "Ação inválida (aprovar, bloquear ou analisar).");
        }
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
