using Marketplace.Domain;
using Marketplace.Domain.Common;

namespace Marketplace.Application.Contracts;

// ----- Denúncia de produto (comprador) -----

public sealed record ProductReportRequest(ProductReportReason Reason, string? Details);

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
    Guid? OccurrenceId);

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
    string? StatusReason);

public sealed record ComplianceOccurrenceInput(
    ComplianceIndicator Indicator,
    OccurrenceSource Source,
    string? Code,
    string? Description,
    Guid? SellerId,
    Guid? ProductId,
    string? OrderNumber,
    DateTime? OccurredAt);

/// <summary>Contestação (erro material, falha de sistema, duplicidade) ou anulação.</summary>
public sealed record OccurrenceStatusRequest(OccurrenceStatus Status, string? Reason);

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

public sealed record SellerVerificationRequest(bool Approve, string? Note);

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
    string? LastError);

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
