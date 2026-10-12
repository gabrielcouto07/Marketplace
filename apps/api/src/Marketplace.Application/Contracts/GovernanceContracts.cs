using Marketplace.Domain;

namespace Marketplace.Application.Contracts;

// =====================================================================================================================
// Programa de Conformidade Tributária e Aduaneira e Política de Admissão e de Monitoramento de Vendedores
// =====================================================================================================================

// ----- Política de Vendedores (pública: Política 2.3 e 2.4) -----

public sealed record AnnexItemDto(string Letter, string Title);

/// <summary>Dados que completam o texto da Política publicada: versão, aprovação e identificação da empresa.</summary>
public sealed record SellerPolicyInfoDto(
    string Version,
    DateTime? ApprovedAt,
    string Brand,
    string? CompanyLegalName,
    string? CompanyDocumentType,
    string? CompanyDocument,
    string? CompanyAddress,
    string PlatformUrl,
    IReadOnlyList<AnnexItemDto> Annex);

// ----- Canal de denúncias (público, sem login: Política 6.4) -----

/// <param name="Product">Link, slug ou id do anúncio.</param>
/// <param name="Website">Campo isca: preenchido só por robôs.</param>
public sealed record PublicReportRequest(
    string? Product,
    ProductReportReason Reason,
    string? Details,
    string? ReporterName,
    string? ReporterEmail,
    bool IsRightsHolder,
    string? RightsHolderName,
    IReadOnlyList<string>? EvidenceUrls,
    string? Website = null);

public sealed record ReportReceiptDto(Guid Id, string Protocol, DateTime DueAt, Guid ProductId, string ProductName);

// ----- Documentos privados (cadastro, respostas, evidências) -----

public sealed record DocumentUploadRequest(string? FileName, string? ContentType, long SizeBytes);

/// <summary>Referência a um documento: a chave guardada e um link temporário para abrir (15 min).</summary>
public sealed record DocumentRefDto(string Key, string Url, string Name);

// ----- Comunicações ao vendedor (Política 4.6, 6.2, 8.4 a 8.6, 10.3) -----

public sealed record SellerNoticeDto(
    Guid Id,
    Guid SellerId,
    string SellerName,
    SellerNoticeType Type,
    SellerNoticeStatus Status,
    DocumentRequestKind? DocumentKind,
    string Title,
    string Message,
    Guid? ProductId,
    string? ProductName,
    string? ProductSlug,
    Guid? OrderId,
    string? OrderNumber,
    Guid? MeasureId,
    DateTime CreatedAt,
    DateTime? DueAt,
    bool Overdue,
    DateTime? ReadAt,
    string? ResponseText,
    IReadOnlyList<DocumentRefDto> ResponseFiles,
    DateTime? RespondedAt,
    string? Resolution,
    DateTime? ResolvedAt);

public sealed record SellerNoticeResponseRequest(string? Text, IReadOnlyList<string>? Files);

/// <summary>Admin: pedido de documentos, correção de dados ou aviso.</summary>
public sealed record SellerNoticeCreateRequest(
    SellerNoticeType Type,
    DocumentRequestKind? DocumentKind,
    Guid? ProductId,
    string? OrderNumber,
    string? Title,
    string? Message);

/// <summary>Admin: aceita (documentos comprovam / dados corrigidos) ou recusa a resposta e encerra.</summary>
public sealed record SellerNoticeResolveRequest(bool Accepted, string? Resolution);

// ----- Infrações e medidas (Política 1.1 d, 7.2, 8.1 a 8.3) -----

public sealed record SellerInfractionInput(
    string? Code,
    string? Description,
    InfractionSeverity Severity,
    bool Intentional,
    Guid? ProductId,
    string? OrderNumber,
    DateTime? OccurredAt);

public sealed record SellerInfractionDto(
    Guid Id,
    string Code,
    string Description,
    InfractionSeverity Severity,
    bool Intentional,
    Guid? ProductId,
    string? ProductName,
    string? OrderNumber,
    DateTime OccurredAt,
    DateTime RegisteredAt,
    bool Recidivist);

/// <summary>Medida sugerida pela graduação do item 8.2 (a equipe decide).</summary>
public sealed record MeasureRecommendationDto(SellerMeasureType Type, int? SuspensionDays, int PriorInfractions, bool Recidivist, string Rationale);

public sealed record SellerInfractionResultDto(SellerInfractionDto Infraction, MeasureRecommendationDto Recommendation);

public sealed record SellerMeasureInput(SellerMeasureType Type, string? Reason, Guid? InfractionId, Guid? ProductId, int? SuspensionDays);

public sealed record SellerMeasureDto(
    Guid Id,
    SellerMeasureType Type,
    string Reason,
    Guid? InfractionId,
    Guid? ProductId,
    string? ProductName,
    DateTime AppliedAt,
    bool Automatic,
    DateTime? EndsAt,
    DateTime? RevokedAt,
    string? RevocationReason,
    bool Active,
    Guid? NoticeId);

public sealed record RevokeMeasureRequest(string? Reason);

// ----- Aceite da Política (Política 2.2 e 10.3) -----

public sealed record SellerPolicyAcceptanceDto(
    string PolicyVersion,
    DateTime AcceptedAt,
    string RepresentativeName,
    string? RepresentativeDocumentMasked,
    string? IpAddress);

public sealed record SellerPolicyAcceptRequest(bool Accept, string? RepresentativeName);

// ----- Situação da loja no painel do vendedor -----

public sealed record SellerComplianceStatusDto(
    SellerStatus Status,
    string? SuspensionReason,
    DateTime? SuspendedUntil,
    string PolicyVersion,
    string? PolicyVersionAccepted,
    bool PolicyAcceptanceRequired,
    DateTime? DataConfirmedAt,
    DateTime DataConfirmationDueAt,
    bool DataConfirmationDue,
    bool AdmissionDataComplete,
    IReadOnlyList<string> MissingAdmissionData,
    int OpenNotices,
    int OverdueNotices,
    int Infractions12Months,
    IReadOnlyList<SellerMeasureDto> ActiveMeasures);

// ----- Governança da loja no admin -----

public sealed record SellerAuditDto(
    Guid Id,
    Guid SellerId,
    string SellerName,
    int Year,
    SellerAuditReason Reason,
    SellerAuditStatus Status,
    DateTime PlannedAt,
    Guid? NoticeId,
    SellerAuditOutcome? Outcome,
    string? Findings,
    DateTime? CompletedAt);

public sealed record SellerGovernanceDto(
    IReadOnlyList<SellerNoticeDto> Notices,
    IReadOnlyList<SellerInfractionDto> Infractions,
    IReadOnlyList<SellerMeasureDto> Measures,
    IReadOnlyList<SellerPolicyAcceptanceDto> Acceptances,
    IReadOnlyList<SellerAuditDto> Audits,
    /// <summary>Lojas excluídas com dados ou documentos em comum (Política 3.5).</summary>
    IReadOnlyList<string> ReRegistrationMatches,
    int Infractions12Months,
    bool Recidivist);

// ----- Monitoramento (Programa 6; Política 7.3) -----

public sealed record MonitoringAlertDto(
    Guid Id,
    MonitoringAlertType Type,
    MonitoringAlertStatus Status,
    Guid? SellerId,
    string? SellerName,
    Guid? BuyerUserId,
    string? BuyerEmail,
    string Summary,
    IReadOnlyList<string> OrderNumbers,
    bool HoldsShipments,
    DateTime DetectedAt,
    AlertAttribution? Attribution,
    string? ResolutionNote,
    DateTime? ResolvedAt);

/// <param name="RegisterInfraction">Procedente e atribuído ao vendedor: registra a infração (6.5).</param>
public sealed record MonitoringAlertResolveRequest(bool Upheld, AlertAttribution? Attribution, string? Note, bool RegisterInfraction, InfractionSeverity? Severity);

public sealed record MonitoringRunResultDto(
    int NewAlerts,
    int ListingsFlagged,
    int NoticesCreated,
    int SellersSuspended,
    int SuspensionsLifted);

// ----- Relacionamento com a Receita Federal (Programa 3, 11 e 12) -----

public sealed record RfInteractionDto(
    Guid Id,
    RfInteractionType Type,
    RfInteractionStatus Status,
    string Title,
    string Description,
    string? Reference,
    DateTime OpenedAt,
    DateTime? DueAt,
    bool Overdue,
    ComplianceIndicator? Indicator,
    ContestationReason? ContestationReason,
    IReadOnlyList<Guid> OccurrenceIds,
    int? Year,
    int? Month,
    int? OfficialCounterfeitPermyriad,
    int? OfficialUndervaluationPermyriad,
    int? OfficialDeclarationQualityPermyriad,
    string? Response,
    IReadOnlyList<DocumentRefDto> Attachments,
    DateTime? CompletedAt,
    string? CompletedBy,
    DateTime CreatedAt,
    string? CreatedBy);

public sealed record RfInteractionInput(
    RfInteractionType Type,
    string? Title,
    string? Description,
    string? Reference,
    DateTime? OpenedAt,
    /// <summary>Prazo fixado pela Receita (ouvidoria); sem ele vale o prazo do Programa.</summary>
    DateTime? DueAt,
    ComplianceIndicator? Indicator,
    int? Year,
    int? Month,
    int? OfficialCounterfeitPermyriad,
    int? OfficialUndervaluationPermyriad,
    int? OfficialDeclarationQualityPermyriad,
    IReadOnlyList<string>? Attachments);

/// <param name="ContestationAccepted">Só em contestações: a Receita acolheu (ocorrências anuladas) ou não (voltam a contar).</param>
public sealed record RfInteractionCompleteRequest(string? Response, IReadOnlyList<string>? Attachments, bool? ContestationAccepted);

/// <summary>Contestação de indicador: indicador, remessas, fundamento (11.6) e fundamentação com evidências (11.7).</summary>
public sealed record ContestationRequest(
    ComplianceIndicator Indicator,
    IReadOnlyList<Guid>? OccurrenceIds,
    ContestationReason Reason,
    string? Grounds,
    IReadOnlyList<string>? Evidence,
    string? Reference);

// ----- Capacitação (Programa 13) -----

public sealed record ComplianceTrainingInput(
    string? PersonName,
    string? PersonEmail,
    Guid? UserId,
    string? Role,
    string? Topic,
    bool Initial,
    DateTime? TrainedAt,
    string? Notes);

public sealed record ComplianceTrainingDto(
    Guid Id,
    string PersonName,
    string? PersonEmail,
    Guid? UserId,
    string Role,
    string Topic,
    bool Initial,
    DateTime TrainedAt,
    string? Notes);

/// <summary>Situação de cada pessoa: última capacitação e próxima (a cada 12 meses).</summary>
public sealed record TrainingStatusDto(
    string PersonName,
    string? Email,
    Guid? UserId,
    string? Role,
    DateTime? LastTrainedAt,
    DateTime? NextDueAt,
    bool Due);

public sealed record TrainingOverviewDto(IReadOnlyList<TrainingStatusDto> People, IReadOnlyList<ComplianceTrainingDto> Records);

// ----- Registro de ações contra produtos ilegais (Programa 8.9; Política 6.8) -----

public sealed record EnforcementActionDto(
    long Id,
    EnforcementActionKind Kind,
    DateTime OccurredAt,
    bool Automatic,
    string? ActorEmail,
    Guid? SellerId,
    string? SellerName,
    Guid? ProductId,
    string? ProductName,
    Guid? ReportId,
    string Reason,
    string Result);

// ----- Auditoria anual (Política 7.4) -----

public sealed record AuditPlanRequest(int? Year);

public sealed record AuditPlanResultDto(int Year, int WithInfractions, int Sample, IReadOnlyList<SellerAuditDto> Audits);

public sealed record AuditCompleteRequest(SellerAuditOutcome Outcome, string? Findings);

// ----- Painel do Programa -----

public sealed record MonthlyReviewDto(int Year, int Month, bool Done, DateTime? DoneAt, string? DoneBy);

public sealed record AnnualManifestationDto(int CycleStartYear, DateTime WindowStart, DateTime WindowEnd, bool WindowOpen, bool Submitted);

/// <summary>Pendência do Programa com prazo e link para resolver.</summary>
public sealed record ProgramTaskDto(string Key, string Title, string Detail, DateTime? DueAt, bool Overdue, string Href);

public sealed record ComplianceProgramDto(
    string? OwnerName,
    string? OwnerEmail,
    DateTime? ProgramApprovedAt,
    string PolicyVersion,
    DateTime? PolicyApprovedAt,
    /// <summary>ADE configurado: operação no PRC iniciada (a etiqueta da plataforma passa a ser obrigatória, 9.5).</summary>
    bool OperationStarted,
    bool CpfVerificationActive,
    MonthlyReviewDto CurrentMonthReview,
    AnnualManifestationDto Manifestation,
    int OpenReports,
    int OverdueReports,
    int OpenAlerts,
    int HeldShipments,
    int PendingRfInteractions,
    int OverdueRfInteractions,
    int OpenSellerNotices,
    int OverdueSellerNotices,
    int SellersDataConfirmationDue,
    int SellersMissingAdmissionData,
    int SellersPolicyPending,
    int TrainingsDue,
    int AuditsPlanned,
    IReadOnlyList<ProgramTaskDto> Tasks);
