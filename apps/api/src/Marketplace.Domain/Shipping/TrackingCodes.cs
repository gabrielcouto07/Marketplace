namespace Marketplace.Domain.Shipping;

/// <summary>
/// Códigos normalizados de rastreio. Provedores traduzem os eventos de cada transportadora para estes códigos;
/// o pedido transita de status conforme <see cref="TargetStatus"/>.
/// </summary>
public static class TrackingCodes
{
    public const string Posted = "POSTED";
    public const string Export = "EXPORT";
    public const string InTransit = "IN_TRANSIT";
    public const string ArrivedBr = "ARRIVED_BR";
    public const string Customs = "CUSTOMS";
    public const string TaxPending = "TAX_PENDING";
    public const string CustomsReleased = "CUSTOMS_RELEASED";
    public const string OutForDelivery = "OUT_FOR_DELIVERY";
    public const string DeliveryFailed = "DELIVERY_FAILED";
    public const string Delivered = "DELIVERED";
    public const string Returned = "RETURNED";
    public const string Info = "INFO";

    // Ocorrências do despacho que derrubam indicador de conformidade (Portaria Coana 193/2026).
    /// <summary>Valor declarado aumentado pela fiscalização (subvaloração).</summary>
    public const string CustomsValueAdjusted = "CUSTOMS_VALUE_ADJUSTED";
    /// <summary>Retenção por contrafação confirmada.</summary>
    public const string SeizedCounterfeit = "SEIZED_COUNTERFEIT";
    /// <summary>Erro na declaração (CPF do destinatário, remetente, descrição, regime ou conteúdo).</summary>
    public const string DeclarationError = "DECLARATION_ERROR";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Posted, Export, InTransit, ArrivedBr, Customs, TaxPending, CustomsReleased, OutForDelivery, DeliveryFailed,
        Delivered, Returned, Info, CustomsValueAdjusted, SeizedCounterfeit, DeclarationError,
    };

    /// <summary>Indicador de conformidade afetado pelo evento (null = nenhum).</summary>
    public static ComplianceIndicator? ComplianceIndicatorFor(string code) => code switch
    {
        CustomsValueAdjusted => ComplianceIndicator.Subvaloracao,
        SeizedCounterfeit => ComplianceIndicator.Contrafacao,
        DeclarationError => ComplianceIndicator.QualidadeDeclaracao,
        _ => null,
    };

    /// <summary>Normaliza um código recebido (trim/upper, hífen e espaço → underscore); desconhecido vira INFO.</summary>
    public static string Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return Info;
        var code = raw.Trim().ToUpperInvariant().Replace('-', '_').Replace(' ', '_');
        return All.Contains(code) ? code : Info;
    }

    /// <summary>Status do pedido implicado pelo evento (null = não muda o status).</summary>
    public static OrderStatus? TargetStatus(string code) => code switch
    {
        ArrivedBr or Customs or TaxPending or CustomsReleased or OutForDelivery or CustomsValueAdjusted or DeclarationError => OrderStatus.EmTransitoInternacional,
        Delivered => OrderStatus.Entregue,
        _ => null,
    };

    /// <summary>Evento terminal: depois dele não há mais consulta à transportadora.</summary>
    public static bool IsTerminal(string code) => code is Delivered or Returned;
}
