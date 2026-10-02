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
    RefundService refunds,
    ILinkBuilder links,
    ICatalogCache catalogCache,
    ICurrentUser currentUser,
    TimeProvider clock)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    /// <summary>
    /// Três coleções incluídas: o provedor está configurado com QuerySplittingBehavior.SplitQuery (DependencyInjection),
    /// senão cada pedido viraria itens × eventos × rastreio linhas numa única consulta.
    /// </summary>
    public IQueryable<Order> FullOrders() =>
        db.Orders
            .Include(o => o.Seller)
            .Include(o => o.Items)
            .Include(o => o.Events)
            .Include(o => o.TrackingEvents)
            .Include(o => o.ExchangeRate)
            .Include(o => o.Payment);

    private static readonly OrderStatus[] DoneStatuses = [OrderStatus.Concluido, OrderStatus.Cancelado, OrderStatus.Reembolsado];

    /// <param name="group">"active" (em andamento) ou "done" (concluídos/cancelados/reembolsados): as abas da lista filtram no servidor, não só na página carregada.</param>
    public async Task<PagedResult<OrderDto>> ListAsync(OrderStatus? status, string? group, int? page, int? pageSize, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var query = FullOrders().AsNoTracking().Where(o => o.UserId == userId);
        if (status is { } s) query = query.Where(o => o.Status == s);
        if (string.Equals(group, "active", StringComparison.OrdinalIgnoreCase)) query = query.Where(o => !DoneStatuses.Contains(o.Status));
        else if (string.Equals(group, "done", StringComparison.OrdinalIgnoreCase)) query = query.Where(o => DoneStatuses.Contains(o.Status));
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
        return new OrderTrackingDto(
            order.TrackingCode,
            order.Carrier,
            order.TrackingCode is null ? null : links.Tracking(order.TrackingCode, order.Carrier),
            order.TrackingEvents.OrderBy(e => e.OccurredAt).Select(e => e.ToDto()).ToList());
    }

    public async Task<OrderDto> CancelAsync(string idOrNumber, CancellationToken ct)
    {
        var order = await FindOwnedAsync(idOrNumber, asNoTracking: false, ct);
        if (!order.CanBeCancelled)
            throw AppException.Conflict("ORDER_NOT_CANCELLABLE", "Este pedido não pode mais ser cancelado.");
        var wasPaid = order.Status != OrderStatus.AguardandoPagamento;
        MarkCancelled(order, "Cancelado pelo comprador.", "buyer");
        // O estorno fala com o gateway (rede): fica fora da transação para não segurar o lock do estoque.
        if (wasPaid) await RefundCancelledOrderAsync(order, ct);
        await CommitCancellationAsync([order], ct);
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

    /// <summary>Transita para Cancelado sem persistir. Conclua com <see cref="CommitCancellationAsync"/>.</summary>
    public void MarkCancelled(Order order, string? note, string actor) =>
        Transition(order, OrderStatus.Cancelado, note, null, actor);

    /// <summary>
    /// Devolve o estoque dos pedidos cancelados (UPDATE atômico, simétrico à reserva do checkout) e salva todas as
    /// mudanças pendentes na MESMA transação: ou tudo entra, ou nada. Sem isso, uma falha entre o UPDATE e o
    /// SaveChanges deixaria estoque devolvido com o pedido ainda aberto (e um retry devolveria de novo).
    /// </summary>
    public async Task CommitCancellationAsync(IReadOnlyCollection<Order> cancelled, CancellationToken ct)
    {
        if (cancelled.Count == 0) return;
        if (db.Database.CurrentTransaction is not null)
        {
            await RestoreStockAsync(cancelled, ct);
            await CloseOrphanPurchasesAsync(cancelled, ct);
            await db.SaveChangesAsync(ct);
        }
        else
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await RestoreStockAsync(cancelled, ct);
            await CloseOrphanPurchasesAsync(cancelled, ct);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        // Estoque mudou: a vitrine (cache de 60 s) precisa refletir na hora.
        await catalogCache.InvalidateAsync(ct);
    }

    /// <summary>
    /// Compra sem nenhum pedido aguardando pagamento e cobrança ainda Pendente: a cobrança deixa de ser pagável
    /// (um boleto pago depois disso cai no estorno automático) e o uso do cupom é devolvido.
    /// </summary>
    private async Task CloseOrphanPurchasesAsync(IReadOnlyCollection<Order> cancelled, CancellationToken ct)
    {
        // Os pedidos recém-cancelados ainda estão como AguardandoPagamento no banco (o SaveChanges vem depois):
        // ficam fora da checagem de "ainda há alguém esperando pagamento".
        var cancelledIds = cancelled.Select(o => o.Id).ToList();
        foreach (var purchaseId in cancelled.Select(o => o.PurchaseId).Distinct())
        {
            var stillPending = await db.Orders.AnyAsync(
                o => o.PurchaseId == purchaseId && o.Status == OrderStatus.AguardandoPagamento && !cancelledIds.Contains(o.Id), ct);
            if (stillPending) continue;
            var payment = cancelled.First(o => o.PurchaseId == purchaseId).Payment
                          ?? await db.Payments.FirstAsync(p => p.PurchaseId == purchaseId, ct);
            if (payment.Status != PaymentStatus.Pendente) continue;
            payment.Status = PaymentStatus.Expirado;
            payment.FailureReason = "Todos os pedidos da compra foram cancelados antes do pagamento.";
            payment.UpdatedAt = Now;
            var couponCode = await db.Purchases.Where(p => p.Id == purchaseId).Select(p => p.CouponCode).FirstOrDefaultAsync(ct);
            if (!string.IsNullOrEmpty(couponCode))
                await db.Coupons.Where(c => c.Code == couponCode && c.UsedCount > 0)
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.UsedCount, c => c.UsedCount - 1), ct);
        }
    }

    private async Task RestoreStockAsync(IEnumerable<Order> cancelled, CancellationToken ct)
    {
        foreach (var item in cancelled.SelectMany(o => o.Items))
        {
            var quantity = item.Quantity;
            if (item.VariantId is { } vid)
                await db.ProductVariants.Where(v => v.Id == vid)
                    .ExecuteUpdateAsync(s => s.SetProperty(v => v.Stock, v => v.Stock + quantity), ct);
            await db.Products.Where(p => p.Id == item.ProductId)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Stock, p => p.Stock + quantity), ct);
        }
    }

    /// <summary>Estorno do valor do pedido cancelado (o pagamento cobre N pedidos da compra) via RefundService.</summary>
    private async Task RefundCancelledOrderAsync(Order order, CancellationToken ct)
    {
        if (order.Payment.Status != PaymentStatus.Aprovado) return;
        var ok = await refunds.RefundOrderAsync(order, order.Payment, ct);
        order.Events[^1].Note = ok
            ? "Cancelado pelo comprador. Reembolso solicitado no meio de pagamento original."
            : "Cancelado pelo comprador. Reembolso pendente de processamento manual.";
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
