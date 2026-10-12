using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Application.Services;
using Marketplace.Domain;
using Marketplace.Infrastructure.Storage;

namespace Marketplace.Api.Endpoints;

/// <summary>
/// Programa de Conformidade Tributária e Aduaneira e Política de Admissão e de Monitoramento de Vendedores: Política
/// publicada, canal público de denúncias, documentos privados, comunicações e situação da loja (vendedor) e o painel do
/// Programa (admin: monitoramento, Receita Federal, capacitação, ações, auditorias, medidas e dossiê).
/// </summary>
public static class ComplianceEndpoints
{
    public static RouteGroupBuilder MapCompliancePublic(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("").WithTags("Conformidade (público)");

        // Política 2.3 e 2.4: a Política fica disponível na plataforma, com a versão e a empresa.
        g.MapGet("/policies/seller", (ComplianceProgramService svc, CancellationToken ct) => svc.SellerPolicyAsync(ct))
            .CacheOutput("catalog");

        // Política 6.4: canal aberto a qualquer pessoa, cadastrada ou não.
        g.MapPost("/reports", async (PublicReportRequest body, ComplianceService svc, CancellationToken ct) =>
                Results.Created("/api/reports", await svc.SubmitPublicReportAsync(body, ct)))
            .AllowAnonymous()
            .RequireRateLimiting("reports");

        return api;
    }

    /// <summary>Documentos privados: upload com token e leitura só por link assinado (Política 9.4).</summary>
    public static RouteGroupBuilder MapDocuments(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("").WithTags("Documentos");

        g.MapPost("/seller/documents/uploads", async (DocumentUploadRequest body, IDocumentStorage storage, DocumentLinks links, CancellationToken ct) =>
                await CreateUploadAsync(body, storage, links, ct))
            // Os documentos vão no cadastro da loja, antes do papel Vendedor existir: basta estar logado.
            .RequireAuthorization()
            .RequireRateLimiting("sensitive");

        g.MapPost("/admin/documents/uploads", async (DocumentUploadRequest body, IDocumentStorage storage, DocumentLinks links, CancellationToken ct) =>
                await CreateUploadAsync(body, storage, links, ct))
            .RequireAuthorization(p => p.RequireRole(nameof(UserRole.Admin)));

        g.MapPut("/documents/{**key}", async (string key, string token, HttpRequest request, LocalDocumentStorage storage, CancellationToken ct) =>
        {
            var claims = storage.ValidateToken(token) ?? throw AppException.Unauthorized("Token de upload inválido ou expirado.");
            if (claims.Key != key) throw AppException.Unauthorized("Token não corresponde ao arquivo.");
            if (request.ContentLength is { } len && len > claims.Size) throw AppException.Validation("sizeBytes", "Arquivo maior que o declarado.");
            await storage.SaveAsync(key, request.Body, claims.Size, claims.ContentType, ct);
            return Results.NoContent();
        }).AllowAnonymous().DisableAntiforgery();

        // Link assinado e temporário emitido pela API para quem pode ver (o vendedor dono ou o admin).
        g.MapGet("/documents/{**key}", async (string key, string? t, IDocumentStorage storage, DocumentLinks links, HttpResponse response, CancellationToken ct) =>
        {
            if (!links.Validate(key, t)) throw AppException.NotFound("Documento");
            var document = await storage.OpenAsync(key, ct) ?? throw AppException.NotFound("Documento");
            response.Headers.CacheControl = "private, no-store";
            response.Headers["X-Content-Type-Options"] = "nosniff";
            return Results.Stream(document.Content, document.ContentType, document.FileName);
        }).AllowAnonymous();

        return api;
    }

    private static async Task<PresignedUpload> CreateUploadAsync(DocumentUploadRequest body, IDocumentStorage storage, DocumentLinks links, CancellationToken ct)
    {
        new ValidationErrors()
            .AddIf(string.IsNullOrWhiteSpace(body.FileName), "fileName", "Informe o nome do arquivo.")
            .AddIf(string.IsNullOrWhiteSpace(body.ContentType), "contentType", "Informe o tipo do arquivo.")
            .ThrowIfAny();
        var upload = await storage.CreateUploadAsync(body.FileName!, body.ContentType!, body.SizeBytes, ct);
        // publicUrl: link assinado para pré-visualizar logo depois do envio; storageKey é o que o formulário grava.
        return upload with { PublicUrl = links.Url(upload.StorageKey)! };
    }

    public static RouteGroupBuilder MapSellerCompliance(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/seller").WithTags("Painel do vendedor — conformidade").RequireAuthorization();

        g.MapGet("/compliance", (SellerPanelService svc, CancellationToken ct) => svc.ComplianceStatusAsync(ct));
        g.MapPost("/profile/confirm", (SellerPanelService svc, CancellationToken ct) => svc.ConfirmDataAsync(ct));
        g.MapPost("/policy/accept", (SellerPolicyAcceptRequest body, SellerPanelService svc, CancellationToken ct) => svc.AcceptPolicyAsync(body, ct));
        g.MapGet("/notices", (string? status, int? page, int? pageSize, SellerPanelService svc, CancellationToken ct) =>
            svc.NoticesAsync(Enum.TryParse<SellerNoticeStatus>(status, true, out var s) ? s : null, page, pageSize, ct));
        g.MapGet("/notices/{id:guid}", (Guid id, SellerPanelService svc, CancellationToken ct) => svc.NoticeAsync(id, ct));
        g.MapPost("/notices/{id:guid}/respond", (Guid id, SellerNoticeResponseRequest body, SellerPanelService svc, CancellationToken ct) =>
            svc.RespondNoticeAsync(id, body, ct));
        g.MapGet("/orders/{id:guid}/receipt", async (Guid id, SellerPanelService svc, CancellationToken ct) =>
        {
            var document = await svc.ReceiptAsync(id, ct);
            return Results.File(document.Content, document.ContentType, document.FileName);
        });
        return api;
    }

    public static RouteGroupBuilder MapAdminCompliance(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/admin").WithTags("Administração — Programa de Conformidade")
            .RequireAuthorization(p => p.RequireRole(nameof(UserRole.Admin)));

        g.MapGet("/compliance/program", (ComplianceProgramService svc, CancellationToken ct) => svc.ProgramAsync(ct));
        g.MapPost("/compliance/monitor/run", (ComplianceMonitor svc, CancellationToken ct) => svc.RunAsync(ct));

        // Monitoramento (Programa 6; Política 7.3)
        g.MapGet("/compliance/alerts", (string? status, string? type, int? page, int? pageSize, MonitoringService svc, CancellationToken ct) =>
            svc.ListAsync(Enum.TryParse<MonitoringAlertStatus>(status, true, out var s) ? s : null,
                Enum.TryParse<MonitoringAlertType>(type, true, out var t) ? t : null, page, pageSize, ct));
        g.MapPost("/compliance/alerts/{id:guid}/resolve", (Guid id, MonitoringAlertResolveRequest body, MonitoringService svc, CancellationToken ct) =>
            svc.ResolveAsync(id, body, ct));

        // Receita Federal (Programa 3, 11 e 12)
        g.MapGet("/compliance/rf", (string? type, string? status, int? page, int? pageSize, ReceitaRelationsService svc, CancellationToken ct) =>
            svc.ListAsync(Enum.TryParse<RfInteractionType>(type, true, out var t) ? t : null,
                Enum.TryParse<RfInteractionStatus>(status, true, out var s) ? s : null, page, pageSize, ct));
        g.MapPost("/compliance/rf", async (RfInteractionInput body, ReceitaRelationsService svc, CancellationToken ct) =>
            Results.Created("/api/admin/compliance/rf", await svc.CreateAsync(body, ct)));
        g.MapPost("/compliance/rf/{id:guid}/complete", (Guid id, RfInteractionCompleteRequest body, ReceitaRelationsService svc, CancellationToken ct) =>
            svc.CompleteAsync(id, body, ct));
        g.MapPost("/compliance/contestations", async (ContestationRequest body, ReceitaRelationsService svc, CancellationToken ct) =>
            Results.Created("/api/admin/compliance/rf", await svc.ContestAndSaveAsync(body, ct)));

        // Capacitação (13.1)
        g.MapGet("/compliance/trainings", (ComplianceProgramService svc, CancellationToken ct) => svc.TrainingsAsync(ct));
        g.MapPost("/compliance/trainings", (ComplianceTrainingInput body, ComplianceProgramService svc, CancellationToken ct) =>
            svc.RegisterTrainingAsync(body, ct));

        // Registro das ações contra produtos ilegais (8.9; Política 6.8)
        g.MapGet("/compliance/actions", (string? kind, Guid? sellerId, int? page, int? pageSize, SellerGovernanceService svc, CancellationToken ct) =>
            svc.ListActionsAsync(Enum.TryParse<EnforcementActionKind>(kind, true, out var k) ? k : null, sellerId, page, pageSize, ct));

        // Auditoria anual (Política 7.4)
        g.MapGet("/compliance/audits", (int? year, ComplianceProgramService svc, CancellationToken ct) => svc.AuditsAsync(year, ct));
        g.MapPost("/compliance/audits/plan", (AuditPlanRequest body, ComplianceProgramService svc, CancellationToken ct) => svc.PlanAuditsAsync(body, ct));
        g.MapPost("/compliance/audits/{id:guid}/complete", (Guid id, AuditCompleteRequest body, ComplianceProgramService svc, CancellationToken ct) =>
            svc.CompleteAuditAsync(id, body, ct));

        // Comunicações com os vendedores (Política 4.6, 6.2, 8.4 a 8.6)
        g.MapGet("/compliance/notices", (string? status, string? type, Guid? sellerId, int? page, int? pageSize, SellerGovernanceService svc, CancellationToken ct) =>
            svc.ListNoticesAsync(sellerId, Enum.TryParse<SellerNoticeStatus>(status, true, out var s) ? s : null,
                Enum.TryParse<SellerNoticeType>(type, true, out var t) ? t : null, page, pageSize, ct));
        g.MapPost("/notices/{id:guid}/resolve", (Guid id, SellerNoticeResolveRequest body, SellerGovernanceService svc, CancellationToken ct) =>
            svc.ResolveNoticeAsync(id, body, ct));
        g.MapPost("/sellers/{id:guid}/notices", async (Guid id, SellerNoticeCreateRequest body, SellerGovernanceService svc, CancellationToken ct) =>
            Results.Created($"/api/admin/sellers/{id}", await svc.CreateNoticeAsync(id, body, ct)));

        // Infrações e medidas (Política 8)
        g.MapPost("/sellers/{id:guid}/infractions", async (Guid id, SellerInfractionInput body, SellerGovernanceService svc, CancellationToken ct) =>
            Results.Created($"/api/admin/sellers/{id}", await svc.RegisterInfractionAsync(id, body, ct)));
        g.MapPost("/sellers/{id:guid}/measures", async (Guid id, SellerMeasureInput body, SellerGovernanceService svc, CancellationToken ct) =>
            Results.Created($"/api/admin/sellers/{id}", await svc.ApplyMeasureAsync(id, body, ct)));
        g.MapPost("/sellers/{id:guid}/measures/{measureId:guid}/revoke", (Guid id, Guid measureId, RevokeMeasureRequest body, SellerGovernanceService svc, CancellationToken ct) =>
            svc.RevokeMeasureAsync(id, measureId, body, ct));

        // Dossiê para autoridades (Programa 8.8; Política 9.1)
        g.MapPost("/sellers/{id:guid}/dossier", async (Guid id, DossierRequest body, ComplianceProgramService svc, JsonSerializerOptions json, CancellationToken ct) =>
        {
            var dossier = await svc.SellerDossierAsync(id, body.Purpose, ct);
            var bytes = JsonSerializer.SerializeToUtf8Bytes(dossier, new JsonSerializerOptions(json) { WriteIndented = true });
            return Results.File(bytes, "application/json", $"dossie-loja-{id.ToString()[..8]}-{DateTime.UtcNow:yyyyMMdd}.json");
        }).RequireRateLimiting("sensitive");

        // Comprovante do pedido (Programa 10.3)
        g.MapGet("/orders/{id}/receipt", async (string id, AdminService svc, CancellationToken ct) =>
        {
            var document = await svc.ReceiptAsync(id, ct);
            return Results.File(document.Content, document.ContentType, document.FileName);
        });

        return api;
    }

    public sealed record DossierRequest(string? Purpose);
}
