using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Compliance;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

/// <summary>Conferência do CPF do destinatário na base da Receita antes de concluir a venda (Programa 7.2).</summary>
public sealed class CpfVerificationOptions
{
    /// <summary>
    /// Sem a Consulta CPF (Serpro) ou com ela fora do ar, a venda não conclui. Desligado em Development e quando a operação
    /// ainda é de demonstração (<c>Serpro:AllowUnverifiedOutsideDevelopment</c>): aí só o dígito verificador é conferido.
    /// </summary>
    public bool RequireRegistryCheck { get; set; }
}

/// <summary>
/// Painel do Programa de Conformidade (responsável, aprovações, consulta mensal, prazos com a Receita, filas), capacitação
/// (13.1), auditoria anual de vendedores (Política 7.4), dados públicos da Política (2.4) e o dossiê do vendedor para as
/// autoridades (Programa 8.8; Política 9.1).
/// </summary>
public sealed class ComplianceProgramService(
    IAppDbContext db,
    PlatformSettingsProvider settingsProvider,
    SellerGovernanceService governance,
    IPlatformIdentityProvider platform,
    ITaxpayerRegistry taxpayers,
    Microsoft.Extensions.Options.IOptions<CpfVerificationOptions> cpfOptions,
    ILinkBuilder links,
    DocumentLinks documents,
    ICurrentUser currentUser,
    TimeProvider clock)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    // =================================================================================================================
    // Política publicada
    // =================================================================================================================

    public async Task<SellerPolicyInfoDto> SellerPolicyAsync(CancellationToken ct)
    {
        var settings = await settingsProvider.GetAsync(ct);
        var p = platform.Current;
        static string? Blank(string? v) => string.IsNullOrWhiteSpace(v) ? null : v.Trim();
        return new SellerPolicyInfoDto(settings.SellerPolicyVersion, settings.SellerPolicyApprovedAt, p.Brand, Blank(p.LegalName),
            Blank(p.Document) is null ? null : p.DocumentType, Blank(p.Document), Blank(p.AddressLine), links.SiteUrl,
            ProhibitedGoods.Annex.Select(a => new AnnexItemDto(a.Letter, a.Title)).ToList());
    }

    // =================================================================================================================
    // Painel do Programa
    // =================================================================================================================

    public async Task<ComplianceProgramDto> ProgramAsync(CancellationToken ct)
    {
        var settings = await settingsProvider.GetAsync(ct);
        var now = Now;
        var identity = platform.Current;

        var review = await db.RfInteractions.AsNoTracking()
            .Where(r => r.Type == RfInteractionType.ConsultaMensal && r.Year == now.Year && r.Month == now.Month)
            .Select(r => new { r.CompletedAt, r.CompletedByUserId }).FirstOrDefaultAsync(ct);
        string? reviewer = review?.CompletedByUserId is { } rid ? await db.Users.Where(u => u.Id == rid).Select(u => u.Email).FirstOrDefaultAsync(ct) : null;
        var monthly = new MonthlyReviewDto(now.Year, now.Month, review is not null, review?.CompletedAt, reviewer);

        var cycle = ComplianceBands.CycleStartYear(now.AddYears(-1));
        var (windowStart, windowEnd) = ProgramDeadlines.AnnualManifestationWindow(now.Year);
        var submitted = await db.RfInteractions.AnyAsync(r => r.Type == RfInteractionType.ManifestacaoCiclo && r.Year == cycle, ct);
        var manifestation = new AnnualManifestationDto(cycle, windowStart, windowEnd.AddTicks(-1), now >= windowStart && now < windowEnd, submitted);

        var openReports = await db.ProductReports.CountAsync(r => r.Status == ProductReportStatus.Aberta, ct);
        var overdueReports = await db.ProductReports.CountAsync(r => r.Status == ProductReportStatus.Aberta && r.DueAt < now, ct);
        var openAlerts = await db.MonitoringAlerts.CountAsync(a => a.Status == MonitoringAlertStatus.Aberto, ct);
        var held = await db.MonitoringAlerts.CountAsync(a => a.Status == MonitoringAlertStatus.Aberto && a.HoldsShipments, ct);
        var pendingRf = await db.RfInteractions.AsNoTracking().Where(r => r.Status == RfInteractionStatus.Pendente)
            .Select(r => new { r.Id, r.Title, r.DueAt, r.Type }).ToListAsync(ct);
        var openNotices = await db.SellerNotices.AsNoTracking().Where(n => n.Status == SellerNoticeStatus.Aberta).Select(n => n.DueAt).ToListAsync(ct);
        var answered = await db.SellerNotices.CountAsync(n => n.Status == SellerNoticeStatus.Respondida, ct);
        var sellers = await db.Sellers.AsNoTracking().Where(s => s.Status == SellerStatus.Aprovado).ToListAsync(ct);
        var confirmationDue = sellers.Count(s => SellerGovernanceService.DataConfirmationDueAt(s) <= now);
        var missingAdmission = sellers.Count(s => !s.HasAdmissionData);
        var policyPending = sellers.Count(s => s.PolicyVersionAccepted != settings.SellerPolicyVersion);
        var training = await TrainingsAsync(ct);
        var trainingsDue = training.People.Count(p => p.Due);
        var auditsPlanned = await db.SellerAudits.CountAsync(a => a.Year == now.Year, ct);
        var cpfActive = taxpayers.IsConfigured;

        var tasks = new List<ProgramTaskDto>();
        void Task(string key, string title, string detail, DateTime? due, string href) =>
            tasks.Add(new ProgramTaskDto(key, title, detail, due, due is { } d && d < now, href));

        if (string.IsNullOrWhiteSpace(settings.ProgramOwnerName))
            Task("responsavel", "Definir o Responsável pelo Programa", "Nome e e-mail de quem coordena o Programa e fala com a Receita (item 3).", null, "/admin/configuracoes");
        if (settings.ComplianceProgramApprovedAt is null || settings.SellerPolicyApprovedAt is null)
            Task("aprovacao", "Registrar a aprovação do Programa e da Política", "Data em que a Diretoria ou o sócio administrador aprovou (Programa 14.1; Política 10.1).", null, "/admin/configuracoes");
        if (!identity.IsComplete)
            Task("empresa", "Configurar razão social e CNPJ/TIN da empresa", "Vão na etiqueta, na declaração e na Política publicada.", null, "/admin/integracoes");
        if (!cpfActive)
            Task("cpf", "Contratar a Consulta CPF (Serpro)", cpfOptions.Value.RequireRegistryCheck
                ? "Sem ela a venda não conclui: o CPF do destinatário precisa ser conferido na Receita (Programa 7.2)."
                : "Em demonstração só o dígito verificador é conferido; em produção o CPF e o nome precisam ser conferidos na Receita (7.2).", null, "/admin/integracoes");
        if (!monthly.Done)
            Task("consulta-mensal", $"Consulta mensal dos indicadores — {now:MM/yyyy}", "Consultar os indicadores disponibilizados pela Receita e registrar (11.2).",
                new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(1).AddTicks(-1), "/admin/conformidade/receita");
        if (manifestation.WindowOpen && !manifestation.Submitted)
            Task("manifestacao", $"Manifestação sobre o ciclo {cycle}/{cycle + 1}", "Apresentar de 1º a 31 de outubro (11.8).", manifestation.WindowEnd, "/admin/conformidade/receita");
        foreach (var r in pendingRf.OrderBy(r => r.DueAt ?? DateTime.MaxValue).Take(8))
            Task($"rf:{r.Id}", r.Title, r.Type switch
            {
                RfInteractionType.PlanoDeAcao => "Apresentar o plano de ação corretivo em 30 dias (11.4).",
                RfInteractionType.NotificacaoCorretiva => "Sanear as inconformidades em 30 dias (11.5).",
                RfInteractionType.Ouvidoria => "Responder no prazo da Receita ou em 5 dias úteis (12.2).",
                RfInteractionType.Contestacao => "Aguardando a decisão da Receita.",
                _ => "Pendente.",
            }, r.DueAt, "/admin/conformidade/receita");
        if (overdueReports > 0)
            Task("denuncias", $"{overdueReports} denúncia(s) fora do prazo", "Decidir em até 2 dias úteis do recebimento (Política 6.5).", now.AddTicks(-1), "/admin/denuncias");
        if (openAlerts > 0)
            Task("alertas", $"{openAlerts} alerta(s) de monitoramento", held > 0 ? $"{held} com etiqueta retida." : "Indícios para julgar.", null, "/admin/conformidade/monitoramento");
        if (answered > 0)
            Task("respostas", $"{answered} resposta(s) de vendedores", "Analisar documentos e respostas enviados.", null, "/admin/conformidade/comunicacoes");
        if (trainingsDue > 0)
            Task("capacitacao", $"{trainingsDue} pessoa(s) com capacitação pendente", "No início da função e a cada 12 meses (13.1).", null, "/admin/conformidade/capacitacao");
        if (auditsPlanned == 0)
            Task("auditoria", $"Planejar a auditoria anual de {now.Year}", "Vendedores com infração nos últimos 12 meses e amostra dos demais (Política 7.4).", null, "/admin/conformidade/auditorias");

        return new ComplianceProgramDto(
            string.IsNullOrWhiteSpace(settings.ProgramOwnerName) ? null : settings.ProgramOwnerName,
            string.IsNullOrWhiteSpace(settings.ProgramOwnerEmail) ? null : settings.ProgramOwnerEmail,
            settings.ComplianceProgramApprovedAt, settings.SellerPolicyVersion, settings.SellerPolicyApprovedAt,
            !string.IsNullOrWhiteSpace(identity.AdeNumber), cpfActive || !cpfOptions.Value.RequireRegistryCheck,
            monthly, manifestation, openReports, overdueReports, openAlerts, held,
            pendingRf.Count, pendingRf.Count(r => r.DueAt is { } d && d < now),
            openNotices.Count, openNotices.Count(d => d is { } due && due < now), confirmationDue, missingAdmission, policyPending,
            trainingsDue, auditsPlanned, tasks);
    }

    // =================================================================================================================
    // Capacitação (Programa 13.1)
    // =================================================================================================================

    public async Task<TrainingOverviewDto> TrainingsAsync(CancellationToken ct)
    {
        var records = await db.ComplianceTrainings.AsNoTracking().OrderByDescending(t => t.TrainedAt).ToListAsync(ct);
        var admins = (await db.Users.AsNoTracking().Where(u => u.AnonymizedAt == null && u.BlockedAt == null).Select(u => new { u.Id, u.FullName, u.Email, u.Roles }).ToListAsync(ct))
            .Where(u => u.Roles.Contains(UserRole.Admin)).ToList();
        var now = Now;
        var people = new List<TrainingStatusDto>();
        foreach (var admin in admins)
        {
            var last = records.Where(r => r.UserId == admin.Id || string.Equals(r.PersonEmail, admin.Email, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(r => r.TrainedAt).FirstOrDefault();
            var next = last?.TrainedAt.AddMonths(ProgramDeadlines.TrainingMonths);
            people.Add(new TrainingStatusDto(admin.FullName, admin.Email, admin.Id, last?.Role ?? "Equipe da plataforma", last?.TrainedAt, next, next is null || next <= now));
        }
        foreach (var group in records.Where(r => r.UserId is null || admins.All(a => a.Id != r.UserId))
                     .Where(r => r.PersonEmail is null || admins.All(a => !string.Equals(a.Email, r.PersonEmail, StringComparison.OrdinalIgnoreCase)))
                     .GroupBy(r => (r.PersonEmail ?? r.PersonName).ToLowerInvariant()))
        {
            var last = group.OrderByDescending(r => r.TrainedAt).First();
            var next = last.TrainedAt.AddMonths(ProgramDeadlines.TrainingMonths);
            people.Add(new TrainingStatusDto(last.PersonName, last.PersonEmail, last.UserId, last.Role, last.TrainedAt, next, next <= now));
        }
        return new TrainingOverviewDto(people.OrderByDescending(p => p.Due).ThenBy(p => p.PersonName).ToList(),
            records.Select(r => new ComplianceTrainingDto(r.Id, r.PersonName, r.PersonEmail, r.UserId, r.Role, r.Topic, r.Initial, r.TrainedAt, r.Notes)).ToList());
    }

    public async Task<TrainingOverviewDto> RegisterTrainingAsync(ComplianceTrainingInput input, CancellationToken ct)
    {
        var name = input.PersonName?.Trim() ?? string.Empty;
        var email = string.IsNullOrWhiteSpace(input.PersonEmail) ? null : input.PersonEmail.Trim().ToLowerInvariant();
        var role = input.Role?.Trim() ?? string.Empty;
        var topic = input.Topic?.Trim() ?? string.Empty;
        new ValidationErrors()
            .AddIf(name.Length < 3, "personName", "Informe quem foi capacitado.")
            .AddIf(email is not null && !Domain.Common.Documents.IsValidEmail(email), "personEmail", "E-mail inválido.")
            .AddIf(role.Length < 3, "role", "Informe a função (ex.: atendimento, logística, moderação).")
            .AddIf(topic.Length < 3, "topic", "Informe o tema da capacitação.")
            .AddIf(input.TrainedAt > Now.AddDays(1), "trainedAt", "A data não pode estar no futuro.")
            .AddIf(input.Notes is { Length: > 1000 }, "notes", "Máximo de 1.000 caracteres.")
            .ThrowIfAny();
        Guid? userId = input.UserId;
        if (userId is null && email is not null)
            userId = await db.Users.Where(u => u.Email == email).Select(u => (Guid?)u.Id).FirstOrDefaultAsync(ct);
        db.ComplianceTrainings.Add(new ComplianceTraining
        {
            Id = Guid.NewGuid(),
            PersonName = name,
            PersonEmail = email,
            UserId = userId,
            Role = role,
            Topic = topic,
            Initial = input.Initial,
            TrainedAt = input.TrainedAt ?? Now,
            Notes = input.Notes?.Trim(),
            CreatedAt = Now,
            RegisteredByUserId = currentUser.UserId,
        });
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.training.create", Target = email ?? name, OccurredAt = Now });
        await db.SaveChangesAsync(ct);
        return await TrainingsAsync(ct);
    }

    // =================================================================================================================
    // Auditoria anual (Política 7.4)
    // =================================================================================================================

    public async Task<IReadOnlyList<SellerAuditDto>> AuditsAsync(int? year, CancellationToken ct)
    {
        var source = db.SellerAudits.AsNoTracking();
        if (year is { } y) source = source.Where(a => a.Year == y);
        return await governance.AuditsQuery(source).ToListAsync(ct);
    }

    /// <summary>
    /// Vendedores com infração nos últimos 12 meses e uma amostra dos demais (Política 7.4). Cada um recebe o pedido dos
    /// registros das operações (4.7 e 4.8), com prazo de 10 dias.
    /// </summary>
    public async Task<AuditPlanResultDto> PlanAuditsAsync(AuditPlanRequest request, CancellationToken ct)
    {
        var settings = await settingsProvider.GetAsync(ct);
        var year = request.Year ?? Now.Year;
        if (year < 2024 || year > Now.Year + 1) throw AppException.Validation("year", "Ano inválido.");
        var already = await db.SellerAudits.Where(a => a.Year == year).Select(a => a.SellerId).ToListAsync(ct);
        var sellers = await db.Sellers.AsNoTracking().Where(s => s.Status == SellerStatus.Aprovado || s.Status == SellerStatus.Suspenso)
            .Select(s => new { s.Id, s.Name }).ToListAsync(ct);
        var since = Now.AddMonths(-ProgramDeadlines.AuditMonths);
        var withInfraction = await db.SellerInfractions.Where(i => i.OccurredAt >= since).Select(i => i.SellerId).Distinct().ToListAsync(ct);

        var targets = sellers.Where(s => withInfraction.Contains(s.Id) && !already.Contains(s.Id)).Select(s => (s.Id, s.Name, SellerAuditReason.Infracao)).ToList();
        var others = sellers.Where(s => !withInfraction.Contains(s.Id) && !already.Contains(s.Id)).ToList();
        var sampleSize = others.Count == 0 ? 0 : Math.Max(1, (int)Math.Ceiling(others.Count * settings.AuditSamplePercent / 100.0));
        var random = new Random(HashCode.Combine(year, others.Count));
        targets.AddRange(others.OrderBy(_ => random.Next()).Take(sampleSize).Select(s => (s.Id, s.Name, SellerAuditReason.Amostra)));

        foreach (var (sellerId, _, reason) in targets)
        {
            var audit = new SellerAudit { Id = Guid.NewGuid(), SellerId = sellerId, Year = year, Reason = reason, PlannedAt = Now, PlannedByUserId = currentUser.UserId };
            var notice = governance.Notify(sellerId, SellerNoticeType.SolicitacaoDocumentos, $"Auditoria anual {year}: envie os registros das suas operações",
                "A plataforma audita a cada 12 meses os vendedores com infração registrada e uma amostra dos demais (Política de Vendedores, item 7.4). " +
                "Envie os registros das suas operações na plataforma: notas ou faturas das vendas e das compras dos produtos, comprovantes de envio e " +
                "os documentos que comprovem a origem e a autenticidade dos produtos (itens 4.7 e 4.8).",
                Now.AddDays(ProgramDeadlines.SellerResponseDays), auditId: audit.Id, documentKind: DocumentRequestKind.Registros);
            audit.NoticeId = notice.Id;
            db.SellerAudits.Add(audit);
        }
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.audit.plan", Target = year.ToString(), OccurredAt = Now, Details = $"{targets.Count} loja(s)" });
        await db.SaveChangesAsync(ct);
        var audits = await AuditsAsync(year, ct);
        return new AuditPlanResultDto(year, targets.Count(t => t.Item3 == SellerAuditReason.Infracao), targets.Count(t => t.Item3 == SellerAuditReason.Amostra), audits);
    }

    public async Task<SellerAuditDto> CompleteAuditAsync(Guid id, AuditCompleteRequest request, CancellationToken ct)
    {
        var audit = await db.SellerAudits.FirstOrDefaultAsync(a => a.Id == id, ct) ?? throw AppException.NotFound("Auditoria");
        if (audit.Status == SellerAuditStatus.Concluida) throw AppException.Conflict("AUDIT_DONE", "Auditoria já concluída.");
        var findings = request.Findings?.Trim() ?? string.Empty;
        new ValidationErrors()
            .AddIf(findings.Length < 10, "findings", "Registre o que foi verificado e as conclusões.")
            .AddIf(findings.Length > 4000, "findings", "Máximo de 4.000 caracteres.")
            .ThrowIfAny();
        audit.Status = SellerAuditStatus.Concluida;
        audit.Outcome = request.Outcome;
        audit.Findings = findings;
        audit.CompletedAt = Now;
        audit.CompletedByUserId = currentUser.UserId;
        governance.Notify(audit.SellerId, SellerNoticeType.Aviso, $"Auditoria anual {audit.Year} concluída",
            request.Outcome == SellerAuditOutcome.Conforme
                ? "A auditoria de conformidade da sua loja foi concluída sem inconformidades."
                : $"A auditoria de conformidade encontrou inconformidades:\n\n{findings}", auditId: audit.Id);
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.audit.complete", Target = audit.Id.ToString(), OccurredAt = Now, Details = request.Outcome.ToString() });
        await db.SaveChangesAsync(ct);
        return await governance.AuditsQuery(db.SellerAudits.AsNoTracking().Where(a => a.Id == id)).FirstAsync(ct);
    }

    // =================================================================================================================
    // Dossiê para as autoridades (Programa 8.8; Política 9.1)
    // =================================================================================================================

    /// <summary>
    /// Dados cadastrais e histórico de transações da loja, para atender autoridades competentes. Cada exportação fica na
    /// auditoria e no registro de ações.
    /// </summary>
    public async Task<object> SellerDossierAsync(Guid sellerId, string? purpose, CancellationToken ct)
    {
        var why = purpose?.Trim();
        if (why is null || why.Length < 5) throw AppException.Validation("purpose", "Informe a autoridade e o motivo do pedido (fica registrado).");
        var seller = await db.Sellers.AsNoTracking().Include(s => s.Categories).ThenInclude(c => c.Category).FirstOrDefaultAsync(s => s.Id == sellerId, ct)
                     ?? throw AppException.NotFound("Loja");
        var owner = seller.OwnerUserId is { } oid ? await db.Users.AsNoTracking().Where(u => u.Id == oid).Select(u => new { u.FullName, u.Email, u.Phone }).FirstOrDefaultAsync(ct) : null;
        var acceptances = await db.SellerPolicyAcceptances.AsNoTracking().Where(a => a.SellerId == sellerId).OrderBy(a => a.AcceptedAt).ToListAsync(ct);
        var products = await db.Products.AsNoTracking().Where(p => p.SellerId == sellerId).OrderBy(p => p.CreatedAt)
            .Select(p => new { p.Id, p.Slug, p.Name, p.HsCode, p.Nature, p.Brand, p.Model, p.Material, p.PackageQuantity, p.OriginCountry, p.PriceAmount, Status = p.Status.ToString(), p.ModerationReason, p.CreatedAt, p.UpdatedAt })
            .ToListAsync(ct);
        var orders = await db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.Shipment).Where(o => o.SellerId == sellerId).OrderBy(o => o.CreatedAt).ToListAsync(ct);
        var occurrences = await db.ComplianceOccurrences.AsNoTracking().Where(o => o.SellerId == sellerId).OrderBy(o => o.OccurredAt).ToListAsync(ct);
        var infractions = await db.SellerInfractions.AsNoTracking().Where(i => i.SellerId == sellerId).OrderBy(i => i.OccurredAt).ToListAsync(ct);
        var measures = await db.SellerMeasures.AsNoTracking().Where(m => m.SellerId == sellerId).OrderBy(m => m.AppliedAt).ToListAsync(ct);
        var reports = await db.ProductReports.AsNoTracking().Where(r => r.SellerId == sellerId).OrderBy(r => r.CreatedAt).ToListAsync(ct);

        governance.LogAction(EnforcementActionKind.InformacoesAutoridades, why, "Dossiê com dados cadastrais e histórico de transações exportado.", sellerId);
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "admin.seller.dossier", Target = seller.Slug, OccurredAt = Now, IpAddress = currentUser.IpAddress, Details = why.Length > 500 ? why[..500] : why });
        await db.SaveChangesAsync(ct);

        return new
        {
            generatedAt = Now,
            generatedBy = currentUser.Email,
            purpose = why,
            platform = platform.Current,
            seller = new
            {
                seller.Id, seller.Slug, storeName = seller.Name, seller.LegalName, seller.Ruc, seller.Email, seller.Phone, seller.City, seller.Country,
                seller.LegalAddress, seller.OriginPostalCode, status = seller.Status.ToString(), seller.MemberSince, seller.VerifiedAt, seller.VerificationChecklist,
                seller.SuspendedAt, seller.SuspendedUntil, seller.ExcludedAt, seller.SuspensionReason, seller.DataConfirmedAt,
                representative = new { name = seller.ResponsibleName, documentType = seller.ResponsibleDocumentType?.ToString(), document = seller.ResponsibleDocument },
                payout = new { method = seller.PayoutMethod?.ToString(), institution = seller.PayoutInstitution, account = seller.PayoutAccount, holder = seller.PayoutHolder },
                documents = new
                {
                    identity = documents.Url(seller.IdentityDocumentUrl),
                    rucCertificate = documents.Url(seller.RucCertificateUrl),
                    taxCompliance = documents.Url(seller.TaxComplianceCertificateUrl),
                    articlesOfIncorporation = documents.Url(seller.ArticlesOfIncorporationUrl),
                },
                categories = seller.Categories.Select(c => c.Category.Name),
                owner,
            },
            policyAcceptances = acceptances.Select(a => new { a.PolicyVersion, a.AcceptedAt, a.RepresentativeName, a.IpAddress, a.UserAgent }),
            products,
            transactions = orders.Select(o => new
            {
                o.Number, o.CreatedAt, status = o.Status.ToString(), o.SubtotalAmount, o.ShippingAmount, o.DiscountAmount, o.ImportTaxAmount, o.TotalAmount,
                destination = new { o.ShippingAddress.City, o.ShippingAddress.State, o.ShippingAddress.PostalCode },
                items = o.Items.Select(i => new { i.Name, i.VariantLabel, i.Quantity, i.UnitPriceAmount, i.LineTotalAmount, i.HsCode, i.OriginCountry, i.DeclarationDescription }),
                shipment = o.Shipment is null ? null : new { o.Shipment.TrackingCode, o.Shipment.Carrier, o.Shipment.DeclarationNumber, o.Shipment.DirNumber, o.Shipment.CustomsStatus, o.Shipment.PostedAt },
            }),
            occurrences = occurrences.Select(o => new { o.Indicator, o.Source, o.Status, o.Code, o.Description, o.OccurredAt }),
            infractions = infractions.Select(i => new { i.Code, i.Description, i.Severity, i.Intentional, i.OccurredAt, i.Recidivist }),
            measures = measures.Select(m => new { m.Type, m.Reason, m.AppliedAt, m.EndsAt, m.RevokedAt, m.RevocationReason }),
            reports = reports.Select(r => new { r.Protocol, r.Reason, r.Details, r.Status, r.CreatedAt, r.ResolvedAt, r.ResolutionNote }),
        };
    }
}
