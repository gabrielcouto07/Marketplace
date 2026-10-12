namespace Marketplace.Domain.Entities;

// =====================================================================================================================
// Programa de Conformidade Tributária e Aduaneira e Política de Admissão e de Monitoramento de Vendedores.
// Cada classe cita o item que atende; o mapa completo está em docs/REMESSA_CONFORME.md (seção 9).
// =====================================================================================================================

/// <summary>
/// Aceite eletrônico da Política de Vendedores pelo representante legal, com data, hora e identificação de quem aceitou
/// (Política 2.2). Um registro por versão aceita.
/// </summary>
public class SellerPolicyAcceptance
{
    public Guid Id { get; set; }
    public Guid SellerId { get; set; }
    /// <summary>Conta que clicou em aceitar.</summary>
    public Guid UserId { get; set; }
    public required string PolicyVersion { get; set; }
    public DateTime AcceptedAt { get; set; }
    /// <summary>Representante legal declarado no aceite.</summary>
    public required string RepresentativeName { get; set; }
    public SellerDocumentType? RepresentativeDocumentType { get; set; }
    /// <summary>Documento do representante (cifrado em repouso).</summary>
    public string? RepresentativeDocument { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
}

/// <summary>
/// Comunicação formal ao vendedor, com prazo de resposta quando houver: medida aplicada e o motivo (8.5) com resposta em
/// 10 dias (8.6), pedido de documentos (4.6, 4.8, 6.2), correção de dados (8.4) e mudança da Política (10.3).
/// </summary>
public class SellerNotice
{
    public Guid Id { get; set; }
    public Guid SellerId { get; set; }
    public SellerNoticeType Type { get; set; }
    public SellerNoticeStatus Status { get; set; } = SellerNoticeStatus.Aberta;
    /// <summary>Só em <see cref="SellerNoticeType.SolicitacaoDocumentos"/>.</summary>
    public DocumentRequestKind? DocumentKind { get; set; }
    public required string Title { get; set; }
    public required string Message { get; set; }
    public Guid? ProductId { get; set; }
    public Guid? OrderId { get; set; }
    public Guid? MeasureId { get; set; }
    public Guid? InfractionId { get; set; }
    public Guid? AuditId { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
    /// <summary>Prazo para o vendedor responder (10 dias nas medidas, documentos e dados).</summary>
    public DateTime? DueAt { get; set; }
    public DateTime? ReadAt { get; set; }
    public DateTime? EmailedAt { get; set; }
    public string? ResponseText { get; set; }
    /// <summary>Chaves dos documentos enviados com a resposta (armazenamento privado).</summary>
    public List<string> ResponseFiles { get; set; } = [];
    public DateTime? RespondedAt { get; set; }
    public Guid? RespondedByUserId { get; set; }
    public string? Resolution { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public Guid? ResolvedByUserId { get; set; }
}

/// <summary>
/// Infração: descumprimento da Política ou da legislação pelo vendedor (1.1 d). Registrada por vendedor com a
/// reincidência (7.2); é reincidente quem comete nova infração nos 12 meses seguintes à anterior (8.3).
/// </summary>
public class SellerInfraction
{
    public Guid Id { get; set; }
    public Guid SellerId { get; set; }
    /// <summary>CONTRAFACAO, PRODUTO_PROIBIDO, ORIGEM_ILICITA, SUBFATURAMENTO, FRACIONAMENTO, DIVERGENCIA, DADOS_CADASTRAIS, DOCUMENTOS, ENVIO_FORA_DO_FLUXO, OUTRO.</summary>
    public required string Code { get; set; }
    public required string Description { get; set; }
    public InfractionSeverity Severity { get; set; }
    public bool Intentional { get; set; }
    public Guid? ProductId { get; set; }
    public Guid? OrderId { get; set; }
    public Guid? OccurrenceId { get; set; }
    public Guid? ReportId { get; set; }
    public Guid? AlertId { get; set; }
    public DateTime OccurredAt { get; set; }
    public DateTime RegisteredAt { get; set; }
    public Guid? RegisteredByUserId { get; set; }
    public bool Recidivist { get; set; }
}

/// <summary>Medida aplicada ao vendedor (8.1): remoção de anúncio, suspensão temporária ou exclusão.</summary>
public class SellerMeasure
{
    public Guid Id { get; set; }
    public Guid SellerId { get; set; }
    public SellerMeasureType Type { get; set; }
    public required string Reason { get; set; }
    public Guid? InfractionId { get; set; }
    public Guid? ProductId { get; set; }
    public DateTime AppliedAt { get; set; }
    public Guid? AppliedByUserId { get; set; }
    /// <summary>Aplicada pelo sistema (reincidência, dados não corrigidos no prazo).</summary>
    public bool Automatic { get; set; }
    /// <summary>Fim da suspensão temporária; nulo = até a revisão da equipe.</summary>
    public DateTime? EndsAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? RevocationReason { get; set; }
    public Guid? RevokedByUserId { get; set; }
    /// <summary>Comunicação enviada ao vendedor com o motivo (8.5).</summary>
    public Guid? NoticeId { get; set; }
}

/// <summary>Indício encontrado pelo monitoramento, julgado pela equipe (Programa 6.1 a 6.5; Política 7.1 a 7.3).</summary>
public class MonitoringAlert
{
    public Guid Id { get; set; }
    public MonitoringAlertType Type { get; set; }
    public MonitoringAlertStatus Status { get; set; } = MonitoringAlertStatus.Aberto;
    /// <summary>Identifica o padrão (tipo + vendedor/comprador + janela): o mesmo indício não gera dois alertas.</summary>
    public required string DedupKey { get; set; }
    public Guid? SellerId { get; set; }
    public Guid? BuyerUserId { get; set; }
    public required string Summary { get; set; }
    public List<Guid> OrderIds { get; set; } = [];
    /// <summary>Números e valores que levaram ao alerta (JSON).</summary>
    public string DetailsJson { get; set; } = "{}";
    /// <summary>Segura a etiqueta das remessas do alerta até o julgamento (ex.: fracionamento da mesma loja).</summary>
    public bool HoldsShipments { get; set; }
    public DateTime DetectedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public AlertAttribution? Attribution { get; set; }
    public string? ResolutionNote { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public Guid? ResolvedByUserId { get; set; }
    public Guid? InfractionId { get; set; }
}

/// <summary>
/// Relacionamento com a Receita Federal (Programa 3, 11 e 12): consultas mensais aos indicadores, planos de ação,
/// notificações, reclamações da ouvidoria, contestações, manifestação do ciclo anual e comunicações de fatos, com prazo.
/// </summary>
public class RfInteraction
{
    public Guid Id { get; set; }
    public RfInteractionType Type { get; set; }
    public RfInteractionStatus Status { get; set; } = RfInteractionStatus.Pendente;
    public required string Title { get; set; }
    public string Description { get; set; } = string.Empty;
    /// <summary>Protocolo, número da mensagem no DTE/e-CAC ou do processo.</summary>
    public string? Reference { get; set; }
    /// <summary>Recebimento (ou data do fato/da consulta).</summary>
    public DateTime OpenedAt { get; set; }
    public DateTime? DueAt { get; set; }
    public ComplianceIndicator? Indicator { get; set; }
    public ContestationReason? ContestationReason { get; set; }
    /// <summary>Remessas (ocorrências) contestadas.</summary>
    public List<Guid> OccurrenceIds { get; set; } = [];
    /// <summary>Mês consultado (consulta mensal) ou ano de início do ciclo (manifestação).</summary>
    public int? Year { get; set; }
    public int? Month { get; set; }
    /// <summary>Indicadores oficiais informados pela Receita, em centésimos de % (9970 = 99,70%).</summary>
    public int? OfficialCounterfeitPermyriad { get; set; }
    public int? OfficialUndervaluationPermyriad { get; set; }
    public int? OfficialDeclarationQualityPermyriad { get; set; }
    public string? Response { get; set; }
    public List<string> Attachments { get; set; } = [];
    public DateTime? CompletedAt { get; set; }
    public Guid? CompletedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
}

/// <summary>Capacitação de quem trabalha com as remessas: no início da função e a cada 12 meses (Programa 13.1).</summary>
public class ComplianceTraining
{
    public Guid Id { get; set; }
    public required string PersonName { get; set; }
    public string? PersonEmail { get; set; }
    public Guid? UserId { get; set; }
    /// <summary>Função exercida (ex.: atendimento, logística, moderação).</summary>
    public required string Role { get; set; }
    public required string Topic { get; set; }
    /// <summary>Capacitação inicial (início da função) ou reciclagem anual.</summary>
    public bool Initial { get; set; }
    public DateTime TrainedAt { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? RegisteredByUserId { get; set; }
}

/// <summary>Ação contra a venda de produtos ilegais e o resultado dela (Programa 8.9; Política 6.8).</summary>
public class EnforcementAction
{
    public long Id { get; set; }
    public EnforcementActionKind Kind { get; set; }
    public DateTime OccurredAt { get; set; }
    public Guid? ActorUserId { get; set; }
    public bool Automatic { get; set; }
    public Guid? SellerId { get; set; }
    public Guid? ProductId { get; set; }
    public Guid? ReportId { get; set; }
    public Guid? MeasureId { get; set; }
    public Guid? NoticeId { get; set; }
    public Guid? AlertId { get; set; }
    public required string Reason { get; set; }
    public required string Result { get; set; }
}

/// <summary>
/// Documento guardado com o pedido (Programa 10.3): o comprovante da compra emitido pela plataforma, com o valor da
/// compra e o comprovante do pagamento. Conservado por 5 anos (10.4).
/// </summary>
public class OrderDocument
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    /// <summary>"comprovante-compra".</summary>
    public required string Kind { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public required byte[] Content { get; set; }
    /// <summary>SHA-256 do arquivo (integridade do registro).</summary>
    public required string Sha256 { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Auditoria anual de conformidade do vendedor (Política 7.4).</summary>
public class SellerAudit
{
    public Guid Id { get; set; }
    public Guid SellerId { get; set; }
    /// <summary>Ano da auditoria (ciclo de 12 meses).</summary>
    public int Year { get; set; }
    public SellerAuditReason Reason { get; set; }
    public SellerAuditStatus Status { get; set; } = SellerAuditStatus.Planejada;
    public DateTime PlannedAt { get; set; }
    public Guid? PlannedByUserId { get; set; }
    /// <summary>Pedido de registros enviado ao vendedor (4.8).</summary>
    public Guid? NoticeId { get; set; }
    public SellerAuditOutcome? Outcome { get; set; }
    public string? Findings { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid? CompletedByUserId { get; set; }
}
