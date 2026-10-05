namespace Marketplace.Domain;

/// <summary>
/// Ciclo de vida do pedido (nomes em pt-BR serializados como string, iguais ao contrato do front).
/// AguardandoPagamento → Pago → EmPreparacao → Enviado → EmTransitoInternacional → Entregue → Concluido
/// Ramificações: Cancelado (até EmPreparacao); EmDisputa → Devolvido → Reembolsado.
/// </summary>
public enum OrderStatus
{
    AguardandoPagamento,
    Pago,
    EmPreparacao,
    Enviado,
    EmTransitoInternacional,
    Entregue,
    Concluido,
    Cancelado,
    EmDisputa,
    Devolvido,
    Reembolsado,
}

public enum PaymentStatus
{
    Pendente,
    Aprovado,
    Recusado,
    Expirado,
    Estornado,
}

public enum PaymentMethod
{
    Pix,
    Boleto,
    Cartao,
}

public enum UserRole
{
    Comprador,
    Vendedor,
    Admin,
}

public enum PayoutStatus
{
    Agendado,
    Processando,
    Pago,
    Falhou,
}

public enum SellerStatus
{
    Pendente,
    Aprovado,
    Suspenso,
}

public enum ProductStatus
{
    Rascunho,
    Ativo,
    Arquivado,
    /// <summary>Fora da vitrine até o admin liberar (marca protegida, preço muito abaixo da referência).</summary>
    EmAnalise,
    /// <summary>Retirado pelo admin (contrafação, produto proibido); o vendedor não reativa.</summary>
    Bloqueado,
}

/// <summary>Remessa criada na transportadora/operador para um pedido (declaração antecipada + etiqueta).</summary>
public enum ShipmentStatus
{
    Pendente,
    EtiquetaEmitida,
    Postada,
    Cancelada,
    Falhou,
}

/// <summary>Repasse dos tributos cobrados do comprador ao operador logístico (Portaria Coana 130/2023, art. 8º, I).</summary>
public enum TaxRemittanceStatus
{
    Pendente,
    Enviado,
    Confirmado,
    Falhou,
}

/// <summary>Os três indicadores de conformidade da Portaria Coana 193/2026.</summary>
public enum ComplianceIndicator
{
    Contrafacao,
    Subvaloracao,
    QualidadeDeclaracao,
}

public enum OccurrenceSource
{
    /// <summary>Ocorrência do despacho informada pela transportadora (rastreio).</summary>
    Despacho,
    /// <summary>Consulta de remessas da ECE no Portal Único Siscomex (remx).</summary>
    Siscomex,
    Ouvidoria,
    /// <summary>Denúncia de comprador julgada procedente.</summary>
    Denuncia,
    /// <summary>Registrada pela equipe (ex.: comunicação da Coana no DTE).</summary>
    Interna,
}

public enum OccurrenceStatus
{
    Confirmada,
    /// <summary>Contestação aberta (erro material, falha de sistema ou duplicidade). Continua contando até ser anulada.</summary>
    Contestada,
    Anulada,
}

public enum ProductReportReason
{
    Falsificado,
    PrecoSuspeito,
    DescricaoIncorreta,
    ProdutoProibido,
    Outro,
}

public enum ProductReportStatus
{
    Aberta,
    Procedente,
    Improcedente,
}

/// <summary>Documento de identidade do responsável pela loja.</summary>
public enum SellerDocumentType
{
    CedulaPy,
    Cpf,
    Passaporte,
}

/// <summary>Faixa de cada indicador (Portaria Coana 193/2026).</summary>
public enum ComplianceBand
{
    Ouro,
    Prata,
    Bronze,
    /// <summary>98,0% a 99,0%: advertência e plano de ação em 30 dias.</summary>
    Advertencia,
    /// <summary>Abaixo de 98,0%: procedimento de exclusão.</summary>
    Exclusao,
}

/// <summary>Como os tributos da remessa foram calculados.</summary>
public enum ImportTaxRegime
{
    /// <summary>Tributação do Remessa Conforme (II por faixa + ICMS + IBS + CBS), cobrada na compra.</summary>
    RemessaConforme,
    /// <summary>Alíquota única estimada (modo Flat ou sem cotação do dólar).</summary>
    Estimativa,
}

public enum ConsentType
{
    TermosDeUso,
    PoliticaDePrivacidade,
    Marketing,
}

public enum ImportTaxMode
{
    /// <summary>Alíquota única sobre produtos + frete (padrão: 60%).</summary>
    Flat,
    /// <summary>Remessa Conforme: 20% até US$ 50; 60% acima com dedução de US$ 20; + ICMS, IBS e CBS.</summary>
    RemessaConforme,
}

public enum BannerTone
{
    blue,
    red,
    neutral,
}
