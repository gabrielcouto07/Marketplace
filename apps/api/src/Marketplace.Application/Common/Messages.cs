using Marketplace.Domain;

namespace Marketplace.Application.Common;

/// <summary>Textos gerados pelo servidor (timeline, e-mails), negociados por Accept-Language.</summary>
public static class Messages
{
    public const string DefaultLocale = "pt-BR";
    public static readonly string[] SupportedLocales = ["pt-BR", "es-PY"];

    private static readonly Dictionary<OrderStatus, (string Pt, string Es)> Timeline = new()
    {
        [OrderStatus.AguardandoPagamento] = ("Pedido criado. Aguardando confirmação do pagamento.", "Pedido creado. Esperando la confirmación del pago."),
        [OrderStatus.Pago] = ("Pagamento aprovado.", "Pago aprobado."),
        [OrderStatus.EmPreparacao] = ("O vendedor está separando e embalando o pedido.", "El vendedor está preparando y embalando el pedido."),
        [OrderStatus.Enviado] = ("Pedido postado no Paraguai.", "Pedido despachado en Paraguay."),
        [OrderStatus.EmTransitoInternacional] = ("Em trânsito internacional / desembaraço aduaneiro.", "En tránsito internacional / despacho aduanero."),
        [OrderStatus.Entregue] = ("Pedido entregue ao destinatário.", "Pedido entregado al destinatario."),
        [OrderStatus.Concluido] = ("Pedido concluído. Obrigado pela compra!", "Pedido concluido. ¡Gracias por su compra!"),
        [OrderStatus.Cancelado] = ("Pedido cancelado.", "Pedido cancelado."),
        [OrderStatus.EmDisputa] = ("Disputa aberta. Nossa equipe está mediando.", "Disputa abierta. Nuestro equipo está mediando."),
        [OrderStatus.Devolvido] = ("Produto devolvido ao vendedor.", "Producto devuelto al vendedor."),
        [OrderStatus.Reembolsado] = ("Reembolso processado no meio de pagamento original.", "Reembolso procesado en el medio de pago original."),
    };

    public static string TimelineDescription(OrderStatus status, string locale) =>
        locale.StartsWith("es", StringComparison.OrdinalIgnoreCase) ? Timeline[status].Es : Timeline[status].Pt;

    public static string NormalizeLocale(string? acceptLanguage)
    {
        if (string.IsNullOrWhiteSpace(acceptLanguage)) return DefaultLocale;
        foreach (var part in acceptLanguage.Split(','))
        {
            var tag = part.Split(';')[0].Trim();
            if (tag.StartsWith("es", StringComparison.OrdinalIgnoreCase)) return "es-PY";
            if (tag.StartsWith("pt", StringComparison.OrdinalIgnoreCase)) return "pt-BR";
        }
        return DefaultLocale;
    }
}
