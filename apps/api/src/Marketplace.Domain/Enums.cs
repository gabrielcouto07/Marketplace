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
    /// <summary>
    /// Suspensão permanente, com exclusão da plataforma (Política de Vendedores 8.1 c). Não volta e um novo cadastro com
    /// os mesmos dados ou documentos é recusado (3.5).
    /// </summary>
    Excluido,
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
    /// <summary>Contestação aberta junto à Receita (Programa 11.6). Continua contando até ser anulada.</summary>
    Contestada,
    Anulada,
}

/// <summary>Únicos fundamentos aceitos para contestar um indicador apurado (Programa de Conformidade 11.6).</summary>
public enum ContestationReason
{
    ErroMaterial,
    InconsistenciaSistemica,
    /// <summary>Impropriedade na aplicação da metodologia de cálculo.</summary>
    ImpropriedadeMetodologia,
}

public enum ProductReportReason
{
    Falsificado,
    PrecoSuspeito,
    DescricaoIncorreta,
    ProdutoProibido,
    Outro,
    /// <summary>Violação de propriedade intelectual (marca, desenho, direito autoral, patente).</summary>
    PropriedadeIntelectual,
    /// <summary>Origem ilícita (contrabando, descaminho, roubo ou furto).</summary>
    OrigemIlicita,
}

/// <summary>Por onde a denúncia chegou: botão da página do produto ou canal público (Política 6.4).</summary>
public enum ReportChannel
{
    PaginaDoProduto,
    CanalPublico,
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

// =====================================================================================================================
// Programa de Conformidade Tributária e Aduaneira e Política de Admissão e de Monitoramento de Vendedores
// (docs/REMESSA_CONFORME.md, seção 9)
// =====================================================================================================================

/// <summary>Meio de pagamento associado ao vendedor (Política 3.1 e).</summary>
public enum SellerPayoutMethod
{
    ContaBancaria,
    CarteiraDigital,
    Outro,
}

/// <summary>Comunicação formal da plataforma ao vendedor, guardada no painel e enviada por e-mail.</summary>
public enum SellerNoticeType
{
    /// <summary>Medida aplicada (remoção de anúncio, suspensão ou exclusão) com o motivo (Política 8.5); resposta em 10 dias (8.6).</summary>
    Medida,
    /// <summary>Pedido de documentos: autenticidade (6.2), valor da operação (4.6) ou registros para auditoria (4.8).</summary>
    SolicitacaoDocumentos,
    /// <summary>Correção ou confirmação dos dados cadastrais (4.2, 4.3); sem resposta em 10 dias, suspensão (8.4).</summary>
    AtualizacaoCadastral,
    /// <summary>Nova versão da Política (10.3): o vendedor lê e aceita de novo.</summary>
    AlteracaoPolitica,
    Aviso,
}

public enum SellerNoticeStatus
{
    /// <summary>Aguardando o vendedor.</summary>
    Aberta,
    /// <summary>O vendedor respondeu; aguardando a equipe.</summary>
    Respondida,
    Encerrada,
}

/// <summary>O que um pedido de documentos busca comprovar.</summary>
public enum DocumentRequestKind
{
    /// <summary>Autenticidade do produto: fatura do fabricante ou distribuidor autorizado, ou autorização do titular da marca (6.2).</summary>
    Autenticidade,
    /// <summary>Valor da operação, inclusive documentos fiscais (4.6).</summary>
    ValorDaOperacao,
    /// <summary>Registros das operações, para auditoria (4.7 e 4.8).</summary>
    Registros,
}

/// <summary>Medidas da Política de Vendedores (8.1).</summary>
public enum SellerMeasureType
{
    RemocaoAnuncio,
    SuspensaoTemporaria,
    /// <summary>Suspensão permanente, com exclusão da plataforma.</summary>
    Exclusao,
}

/// <summary>Gravidade da infração: entra na graduação da medida com o número de infrações e a intenção (8.2).</summary>
public enum InfractionSeverity
{
    Leve,
    Media,
    Grave,
}

/// <summary>Padrões que o monitoramento procura (Programa 6.1 e 6.4; Política 7.3).</summary>
public enum MonitoringAlertType
{
    /// <summary>Pedidos do mesmo comprador, para o mesmo endereço, em até 7 dias, que juntos mudam a faixa ou passam do limite (6.4).</summary>
    Fracionamento,
    /// <summary>Aumento abrupto do número de remessas do vendedor (7.3 a).</summary>
    AumentoAbrupto,
    /// <summary>Concentração de remessas para o mesmo destinatário ou endereço (7.3 b).</summary>
    ConcentracaoDestinatario,
    /// <summary>Preço muito abaixo de produto equivalente (7.3 d): indício de subfaturamento.</summary>
    PrecoMuitoAbaixo,
    /// <summary>Divergência reiterada entre o produto anunciado e o enviado (7.3 e).</summary>
    DivergenciaReiterada,
    /// <summary>Valor da declaração diferente do cobrado do comprador (6.3).</summary>
    ValorDeclarado,
    /// <summary>Dados do remetente incompletos ou divergentes do cadastro: risco de ocultação de remetente (6.1).</summary>
    Remetente,
}

public enum MonitoringAlertStatus
{
    Aberto,
    Procedente,
    Improcedente,
}

/// <summary>A quem o indício foi atribuído ao ser julgado procedente (Programa 6.5).</summary>
public enum AlertAttribution
{
    Vendedor,
    Comprador,
    Plataforma,
}

/// <summary>Relacionamento com a Receita Federal (Programa 3, 11 e 12).</summary>
public enum RfInteractionType
{
    /// <summary>Consulta mensal dos indicadores disponibilizados pela Receita (11.2).</summary>
    ConsultaMensal,
    /// <summary>Plano de ação corretivo pedido pela Receita: entrega em 30 dias (11.3 c/d e 11.4).</summary>
    PlanoDeAcao,
    /// <summary>Notificação para adotar medidas corretivas: saneamento em 30 dias (11.5).</summary>
    NotificacaoCorretiva,
    /// <summary>Reclamação da ouvidoria repassada pela Receita: resposta no prazo dela ou em 5 dias úteis (12).</summary>
    Ouvidoria,
    /// <summary>Contestação de indicador (11.6 e 11.7).</summary>
    Contestacao,
    /// <summary>Manifestação sobre os resultados do ciclo anual: de 1º a 31 de outubro (11.8).</summary>
    ManifestacaoCiclo,
    /// <summary>Comunicação de fato que compromete o cumprimento do PRC (3.6).</summary>
    ComunicacaoDeFato,
    Outro,
}

public enum RfInteractionStatus
{
    Pendente,
    Concluida,
}

/// <summary>Ações contra a venda de produtos ilegais, registradas com o resultado (Programa 8.9; Política 6.8).</summary>
public enum EnforcementActionKind
{
    AnuncioEmAnalise,
    AnuncioRemovido,
    AnuncioLiberado,
    AutenticidadeSolicitada,
    AutenticidadeComprovada,
    AutenticidadeNaoComprovada,
    DenunciaRecebida,
    DenunciaProcedente,
    DenunciaImprocedente,
    InfracaoRegistrada,
    MedidaAplicada,
    MedidaRevogada,
    CadastroRecusado,
    InformacoesAutoridades,
    AlertaMonitoramento,
}

/// <summary>Auditoria anual de vendedores (Política 7.4).</summary>
public enum SellerAuditReason
{
    /// <summary>Vendedor com infração registrada nos últimos 12 meses.</summary>
    Infracao,
    /// <summary>Amostra dos demais vendedores.</summary>
    Amostra,
}

public enum SellerAuditStatus
{
    Planejada,
    Concluida,
}

public enum SellerAuditOutcome
{
    Conforme,
    NaoConforme,
}
