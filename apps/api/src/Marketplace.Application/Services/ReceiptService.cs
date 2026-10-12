using System.Globalization;
using System.Security.Cryptography;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Compliance;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

/// <summary>
/// Comprovante da compra guardado com cada pedido (Programa de Conformidade 10.3): o documento que comprova o valor da
/// compra (itens, frete, seguro, despesas, desconto, tributos e câmbio) e o comprovante do pagamento (meio, transação,
/// data e valor). Emitido quando o pagamento é aprovado e conservado por 5 anos (10.4), com o hash do arquivo.
/// </summary>
public sealed class ReceiptService(IAppDbContext db, IPlatformIdentityProvider platform, TimeProvider clock)
{
    public const string Kind = "comprovante-compra";
    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    /// <summary>Emite o comprovante dos pedidos pagos da compra que ainda não têm um. Não salva.</summary>
    public async Task EnsureForPurchaseAsync(Guid purchaseId, CancellationToken ct)
    {
        var orderIds = await db.Orders.AsNoTracking().Where(o => o.PurchaseId == purchaseId).Select(o => o.Id).ToListAsync(ct);
        var existing = await db.OrderDocuments.AsNoTracking().Where(d => orderIds.Contains(d.OrderId) && d.Kind == Kind).Select(d => d.OrderId).ToListAsync(ct);
        foreach (var orderId in orderIds.Except(existing))
            if (await RenderAsync(orderId, ct) is { } document) db.OrderDocuments.Add(document);
    }

    /// <summary>Comprovante do pedido; pedidos pagos antes desta rotina ganham o seu na primeira consulta.</summary>
    public async Task<OrderDocument> GetOrCreateAsync(Guid orderId, CancellationToken ct)
    {
        var document = await db.OrderDocuments.AsNoTracking().FirstOrDefaultAsync(d => d.OrderId == orderId && d.Kind == Kind, ct);
        if (document is not null) return document;
        document = await RenderAsync(orderId, ct) ?? throw AppException.NotFound("Comprovante (o pagamento ainda não foi aprovado)");
        db.OrderDocuments.Add(document);
        await db.SaveChangesAsync(ct);
        return document;
    }

    private async Task<OrderDocument?> RenderAsync(Guid orderId, CancellationToken ct)
    {
        var order = await db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.Seller).Include(o => o.ExchangeRate)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return null;
        var payment = await db.Payments.AsNoTracking().FirstAsync(p => p.Id == order.PaymentId, ct);
        if (payment.PaidAt is null || payment.Status is PaymentStatus.Pendente or PaymentStatus.Recusado or PaymentStatus.Expirado) return null;
        var buyer = await db.Users.AsNoTracking().FirstAsync(u => u.Id == order.UserId, ct);
        var purchase = await db.Purchases.AsNoTracking().FirstAsync(p => p.Id == order.PurchaseId, ct);
        var siblings = await db.Orders.AsNoTracking().Where(o => o.PurchaseId == order.PurchaseId).Select(o => o.Number).OrderBy(n => n).ToListAsync(ct);
        var identity = platform.Current;
        static string Brl(long cents) => "R$ " + (cents / 100m).ToString("N2", PtBr);
        static string Date(DateTime d) => d.ToString("dd/MM/yyyy HH:mm", PtBr) + " (UTC)";

        var pdf = new TextPdf()
            .Title($"{identity.Brand.ToUpperInvariant()} - COMPROVANTE DE COMPRA")
            .Text($"Emitido em {Date(Now)}. Documento conservado por {ProgramDeadlines.RecordRetentionYears} anos (Programa de Conformidade, item 10.4).", 8)
            .Text(identity.IsComplete
                ? $"Plataforma: {identity.LegalName} - {identity.DocumentType} {identity.Document}{(string.IsNullOrWhiteSpace(identity.AdeNumber) ? "" : $" - ADE {identity.AdeNumber}")}"
                : $"Plataforma: {identity.TradeName}", 8)
            .Heading($"Pedido {order.Number}")
            .Text($"Data do pedido: {Date(order.CreatedAt)}")
            .Text($"Vendedor (remetente): {order.Seller.SenderName} - RUC {order.Seller.Ruc} - {order.Seller.City}, Paraguai")
            .Text($"Comprador: {buyer.FullName}")
            .Text($"Destinatário: {order.ShippingAddress.RecipientName} - CPF {Mappers.MaskDocument(order.RecipientDocument) ?? "-"}")
            .Text($"Entrega: {order.ShippingAddress.City}/{order.ShippingAddress.State} - CEP {order.ShippingAddress.PostalCode}")
            .Heading("Itens");
        var n = 1;
        foreach (var item in order.Items)
        {
            pdf.Text($"{n++}. {item.Name}{(item.VariantLabel is null ? "" : $" ({item.VariantLabel})")} - {item.Quantity} x {Brl(item.UnitPriceAmount)} = {Brl(item.LineTotalAmount)}");
            if (item.HsCode is { } hs)
                pdf.Text($"    NCM {Ncm.Format(hs)} - origem {item.OriginCountry ?? "-"} - {item.DeclarationDescription ?? item.Name}", 8);
        }

        pdf.Heading("Valores cobrados na compra");
        var t = order.TaxBreakdown;
        if (t is not null)
        {
            pdf.Text($"Produtos: {Brl(t.Products.Amount)}")
                .Text($"Frete: {Brl(t.Freight.Amount)}    Seguro: {Brl(t.Insurance.Amount)}    Outras despesas: {Brl(t.OtherExpenses.Amount)}")
                .Text($"Descontos: {Brl(t.Discount.Amount)}")
                .Text($"Valor aduaneiro: {Brl(t.CustomsValue.Amount)}{(t.CustomsValueUsdCents is { } usd ? $" (US$ {(usd / 100m).ToString("N2", PtBr)})" : "")}")
                .Text($"Imposto de Importação: {Brl(t.ImportDuty.Amount)}    ICMS{(t.IcmsState is null ? "" : $" ({t.IcmsState})")}: {Brl(t.Icms.Amount)}")
                .Text($"IBS: {Brl(t.Ibs.Amount)}    CBS: {Brl(t.Cbs.Amount)}    Total de tributos: {Brl(t.TotalTaxes.Amount)}")
                .Text(t.UsdRate is { } rate ? $"Câmbio usado: {rate.Display} ({rate.Source}, {rate.QuotedAt:dd/MM/yyyy})" : "Câmbio: -", 8)
                .Text($"Regime: {(t.IsFinal ? "Remessa Conforme - tributos recolhidos na compra e repassados pela plataforma" : "estimativa")}", 8);
        }
        else
        {
            pdf.Text($"Produtos: {Brl(order.SubtotalAmount)}    Frete: {Brl(order.ShippingAmount)}    Desconto: {Brl(order.DiscountAmount)}")
                .Text($"Tributos de importação: {Brl(order.ImportTaxAmount)}");
        }
        pdf.Strong($"Total do pedido: {Brl(order.TotalAmount)}", 10);

        pdf.Heading("Pagamento")
            .Text($"Meio: {payment.Method switch { PaymentMethod.Pix => "Pix", PaymentMethod.Boleto => "Boleto", _ => $"Cartão {payment.CardBrand} final {payment.CardLast4}{(payment.Installments is > 1 ? $", {payment.Installments}x" : "")}" }}")
            .Text($"Situação: {payment.Status} - pago em {Date(payment.PaidAt.Value)}")
            .Text($"Transação: {payment.Gateway} {payment.GatewayPaymentId ?? payment.Id.ToString()}")
            .Text($"Pagador: CPF {Mappers.MaskDocument(payment.PayerDocument) ?? "-"}")
            .Text($"Valor pago na compra: {Brl(purchase.TotalAmount)}{(siblings.Count > 1 ? $" (pedidos {string.Join(", ", siblings)})" : "")}")
            .Space(10)
            .Text("Produto proveniente do exterior, importado por remessa internacional: objeto de declaração de importação e sujeito à tributação federal e estadual.", 8);

        var bytes = pdf.Build();
        return new OrderDocument
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            Kind = Kind,
            FileName = $"comprovante-{order.Number}.pdf",
            ContentType = "application/pdf",
            Content = bytes,
            Sha256 = Convert.ToHexStringLower(SHA256.HashData(bytes)),
            CreatedAt = Now,
        };
    }
}
