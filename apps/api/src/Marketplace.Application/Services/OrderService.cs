using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

public sealed class OrderService(
    IAppDbContext db,
    IPaymentGateway gateway,
    PayoutService payouts,
    ICurrentUser currentUser,
    TimeProvider clock,
    ILogger<OrderService> logger)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public IQueryable<Order> FullOrders() =>
        db.Orders
            .Include(o => o.Seller)
            .Include(o => o.Items)
            .Include(o => o.Events)
            .Include(o => o.TrackingEvents)
            .Include(o => o.ExchangeRate)
            .Include(o => o.Payment);

    public async Task<PagedResult<OrderDto>> ListAsync(OrderStatus? status, int? page, int? pageSize, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var query = FullOrders().AsNoTracking().Where(o => o.UserId == userId);
        if (status is { } s) query = query.Where(o => o.Status == s);
        var paged = await query.OrderByDescending(o => o.CreatedAt).ThenBy(o => o.Number).ToPagedAsync(page, pageSize, 10, ct);
        return paged.Map(o => o.ToDto(currentUser.Locale));
    }

    /// <summary>Aceita id (GUID) ou número legível (PY-2026-000123).</summary>
    public async Task<OrderDto> GetAsync(string idOrNumber, CancellationToken ct)
    {
        var order = await FindOwnedAsync(idOrNumber, asNoTracking: true, ct);
        return order.ToDto(currentUser.Locale);
    }

    public async Task<IReadOnlyList<OrderDto>> ByPurchaseAsync(Guid purchaseId, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var list = await FullOrders().AsNoTracking()
            .Where(o => o.PurchaseId == purchaseId && o.UserId == userId)
            .OrderBy(o => o.Number)
            .ToListAsync(ct);
        if (list.Count == 0) throw AppException.NotFound("Compra");
        return list.Select(o => o.ToDto(currentUser.Locale)).ToList();
    }

    internal async Task<IReadOnlyList<OrderDto>> ByPurchaseInternalAsync(Guid purchaseId, CancellationToken ct)
    {
        var list = await FullOrders().AsNoTracking().Where(o => o.PurchaseId == purchaseId).OrderBy(o => o.Number).ToListAsync(ct);
        return list.Select(o => o.ToDto(currentUser.Locale)).ToList();
    }

    public async Task<OrderTrackingDto> TrackingAsync(string idOrNumber, CancellationToken ct)
    {
        var order = await FindOwnedAsync(idOrNumber, asNoTracking: true, ct);
        return new OrderTrackingDto(order.TrackingCode, order.TrackingEvents.OrderBy(e => e.OccurredAt).Select(e => e.ToDto()).ToList());
    }

    public async Task<OrderDto> CancelAsync(string idOrNumber, CancellationToken ct)
    {
        var order = await FindOwnedAsync(idOrNumber, asNoTracking: false, ct);
        if (!order.CanBeCancelled)
            throw AppException.Conflict("ORDER_NOT_CANCELLABLE", "Este pedido não pode mais ser cancelado.");
        var wasPaid = order.Status != OrderStatus.AguardandoPagamento;
        await CancelInternalAsync(order, "Cancelado pelo comprador.", "buyer", restoreStock: true, ct);
        if (wasPaid) await RefundCancelledOrderAsync(order, ct);
        await db.SaveChangesAsync(ct);
        return order.ToDto(currentUser.Locale);
    }

    public async Task<OrderDto> OpenDisputeAsync(string idOrNumber, CancellationToken ct)
    {
        var order = await FindOwnedAsync(idOrNumber, asNoTracking: false, ct);
        if (!order.CanOpenDispute)
            throw AppException.Conflict("ORDER_DISPUTE_NOT_ALLOWED", "Só é possível abrir disputa para pedidos enviados ou entregues.");
        Transition(order, OrderStatus.EmDisputa, null, null, "buyer");
        await db.SaveChangesAsync(ct);
        return order.ToDto(currentUser.Locale);
    }

    public async Task<OrderDto> ConfirmReceiptAsync(string idOrNumber, CancellationToken ct)
    {
        var order = await FindOwnedAsync(idOrNumber, asNoTracking: false, ct);
        if (order.Status != OrderStatus.Entregue)
            throw AppException.Conflict("ORDER_NOT_DELIVERED", "Só é possível confirmar o recebimento de pedidos entregues.");
        Transition(order, OrderStatus.Concluido, null, null, "buyer");
        await db.SaveChangesAsync(ct);
        return order.ToDto(currentUser.Locale);
    }

    /// <summary>Transição validada pela máquina de estados; registra a linha do tempo.</summary>
    public void Transition(Order order, OrderStatus to, string? note, string? location, string actor)
    {
        if (!OrderStateMachine.CanTransition(order.Status, to))
            throw AppException.Conflict("ORDER_INVALID_TRANSITION", $"Transição {order.Status} → {to} não permitida.");
        var now = Now;
        order.Status = to;
        order.UpdatedAt = now;
        order.Events.Add(new OrderEvent { OrderId = order.Id, Status = to, OccurredAt = now, Note = note, Location = location, Actor = actor });
    }

    public async Task CancelInternalAsync(Order order, string? note, string actor, bool restoreStock, CancellationToken ct)
    {
        Transition(order, OrderStatus.Cancelado, note, null, actor);
        if (!restoreStock) return;
        foreach (var item in order.Items)
        {
            var product = await db.Products.Include(p => p.Variants).FirstOrDefaultAsync(p => p.Id == item.ProductId, ct);
            if (product is null) continue;
            if (item.VariantId is { } vid && product.Variants.FirstOrDefault(v => v.Id == vid) is { } variant)
            {
                variant.Stock += item.Quantity;
                product.Stock = product.Variants.Sum(v => v.Stock);
            }
            else product.Stock += item.Quantity;
        }
    }

    /// <summary>
    /// Estorno parcial do valor do pedido cancelado (o pagamento cobre N pedidos da compra). Quando todos os
    /// pedidos da compra estiverem cancelados/reembolsados, o pagamento passa a Estornado.
    /// </summary>
    private async Task RefundCancelledOrderAsync(Order order, CancellationToken ct)
    {
        var payment = order.Payment;
        if (payment.Status != PaymentStatus.Aprovado) return;
        await payouts.CancelForOrderAsync(order.Id, ct);
        try
        {
            if (payment.GatewayPaymentId is not null)
                await gateway.RefundAsync(payment.GatewayPaymentId, Money.Brl(order.TotalAmount), ct);
            order.Events[^1].Note = "Cancelado pelo comprador. Reembolso solicitado no meio de pagamento original.";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Falha ao solicitar estorno do pedido {OrderNumber}", order.Number);
            order.Events[^1].Note = "Cancelado pelo comprador. Reembolso pendente de processamento manual.";
        }
        var siblings = await db.Orders.Where(o => o.PurchaseId == order.PurchaseId && o.Id != order.Id).Select(o => o.Status).ToListAsync(ct);
        if (siblings.All(s => s is OrderStatus.Cancelado or OrderStatus.Reembolsado))
        {
            payment.Status = PaymentStatus.Estornado;
            payment.UpdatedAt = Now;
        }
    }

    private async Task<Order> FindOwnedAsync(string idOrNumber, bool asNoTracking, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var query = asNoTracking ? FullOrders().AsNoTracking() : FullOrders();
        query = query.Where(o => o.UserId == userId);
        var order = Guid.TryParse(idOrNumber, out var id)
            ? await query.FirstOrDefaultAsync(o => o.Id == id, ct)
            : await query.FirstOrDefaultAsync(o => o.Number == idOrNumber, ct);
        return order ?? throw AppException.NotFound("Pedido");
    }

    /// <summary>PY-{ano}-{sequencial:000000}. Índice único em Number garante ausência de duplicidade.</summary>
    public async Task<string> NextNumberAsync(DateTime now, CancellationToken ct)
    {
        var prefix = $"PY-{now.Year}-";
        var last = await db.Orders.Where(o => o.Number.StartsWith(prefix)).OrderByDescending(o => o.Number).Select(o => o.Number).FirstOrDefaultAsync(ct);
        var pending = db.Orders.Local.Where(o => o.Number.StartsWith(prefix)).Select(o => o.Number).OrderByDescending(n => n).FirstOrDefault();
        if (pending is not null && (last is null || string.CompareOrdinal(pending, last) > 0)) last = pending;
        var seq = last is null ? 100200 : int.Parse(last[prefix.Length..]);
        return $"{prefix}{seq + 1:000000}";
    }
}
