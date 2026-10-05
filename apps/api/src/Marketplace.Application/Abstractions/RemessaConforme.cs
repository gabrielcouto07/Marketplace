using Marketplace.Domain.Common;

namespace Marketplace.Application.Abstractions;

// =====================================================================================================================
// Portas das integrações do Remessa Conforme. Implementações em Marketplace.Infrastructure/RemessaConforme e /Gov.
// Todas têm um modo offline/sandbox e entram em produção só com a credencial configurada (ver docs/REMESSA_CONFORME.md).
// =====================================================================================================================

// ----- Identidade da plataforma (ECE) -----

/// <summary>
/// Empresa de comércio eletrônico certificada: vai na etiqueta (critério iii) e no bloco "remessaConforme" da DIR
/// (codigoECE = CNPJ ou TIN, nomeECE).
/// </summary>
public sealed record PlatformIdentity(
    string Brand,
    string TradeName,
    string LegalName,
    /// <summary>"CNPJ" (empresa nacional) ou "TIN" (estrangeira, com representante no Brasil).</summary>
    string DocumentType,
    string Document,
    string Country,
    string AddressLine,
    string? AdeNumber,
    /// <summary>Código do operador logístico (codigoOND da DIR) quando contratado por intermediária.</summary>
    string? OperatorCode,
    string? OperatorName)
{
    public bool IsComplete => !string.IsNullOrWhiteSpace(LegalName) && !string.IsNullOrWhiteSpace(Document);
}

public interface IPlatformIdentityProvider
{
    PlatformIdentity Current { get; }
}

// ----- Transportadora / operador logístico (critérios i e iii) -----

/// <summary>Pessoa da remessa (remetente ou destinatário), no formato do layout "Pessoa" da DIR.</summary>
/// <param name="DocumentType">CPF, CNPJ, PASSAPORTE, TIN ou RUC.</param>
public sealed record RemessaParty(
    string Name,
    string DocumentType,
    string Document,
    string AddressLine,
    string City,
    string? State,
    string? PostalCode,
    string Country,
    string? Phone,
    string? Email);

/// <summary>Mercadoria da remessa (layout "Mercadoria" da DIR): NCM de 8 dígitos, descrição, quantidade e valor total.</summary>
public sealed record RemessaItem(
    int Sequence,
    string Description,
    string Ncm,
    int Quantity,
    Money UnitValue,
    Money TotalValue,
    int? WeightGrams,
    string OriginCountry);

/// <summary>Tributos provisionados (bloco "remessaConforme" da DIR: valorProvII, valorProvICMS, IBS e CBS).</summary>
public sealed record RemessaTaxes(Money ImportDuty, Money Icms, Money IbsState, Money IbsMunicipal, Money Cbs, Money Total);

public sealed record RemessaShipmentRequest(
    Guid ShipmentId,
    string OrderNumber,
    DateTime PurchasedAt,
    PlatformIdentity Platform,
    RemessaParty Sender,
    RemessaParty Recipient,
    IReadOnlyList<RemessaItem> Items,
    string Description,
    Money Products,
    Money Freight,
    Money Insurance,
    Money Discount,
    Money CustomsValue,
    long? CustomsValueUsdCents,
    RemessaTaxes Taxes,
    string TaxRegime,
    string? UsdRate,
    int WeightGrams,
    ParcelDimensions? Dimensions,
    string? ServiceCode,
    string? CarrierHint);

public sealed record RemessaShipmentResult(
    string ProviderReference,
    string TrackingCode,
    string Carrier,
    string? DeclarationNumber,
    byte[]? LabelPdf,
    string? LabelUrl);

public sealed record TaxRemittanceRequest(
    Guid RemittanceId,
    string OrderNumber,
    string TrackingCode,
    string? ProviderReference,
    RemessaTaxes Taxes,
    DateTime PaidAt);

public sealed record TaxRemittanceResult(string Reference, bool Confirmed);

/// <summary>Erro do operador que não adianta repetir (dados inválidos): o envio fica Falhou com a mensagem.</summary>
public sealed class RemessaRejectedException(string message) : Exception(message);

/// <summary>
/// Operador logístico (Correios ou courier, direto ou por intermediária) que recebe os dados para o registro antecipado
/// da declaração, devolve a etiqueta e recebe o repasse dos tributos. Selecione com <c>RemessaConforme:Carrier:Provider</c>.
/// </summary>
public interface IRemessaCarrierGateway
{
    string Name { get; }

    /// <summary>Falso quando falta credencial: a remessa não é criada e o admin vê o que falta.</summary>
    bool IsConfigured { get; }

    /// <summary>Sandbox: etiquetas não valem para postagem real.</summary>
    bool IsSandbox { get; }

    Task<RemessaShipmentResult> CreateShipmentAsync(RemessaShipmentRequest request, CancellationToken ct);

    Task CancelShipmentAsync(string providerReference, CancellationToken ct);

    Task<TaxRemittanceResult> RemitTaxesAsync(TaxRemittanceRequest request, CancellationToken ct);

    /// <summary>
    /// Segunda via da etiqueta quando o arquivo não está guardado. Só o sandbox gera localmente; operadores reais
    /// devolvem o próprio PDF na criação (ou uma URL) e aqui respondem null.
    /// </summary>
    Task<byte[]?> ReprintLabelAsync(RemessaShipmentRequest request, string trackingCode, string carrier, string? declarationNumber,
        CancellationToken ct) => Task.FromResult<byte[]?>(null);
}

// ----- Portal Único Siscomex: Remessas Internacionais (remx) — consulta de remessas pela ECE -----

public sealed record SiscomexOccurrence(long Id, int Code, string Name, string? Note, string? Agency, DateTime? InsertedAt, bool Resolved);

public sealed record SiscomexDivergence(int Code, string? Justification, bool Active);

/// <summary>Uma remessa na consulta da ECE (campos de "Detalhe do Processamento da Remessa da ECE").</summary>
public sealed record SiscomexShipment(
    string ShipmentNumber,
    string? DirNumber,
    int? StatusCode,
    decimal? UsdRate,
    decimal? DeclaredValueBrl,
    decimal? TaxableValueBrl,
    decimal? ImportDutyBrl,
    bool UnderInspection,
    IReadOnlyList<SiscomexOccurrence> Occurrences,
    IReadOnlyList<SiscomexDivergence> Divergences);

public sealed record SiscomexQueryResult(bool Completed, IReadOnlyList<SiscomexShipment> Shipments, IReadOnlyList<string> Errors);

/// <summary>
/// Cliente da API de Remessas Internacionais do Portal Único (perfil EMPRCOMEL). A consulta é assíncrona:
/// <c>POST /api/ext/consulta-remessas-ece</c> devolve um protocolo e <c>GET /api/ext/consulta-remessas-ece/{protocolo}</c>
/// devolve o resultado quando processado.
/// </summary>
public interface ISiscomexRemessaClient
{
    bool IsConfigured { get; }

    Task<string> RequestShipmentsQueryAsync(DateOnly from, DateOnly to, IReadOnlyList<string> shipmentNumbers, CancellationToken ct);

    Task<SiscomexQueryResult> GetShipmentsQueryAsync(string protocol, CancellationToken ct);
}

// ----- Serpro: Consulta CPF -----

public enum TaxpayerSituation
{
    Regular,
    Suspensa,
    TitularFalecido,
    PendenteDeRegularizacao,
    Cancelada,
    Nula,
    Inexistente,
    /// <summary>Sem credencial ou serviço indisponível: só o dígito verificador foi conferido.</summary>
    NaoVerificado,
}

public sealed record TaxpayerCheck(TaxpayerSituation Situation, string? Name, string Source)
{
    public bool BlocksDeclaration => Situation is TaxpayerSituation.Cancelada or TaxpayerSituation.Nula
        or TaxpayerSituation.Inexistente or TaxpayerSituation.TitularFalecido;
}

/// <summary>Situação cadastral do CPF na Receita (o indicador de qualidade da declaração conta CPF errado do destinatário).</summary>
public interface ITaxpayerRegistry
{
    bool IsConfigured { get; }

    Task<TaxpayerCheck> CheckCpfAsync(string cpf, CancellationToken ct);
}

// ----- Tabela NCM oficial (Siscomex, pública) -----

public sealed record NcmEntry(string Code, string Description);

public interface INcmCatalog
{
    /// <summary>Tabela carregada (download do Siscomex ou cache local). Falso = só o formato é conferido.</summary>
    bool IsLoaded { get; }

    /// <summary>Versão/ato da tabela carregada (ex.: "Resolução Gecex nº 926/2026").</summary>
    string? Version { get; }

    Task<NcmEntry?> FindAsync(string code, CancellationToken ct);

    Task<IReadOnlyList<NcmEntry>> SearchAsync(string text, int limit, CancellationToken ct);
}

// ----- Painel de integrações (admin) -----

/// <summary>Situação de cada integração do Remessa Conforme (o que está ligado, em sandbox e o que falta configurar).</summary>
public interface IIntegrationStatusReporter
{
    Task<IReadOnlyList<Contracts.IntegrationStatusDto>> GetAsync(CancellationToken ct);
}
