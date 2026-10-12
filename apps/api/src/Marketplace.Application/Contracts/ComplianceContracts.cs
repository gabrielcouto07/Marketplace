using Marketplace.Domain;
using Marketplace.Domain.Common;

namespace Marketplace.Application.Contracts;

// ----- Denúncia de produto (comprador) -----

/// <summary>Denúncia pela página do produto: com ou sem login (canal aberto a qualquer pessoa, Política 6.4).</summary>
public sealed record ProductReportRequest(
    ProductReportReason Reason,
    string? Details,
    string? ReporterName = null,
    string? ReporterEmail = null,
    bool IsRightsHolder = false,
    string? RightsHolderName = null,
    IReadOnlyList<string>? EvidenceUrls = null,
    string? Website = null);

public sealed record ProductReportDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string ProductSlug,
    ProductStatus ProductStatus,
    Guid SellerId,
    string SellerName,
    ProductReportReason Reason,
    string Details,
    ProductReportStatus Status,
    DateTime CreatedAt,
    string? ReporterEmail,
    DateTime? ResolvedAt,
    string? ResolutionNote,
    Guid? OccurrenceId,
    string? Protocol = null,
    ReportChannel Channel = ReportChannel.PaginaDoProduto,
    string? ReporterName = null,
    bool IsRightsHolder = false,
    string? RightsHolderName = null,
    IReadOnlyList<string>? EvidenceUrls = null,
    /// <summary>Prazo da decisão: 2 dias úteis (Política 6.5).</summary>
    DateTime? DueAt = null,
    bool Overdue = false);

/// <summary>Procedente gera ocorrência no indicador escolhido (padrão: o que a denúncia aponta) e pode bloquear o produto.</summary>
public sealed record ProductReportResolveRequest(bool Upheld, ComplianceIndicator? Indicator, bool BlockProduct, string? Note);

// ----- Ocorrências e indicadores (Portaria Coana 193/2026) -----

public sealed record ComplianceOccurrenceDto(
    Guid Id,
    ComplianceIndicator Indicator,
    OccurrenceSource Source,
    OccurrenceStatus Status,
    string Code,
    string Description,
    Guid? SellerId,
    string? SellerName,
    Guid? ProductId,
    string? ProductName,
    Guid? OrderId,
    string? OrderNumber,
    string? ExternalId,
    DateTime OccurredAt,
    DateTime RegisteredAt,
    string? StatusReason,
    ContestationReason? ContestationReason = null,
    string? ContestationGrounds = null,
    DateTime? ContestedAt = null,
    Guid? RfInteractionId = null);

public sealed record ComplianceOccurrenceInput(
    ComplianceIndicator Indicator,
    OccurrenceSource Source,
    string? Code,
    string? Description,
    Guid? SellerId,
    Guid? ProductId,
    string? OrderNumber,
    DateTime? OccurredAt);

/// <summary>
/// Contestação (só por erro material, inconsistência sistêmica ou impropriedade na metodologia — Programa 11.6, com
/// fundamentação e evidências — 11.7), anulação (a Receita acolheu) ou confirmação.
/// </summary>
public sealed record OccurrenceStatusRequest(
    OccurrenceStatus Status,
    string? Reason,
    ContestationReason? ContestationReason = null,
    string? Grounds = null,
    IReadOnlyList<string>? Evidence = null,
    string? Reference = null);

public sealed record ComplianceIndicatorDto(
    ComplianceIndicator Indicator,
    int Occurrences,
    /// <summary>Remessas sem ocorrência, em centésimos de % (9970 = 99,70%).</summary>
    int CompliancePermyriad,
    ComplianceBand Band,
    string Consequence);

public sealed record ComplianceMonthDto(int Year, int Month, int Shipments, IReadOnlyList<ComplianceIndicatorDto> Indicators);

public sealed record SellerRiskDto(Guid SellerId, string SellerName, SellerStatus Status, int Occurrences, int OpenReports);

public sealed record ComplianceDashboardDto(
    int CycleStartYear,
    DateRange Cycle,
    int CycleShipments,
    /// <summary>Selos saem em dezembro para quem movimentou ao menos 100 mil remessas no ciclo.</summary>
    bool SealEligible,
    int SealMinimumShipments,
    IReadOnlyList<ComplianceIndicatorDto> CycleIndicators,
    IReadOnlyList<ComplianceMonthDto> Months,
    IReadOnlyList<SellerRiskDto> SellersAtRisk,
    int OpenReports,
    int ProductsInReview,
    int PendingSellerVerifications,
    int StrikeLimit,
    int StrikeWindowDays);

// ----- Moderação -----

/// <summary>Aprovar (vai à vitrine e grava nome/preço liberados) ou Bloquear (sai da vitrine; vendedor não reativa).</summary>
public sealed record ProductModerationRequest(string? Action, string? Reason, string? Note);

/// <param name="Checks">Itens conferidos pela equipe (Política 3.3): aprovar exige todos de <c>SellerGovernanceService.VerificationItems</c>.</param>
public sealed record SellerVerificationRequest(bool Approve, string? Note, IReadOnlyList<string>? Checks = null);

// ----- Remessas no admin -----

public sealed record AdminShipmentListItemDto(
    Guid Id,
    Guid OrderId,
    string OrderNumber,
    string SellerName,
    ShipmentStatus Status,
    string Provider,
    bool Sandbox,
    string? TrackingCode,
    string? DeclarationNumber,
    string? DirNumber,
    string? CustomsStatus,
    TaxRemittanceStatus? RemittanceStatus,
    Money Taxes,
    DateTime CreatedAt,
    string? LastError,
    /// <summary>Conferências feitas antes de registrar a remessa (Programa 6.3 e 7.1 a 7.6).</summary>
    IReadOnlyList<ShipmentCheckDto>? Checks = null);

public sealed record ShipmentCheckDto(string Check, bool Ok, string Detail);

// ----- Integrações (governo e operador) -----

/// <summary>
/// Situação de cada integração. Configured = credencial presente; o que falta aparece em Missing, com o nome exato da
/// variável de ambiente.
/// </summary>
public sealed record IntegrationStatusDto(
    string Key,
    string Name,
    string Purpose,
    string Provider,
    bool Configured,
    bool RequiresCredential,
    string Mode,
    IReadOnlyList<string> Missing,
    string? Detail,
    string DocsUrl);

// ----- Estimativa pública -----

public sealed record NcmLookupDto(string Code, string Formatted, string Description, bool Official);
