using Marketplace.Application.Abstractions;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

/// <summary>
/// Ledger de repasses: o pagamento é recebido pela plataforma e o valor líquido de cada pedido é agendado
/// para o vendedor (bruto − comissão − custo do meio de pagamento). O imposto de importação fica com a
/// plataforma para recolhimento (Remessa Conforme).
/// </summary>
public sealed class PayoutService(IAppDbContext db, PlatformSettingsProvider settingsProvider)
{
    public async Task ScheduleForOrderAsync(Order order, DateTime paidAt, CancellationToken ct)
    {
        if (await db.Payouts.AnyAsync(p => p.OrderId == order.Id, ct)) return;
        var settings = await settingsProvider.GetAsync(ct);
        var gross = Money.Brl(order.SubtotalAmount + order.ShippingAmount - order.DiscountAmount);
        var platformFee = Money.Brl(order.SubtotalAmount).MultiplyBasisPoints(settings.PlatformFeeBasisPoints);
        var paymentFee = gross.MultiplyBasisPoints(settings.PaymentFeeBasisPoints);
        db.Payouts.Add(new Payout
        {
            Id = Guid.NewGuid(),
            SellerId = order.SellerId,
            OrderId = order.Id,
            PeriodStart = paidAt.Date,
            PeriodEnd = paidAt.Date.AddDays(settings.PayoutHoldDays),
            GrossAmount = gross.Amount,
            PlatformFeeAmount = platformFee.Amount,
            PaymentFeeAmount = paymentFee.Amount,
            NetAmount = gross.Amount - platformFee.Amount - paymentFee.Amount,
            Status = PayoutStatus.Agendado,
            ScheduledFor = paidAt.Date.AddDays(settings.PayoutHoldDays),
        });
    }

    public async Task CancelForOrderAsync(Guid orderId, CancellationToken ct)
    {
        var payout = await db.Payouts.FirstOrDefaultAsync(p => p.OrderId == orderId && p.Status == PayoutStatus.Agendado, ct);
        if (payout is null) return;
        payout.Status = PayoutStatus.Falhou;
        payout.FailureReason = "Pedido cancelado/reembolsado.";
    }
}
