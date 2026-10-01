using Marketplace.Application.Abstractions;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

/// <summary>
/// Estornos no gateway: um ponto único usado por comprador (cancelamento), admin (disputa/estorno) e webhooks.
/// Idempotente por (pagamento, pedido) e registrado em <c>Payment.RefundedAmount</c>/<c>LastRefundId</c>.
/// Usa o gateway gravado no pagamento, não o padrão da configuração.
/// </summary>
public sealed class RefundService(
    IAppDbContext db,
    IPaymentGatewayRegistry gateways,
    PayoutService payouts,
    TimeProvider clock,
    ILogger<RefundService> logger)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    /// <summary>
    /// Estorna o valor de um pedido (o pagamento cobre N pedidos da compra), cancela o repasse e, quando todos os
    /// pedidos da compra estiverem encerrados, marca o pagamento como Estornado. Retorna false se o gateway falhou
    /// (o estorno fica pendente de processamento manual, mas o pedido segue o fluxo).
    /// </summary>
    public async Task<bool> RefundOrderAsync(Order order, Payment payment, CancellationToken ct)
    {
        await payouts.CancelForOrderAsync(order.Id, ct);
        if (payment.Status != PaymentStatus.Aprovado) return true;

        var ok = await RequestAsync(payment, Money.Brl(order.TotalAmount), $"refund:{payment.Id:N}:{order.Id:N}", ct);
        var siblings = await db.Orders.Where(o => o.PurchaseId == order.PurchaseId && o.Id != order.Id).Select(o => o.Status).ToListAsync(ct);
        if (siblings.All(s => s is OrderStatus.Cancelado or OrderStatus.Reembolsado))
        {
            payment.Status = PaymentStatus.Estornado;
            payment.UpdatedAt = Now;
        }
        return ok;
    }

    /// <summary>Estorno do valor ainda não estornado (admin / pagamento tardio). Idempotente por pagamento.</summary>
    public async Task<bool> RefundRemainingAsync(Payment payment, CancellationToken ct)
    {
        var remaining = payment.Amount - payment.RefundedAmount;
        if (remaining <= 0) return true;
        return await RequestAsync(payment, new Money(remaining, payment.Currency), $"refund:{payment.Id:N}:full", ct);
    }

    private async Task<bool> RequestAsync(Payment payment, Money amount, string idempotencyKey, CancellationToken ct)
    {
        if (payment.GatewayPaymentId is null || payment.RefundedAmount >= payment.Amount) return true;
        if (!gateways.TryGet(payment.Gateway, out var gateway))
        {
            logger.LogError("Gateway {Gateway} do pagamento {PaymentId} não está registrado: estorno manual necessário", payment.Gateway, payment.Id);
            return false;
        }
        try
        {
            var result = await gateway.RefundAsync(payment.GatewayPaymentId, amount, idempotencyKey, ct);
            payment.RefundedAmount = Math.Min(payment.Amount, payment.RefundedAmount + amount.Amount);
            payment.LastRefundId = result.RefundId ?? payment.LastRefundId;
            payment.RefundedAt = Now;
            payment.UpdatedAt = Now;
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Falha ao estornar {Amount} do pagamento {PaymentId} em {Gateway}", amount.Amount, payment.Id, payment.Gateway);
            return false;
        }
    }
}
