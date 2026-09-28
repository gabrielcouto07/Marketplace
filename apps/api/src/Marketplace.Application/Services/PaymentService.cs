using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

public sealed class PaymentService(
    IAppDbContext db,
    OrderService orders,
    PayoutService payouts,
    IPaymentGateway gateway,
    ICurrentUser currentUser,
    TimeProvider clock,
    ILogger<PaymentService> logger)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public async Task<PaymentDto> GetAsync(Guid id, CancellationToken ct)
    {
        var payment = await db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct)
                      ?? throw AppException.NotFound("Pagamento");
        // A página de pagamento é aberta logo após o checkout; só o dono (ou admin) pode consultar.
        if (currentUser.IsAuthenticated && payment.UserId != currentUser.UserId && !currentUser.Roles.Contains(UserRole.Admin))
            throw AppException.NotFound("Pagamento");
        return payment.ToDto();
    }

    public async Task<Payment> RequireOwnedAsync(Guid id, CancellationToken ct)
    {
        var payment = await db.Payments.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Pagamento");
        if (currentUser.IsAuthenticated && payment.UserId != currentUser.UserId && !currentUser.Roles.Contains(UserRole.Admin))
            throw AppException.NotFound("Pagamento");
        return payment;
    }

    /// <summary>Aplica o resultado da criação da cobrança no gateway.</summary>
    public async Task ApplyGatewayResultAsync(Guid paymentId, CreatePaymentResult result, CancellationToken ct)
    {
        var payment = await db.Payments.FirstAsync(p => p.Id == paymentId, ct);
        payment.GatewayPaymentId = result.GatewayPaymentId;
        payment.UpdatedAt = Now;
        if (result.Pix is { } pix)
        {
            payment.PixPayload = pix.QrCodePayload;
            payment.PixQrCodeImageUrl = pix.QrCodeImageUrl;
            payment.PixExpiresAt = pix.ExpiresAt;
            payment.ExpiresAt = pix.ExpiresAt;
        }
        if (result.Boleto is { } boleto)
        {
            payment.BoletoBarcode = boleto.Barcode;
            payment.BoletoDigitableLine = boleto.DigitableLine;
            payment.BoletoPdfUrl = boleto.PdfUrl;
            payment.BoletoDueDate = boleto.DueDate;
            payment.ExpiresAt = boleto.DueDate.Date.AddDays(1);
        }
        if (result.Card is { } card)
        {
            payment.CardBrand = card.Brand;
            payment.CardLast4 = card.Last4;
            payment.Installments = card.Installments;
            payment.InstallmentAmount = card.InstallmentAmount.Amount;
        }

        switch (result.Status)
        {
            case PaymentStatus.Aprovado:
                await ApproveAsync(payment, Now, ct);
                break;
            case PaymentStatus.Recusado:
                await DeclineAsync(payment, result.FailureReason ?? "Pagamento recusado pelo emissor.", ct);
                break;
            default:
                await db.SaveChangesAsync(ct);
                break;
        }
    }

    public async Task MarkFailedAsync(Guid paymentId, string reason, CancellationToken ct)
    {
        var payment = await db.Payments.FirstAsync(p => p.Id == paymentId, ct);
        await DeclineAsync(payment, reason, ct);
    }

    /// <summary>Somente com o gateway fake (dev): aprova imediatamente, como o botão "Simular pagamento".</summary>
    public async Task<PaymentDto> SimulateApprovalAsync(Guid id, CancellationToken ct)
    {
        if (gateway.Name != "fake")
            throw AppException.Conflict("SIMULATION_DISABLED", "Simulação disponível apenas com o gateway de testes.");
        var payment = await RequireOwnedAsync(id, ct);
        if (payment.Status == PaymentStatus.Pendente) await ApproveAsync(payment, Now, ct);
        return payment.ToDto();
    }

    public async Task ApproveAsync(Payment payment, DateTime paidAt, CancellationToken ct)
    {
        if (payment.Status == PaymentStatus.Aprovado) return;
        payment.Status = PaymentStatus.Aprovado;
        payment.PaidAt = paidAt;
        payment.UpdatedAt = Now;
        payment.FailureReason = null;

        var list = await orders.FullOrders().Where(o => o.PurchaseId == payment.PurchaseId).ToListAsync(ct);
        foreach (var order in list)
        {
            if (order.Status != OrderStatus.AguardandoPagamento) continue;
            orders.Transition(order, OrderStatus.Pago, null, null, "gateway");
            await payouts.ScheduleForOrderAsync(order, paidAt, ct);
            foreach (var item in order.Items)
            {
                var product = await db.Products.FirstOrDefaultAsync(p => p.Id == item.ProductId, ct);
                if (product is not null) product.SoldCount += item.Quantity;
            }
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task DeclineAsync(Payment payment, string reason, CancellationToken ct)
    {
        if (payment.IsFinal) return;
        payment.Status = PaymentStatus.Recusado;
        payment.FailureReason = reason;
        payment.UpdatedAt = Now;
        await CancelPurchaseOrdersAsync(payment.PurchaseId, "Pagamento recusado.", ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task ExpireAsync(Payment payment, CancellationToken ct)
    {
        if (payment.IsFinal) return;
        payment.Status = PaymentStatus.Expirado;
        payment.UpdatedAt = Now;
        await CancelPurchaseOrdersAsync(payment.PurchaseId, "Pagamento expirado.", ct);
        await db.SaveChangesAsync(ct);
    }

    public async Task RefundAsync(Payment payment, DateTime occurredAt, CancellationToken ct)
    {
        if (payment.Status == PaymentStatus.Estornado) return;
        payment.Status = PaymentStatus.Estornado;
        payment.UpdatedAt = Now;
        var list = await orders.FullOrders().Where(o => o.PurchaseId == payment.PurchaseId).ToListAsync(ct);
        foreach (var order in list)
        {
            if (OrderStateMachine.CanTransition(order.Status, OrderStatus.Reembolsado))
                orders.Transition(order, OrderStatus.Reembolsado, null, null, "gateway");
            await payouts.CancelForOrderAsync(order.Id, ct);
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task CancelPurchaseOrdersAsync(Guid purchaseId, string note, CancellationToken ct)
    {
        var list = await orders.FullOrders().Where(o => o.PurchaseId == purchaseId).ToListAsync(ct);
        foreach (var order in list)
        {
            if (order.Status == OrderStatus.AguardandoPagamento)
                await orders.CancelInternalAsync(order, note, "system", restoreStock: true, ct);
        }
    }

    /// <summary>Webhook do gateway (idempotente por provider + id do evento).</summary>
    public async Task<bool> HandleWebhookAsync(WebhookRequest request, CancellationToken ct)
    {
        var evt = await gateway.ParseWebhookAsync(request, ct);
        if (evt is null) return false;

        var duplicate = await db.WebhookEvents.AnyAsync(w => w.Provider == gateway.Name && w.ExternalId == evt.EventId, ct);
        if (duplicate) return true;

        var record = new WebhookEvent
        {
            Provider = gateway.Name,
            ExternalId = evt.EventId,
            Type = evt.Type,
            PayloadJson = evt.RawPayload,
            ReceivedAt = Now,
        };
        db.WebhookEvents.Add(record);
        await db.SaveChangesAsync(ct);

        try
        {
            var payment = evt.PaymentId is { } pid
                ? await db.Payments.FirstOrDefaultAsync(p => p.Id == pid, ct)
                : await db.Payments.FirstOrDefaultAsync(p => p.GatewayPaymentId == evt.GatewayPaymentId, ct);
            if (payment is null)
            {
                record.Error = "Pagamento não encontrado.";
                record.ProcessedAt = Now;
                await db.SaveChangesAsync(ct);
                return true;
            }

            var status = evt.NewStatus ?? (evt.GatewayPaymentId is null ? null : await gateway.GetStatusAsync(evt.GatewayPaymentId, ct));
            switch (status)
            {
                case PaymentStatus.Aprovado: await ApproveAsync(payment, evt.OccurredAt, ct); break;
                case PaymentStatus.Recusado: await DeclineAsync(payment, "Pagamento recusado.", ct); break;
                case PaymentStatus.Expirado: await ExpireAsync(payment, ct); break;
                case PaymentStatus.Estornado: await RefundAsync(payment, evt.OccurredAt, ct); break;
            }
            record.ProcessedAt = Now;
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Erro ao processar webhook {Provider}/{EventId}", gateway.Name, evt.EventId);
            record.Error = ex.Message;
            await db.SaveChangesAsync(ct);
            throw;
        }
    }

    /// <summary>Job: expira cobranças pendentes vencidas (Pix 30 min, boleto após o vencimento).</summary>
    public async Task<int> ExpirePendingAsync(CancellationToken ct)
    {
        var now = Now;
        var expired = await db.Payments.Where(p => p.Status == PaymentStatus.Pendente && p.ExpiresAt != null && p.ExpiresAt < now).ToListAsync(ct);
        foreach (var payment in expired) await ExpireAsync(payment, ct);
        return expired.Count;
    }
}
