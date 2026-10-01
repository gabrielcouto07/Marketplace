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
    RefundService refunds,
    IPaymentGatewayRegistry gateways,
    ICurrentUser currentUser,
    TimeProvider clock,
    ILogger<PaymentService> logger)
{
    public const string FakeGatewayName = "fake";

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public async Task<PaymentDto> GetAsync(Guid id, CancellationToken ct)
    {
        var payment = await RequireOwnedAsync(id, asNoTracking: true, ct);
        return payment.ToDto();
    }

    /// <summary>Só o dono (ou um admin) consulta o pagamento; sem sessão = 401.</summary>
    public Task<Payment> RequireOwnedAsync(Guid id, CancellationToken ct) => RequireOwnedAsync(id, asNoTracking: false, ct);

    private async Task<Payment> RequireOwnedAsync(Guid id, bool asNoTracking, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var query = asNoTracking ? db.Payments.AsNoTracking() : db.Payments;
        var payment = await query.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Pagamento");
        if (payment.UserId != userId && !currentUser.Roles.Contains(UserRole.Admin)) throw AppException.NotFound("Pagamento");
        return payment;
    }

    /// <summary>Pagamento por id sem checagem de dono — para links com token assinado (PDF do boleto).</summary>
    public async Task<Payment> FindAsync(Guid id, CancellationToken ct) =>
        await db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Pagamento");

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
        var payment = await RequireOwnedAsync(id, ct);
        if (payment.Gateway != FakeGatewayName)
            throw AppException.Conflict("SIMULATION_DISABLED", "Simulação disponível apenas com o gateway de testes.");
        if (payment.Status == PaymentStatus.Pendente) await ApproveAsync(payment, Now, ct);
        return payment.ToDto();
    }

    public async Task ApproveAsync(Payment payment, DateTime paidAt, CancellationToken ct)
    {
        if (payment.Status is PaymentStatus.Aprovado or PaymentStatus.Estornado) return;
        if (payment.Status is PaymentStatus.Expirado or PaymentStatus.Recusado)
        {
            // Confirmado depois de expirar/recusar: os pedidos já foram cancelados e o estoque devolvido.
            // O dinheiro entrou, então estorna na hora em vez de deixar o comprador pagando por nada.
            logger.LogWarning("Pagamento {PaymentId} aprovado após {Status}: estornando automaticamente", payment.Id, payment.Status);
            payment.Status = PaymentStatus.Aprovado;
            payment.PaidAt = paidAt;
            var refunded = await refunds.RefundRemainingAsync(payment, ct);
            payment.Status = PaymentStatus.Estornado;
            payment.FailureReason = refunded
                ? "Pago após o prazo: estornado automaticamente."
                : "Pago após o prazo: estorno pendente de processamento manual.";
            payment.UpdatedAt = Now;
            await db.SaveChangesAsync(ct);
            return;
        }

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
                var quantity = item.Quantity;
                await db.Products.Where(p => p.Id == item.ProductId)
                    .ExecuteUpdateAsync(s => s.SetProperty(p => p.SoldCount, p => p.SoldCount + quantity), ct);
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
    }

    public async Task ExpireAsync(Payment payment, CancellationToken ct)
    {
        if (payment.IsFinal) return;
        payment.Status = PaymentStatus.Expirado;
        payment.UpdatedAt = Now;
        await CancelPurchaseOrdersAsync(payment.PurchaseId, "Pagamento expirado.", ct);
    }

    /// <summary>Estorno sinalizado pelo gateway (refunded/charged_back): tudo que puder vira Reembolsado.</summary>
    public async Task RefundAsync(Payment payment, DateTime occurredAt, CancellationToken ct)
    {
        if (payment.Status == PaymentStatus.Estornado) return;
        payment.Status = PaymentStatus.Estornado;
        payment.RefundedAmount = payment.Amount;
        payment.RefundedAt = occurredAt;
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

    /// <summary>Cancela os pedidos ainda aguardando pagamento e salva pagamento + pedidos + estoque numa só transação.</summary>
    private async Task CancelPurchaseOrdersAsync(Guid purchaseId, string note, CancellationToken ct)
    {
        var list = await orders.FullOrders().Where(o => o.PurchaseId == purchaseId).ToListAsync(ct);
        var cancelled = list.Where(o => o.Status == OrderStatus.AguardandoPagamento).ToList();
        foreach (var order in cancelled) orders.MarkCancelled(order, note, "system");
        await orders.CommitCancellationAsync(cancelled, ct);
    }

    /// <summary>
    /// Webhook de um gateway. Idempotente por (gateway, id do evento) e registrado em webhook_events. Em falha o
    /// registro guarda o erro e o gateway reenvia (não recebe 2xx); pagamento desconhecido = 404 pelo mesmo motivo
    /// (o webhook pode chegar antes de gravarmos o id do gateway).
    /// </summary>
    public async Task<bool> HandleWebhookAsync(string gatewayName, WebhookRequest request, CancellationToken ct)
    {
        if (!gateways.TryGet(gatewayName, out var gateway)) throw AppException.NotFound("Gateway de pagamento");
        var evt = await gateway.ParseWebhookAsync(request, ct);
        if (evt is null) return false;

        var record = await db.WebhookEvents.FirstOrDefaultAsync(w => w.Provider == gateway.Name && w.ExternalId == evt.EventId, ct);
        if (record?.ProcessedAt is not null) return true;
        if (record is null)
        {
            record = new WebhookEvent
            {
                Provider = gateway.Name,
                ExternalId = evt.EventId,
                Type = evt.Type,
                PayloadJson = evt.RawPayload,
                ReceivedAt = Now,
            };
            db.WebhookEvents.Add(record);
        }
        record.Attempts++;
        await db.SaveChangesAsync(ct);

        try
        {
            GatewayPaymentStatus? remote = null;
            var payment = await FindForEventAsync(evt, ct);
            if (payment is null && evt.GatewayPaymentId is not null)
            {
                // Corrida com o checkout: o gateway já conhece a cobrança, mas ainda não gravamos o id. A referência
                // externa (nosso PaymentId) resolve.
                remote = await gateway.GetStatusAsync(evt.GatewayPaymentId, ct);
                if (Guid.TryParse(remote.ExternalReference, out var refId))
                {
                    payment = await db.Payments.FirstOrDefaultAsync(p => p.Id == refId, ct);
                    if (payment is not null) payment.GatewayPaymentId ??= evt.GatewayPaymentId;
                }
            }
            if (payment is null)
            {
                record.Error = "Pagamento não encontrado.";
                await db.SaveChangesAsync(ct);
                throw AppException.NotFound("Pagamento");
            }

            var status = evt.NewStatus;
            var amount = evt.Amount;
            var paidAt = evt.OccurredAt;
            if (status is null)
            {
                var gatewayId = payment.GatewayPaymentId ?? evt.GatewayPaymentId;
                if (gatewayId is not null)
                {
                    remote ??= await gateway.GetStatusAsync(gatewayId, ct);
                    status = remote.Status;
                    amount ??= remote.Amount;
                    paidAt = remote.PaidAt ?? paidAt;
                }
            }

            if (status == PaymentStatus.Aprovado && amount is { } paid && (paid.Amount != payment.Amount || paid.Currency != payment.Currency))
            {
                // Valor diferente do cobrado: não aprova. Fica registrado para revisão manual (reenviar não resolve).
                record.Error = $"Valor divergente: gateway {paid.Amount} {paid.Currency}, esperado {payment.Amount} {payment.Currency}.";
                record.ProcessedAt = Now;
                logger.LogError("Webhook {Gateway}/{EventId} com valor divergente para o pagamento {PaymentId}", gateway.Name, evt.EventId, payment.Id);
                await db.SaveChangesAsync(ct);
                return true;
            }

            switch (status)
            {
                case PaymentStatus.Aprovado: await ApproveAsync(payment, paidAt, ct); break;
                case PaymentStatus.Recusado: await DeclineAsync(payment, "Pagamento recusado.", ct); break;
                case PaymentStatus.Expirado: await ExpireAsync(payment, ct); break;
                case PaymentStatus.Estornado: await RefundAsync(payment, paidAt, ct); break;
            }
            record.ProcessedAt = Now;
            record.Error = null;
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (Exception ex) when (ex is not AppException)
        {
            logger.LogError(ex, "Erro ao processar webhook {Gateway}/{EventId}", gateway.Name, evt.EventId);
            // Descarta mudanças parciais e guarda só o erro; o gateway reenvia e o evento é reprocessado do zero.
            db.ChangeTracker.Clear();
            record.Error = ex.Message;
            db.WebhookEvents.Update(record);
            await db.SaveChangesAsync(ct);
            throw;
        }
    }

    private async Task<Payment?> FindForEventAsync(GatewayPaymentEvent evt, CancellationToken ct)
    {
        if (evt.PaymentId is { } pid) return await db.Payments.FirstOrDefaultAsync(p => p.Id == pid, ct);
        if (evt.GatewayPaymentId is null) return null;
        return await db.Payments.FirstOrDefaultAsync(p => p.GatewayPaymentId == evt.GatewayPaymentId, ct);
    }

    /// <summary>
    /// Job: expira cobranças pendentes vencidas (Pix 30 min, boleto após o vencimento). Antes de expirar, confirma
    /// no gateway: um Pix pago no último segundo não pode ser expirado. Com o gateway fora do ar, espera a próxima
    /// rodada (até 1 dia além do vencimento).
    /// </summary>
    public async Task<int> ExpirePendingAsync(CancellationToken ct)
    {
        var now = Now;
        // UpdatedAt recente = tentativa de confirmação que falhou há pouco (ver catch abaixo): espera 1 min antes de insistir.
        var retryBefore = now.AddMinutes(-1);
        var expired = await db.Payments
            .Where(p => p.Status == PaymentStatus.Pendente && p.ExpiresAt != null && p.ExpiresAt < now && p.UpdatedAt < retryBefore)
            .ToListAsync(ct);
        var count = 0;
        foreach (var payment in expired)
        {
            if (payment.GatewayPaymentId is not null && payment.Gateway != FakeGatewayName && gateways.TryGet(payment.Gateway, out var gateway))
            {
                try
                {
                    var remote = await gateway.GetStatusAsync(payment.GatewayPaymentId, ct);
                    if (remote.Status == PaymentStatus.Aprovado)
                    {
                        await ApproveAsync(payment, remote.PaidAt ?? now, ct);
                        continue;
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "Não foi possível confirmar o pagamento {PaymentId} em {Gateway} antes de expirar", payment.Id, payment.Gateway);
                    if (payment.ExpiresAt > now.AddDays(-1))
                    {
                        // Marca a tentativa para não martelar o gateway a cada 5 s enquanto ele estiver fora.
                        payment.UpdatedAt = now;
                        await db.SaveChangesAsync(ct);
                        continue;
                    }
                }
            }
            await ExpireAsync(payment, ct);
            count++;
        }
        return count;
    }
}
