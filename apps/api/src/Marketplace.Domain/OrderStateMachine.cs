namespace Marketplace.Domain;

public static class OrderStateMachine
{
    public static readonly IReadOnlyList<OrderStatus> HappyPath =
    [
        OrderStatus.AguardandoPagamento,
        OrderStatus.Pago,
        OrderStatus.EmPreparacao,
        OrderStatus.Enviado,
        OrderStatus.EmTransitoInternacional,
        OrderStatus.Entregue,
        OrderStatus.Concluido,
    ];

    private static readonly Dictionary<OrderStatus, OrderStatus[]> Transitions = new()
    {
        [OrderStatus.AguardandoPagamento] = [OrderStatus.Pago, OrderStatus.Cancelado],
        [OrderStatus.Pago] = [OrderStatus.EmPreparacao, OrderStatus.Cancelado, OrderStatus.Reembolsado],
        [OrderStatus.EmPreparacao] = [OrderStatus.Enviado, OrderStatus.Cancelado],
        [OrderStatus.Enviado] = [OrderStatus.EmTransitoInternacional, OrderStatus.Entregue, OrderStatus.EmDisputa],
        [OrderStatus.EmTransitoInternacional] = [OrderStatus.Entregue, OrderStatus.EmDisputa],
        [OrderStatus.Entregue] = [OrderStatus.Concluido, OrderStatus.EmDisputa],
        [OrderStatus.EmDisputa] = [OrderStatus.Devolvido, OrderStatus.Reembolsado, OrderStatus.Concluido],
        [OrderStatus.Devolvido] = [OrderStatus.Reembolsado],
        [OrderStatus.Concluido] = [],
        [OrderStatus.Cancelado] = [],
        [OrderStatus.Reembolsado] = [],
    };

    public static bool CanTransition(OrderStatus from, OrderStatus to) =>
        Transitions.TryGetValue(from, out var allowed) && allowed.Contains(to);

    public static bool CanCancel(OrderStatus status) =>
        status is OrderStatus.AguardandoPagamento or OrderStatus.Pago or OrderStatus.EmPreparacao;

    public static bool CanDispute(OrderStatus status) =>
        status is OrderStatus.Enviado or OrderStatus.EmTransitoInternacional or OrderStatus.Entregue;

    /// <summary>Pedido ainda em andamento (não terminal).</summary>
    public static bool IsOpen(OrderStatus status) =>
        status is not (OrderStatus.Concluido or OrderStatus.Cancelado or OrderStatus.Reembolsado);
}
