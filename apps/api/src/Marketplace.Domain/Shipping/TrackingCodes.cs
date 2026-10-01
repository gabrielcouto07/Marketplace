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

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        Posted, Export, InTransit, ArrivedBr, Customs, TaxPending, CustomsReleased, OutForDelivery, DeliveryFailed,
        Delivered, Returned, Info,
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
        ArrivedBr or Customs or TaxPending or CustomsReleased or OutForDelivery => OrderStatus.EmTransitoInternacional,
        Delivered => OrderStatus.Entregue,
        _ => null,
    };

    /// <summary>Evento terminal: depois dele não há mais consulta à transportadora.</summary>
    public static bool IsTerminal(string code) => code is Delivered or Returned;
}
