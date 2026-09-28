using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

public sealed class CheckoutService(
    IAppDbContext db,
    ShippingService shipping,
    IPostalCodeLookup postalCodes,
    ExchangeRateService rates,
    PlatformSettingsProvider settingsProvider,
    IPaymentGateway gateway,
    OrderService orders,
    PaymentService payments,
    ICurrentUser currentUser,
    JsonSerializerOptions json,
    TimeProvider clock,
    ILogger<CheckoutService> logger)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public async Task<CheckoutQuoteDto> QuoteAsync(CheckoutQuoteRequest request, CancellationToken ct)
    {
        var cep = Documents.OnlyDigits(request.PostalCode);
        new ValidationErrors()
            .AddIf(cep.Length != 8, "postalCode", "CEP inválido.")
            .AddIf(request.Groups is null || request.Groups.Count == 0, "groups", "Carrinho vazio.")
            .ThrowIfAny();
        if (await postalCodes.LookupAsync(cep, ct) is null) throw AppException.Validation("postalCode", "CEP inválido.");

        var settings = await settingsProvider.GetAsync(ct);
        var rate = await rates.GetCurrentAsync(CurrencyCode.BRL, CurrencyCode.PYG, ct);
        var usdRate = await rates.TryGetCurrentAsync(CurrencyCode.USD, CurrencyCode.BRL, ct);
        var now = Now;

        var groups = new List<CheckoutGroupDto>();
        foreach (var g in request.Groups!)
        {
            var seller = await db.Sellers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == g.SellerId, ct)
                         ?? throw AppException.Validation("groups", $"Loja {g.SellerId} não encontrada.");
            if (g.Items is null || g.Items.Count == 0) throw AppException.Validation("items", "Grupo sem itens.");
            var lines = await shipping.ResolveLinesAsync(g.Items, seller.Id, ct);
            var stockErrors = new ValidationErrors();
            foreach (var l in lines)
                stockErrors.AddIf(l.AvailableStock < l.Quantity, "items", $"Estoque insuficiente para \"{l.Product.Name}\" (disponível: {l.AvailableStock}).");
            stockErrors.ThrowIfAny();

            var subtotal = Money.Sum(lines.Select(l => l.LineTotal));
            var options = await shipping.QuoteForSellerAsync(seller, cep, lines, settings, ct);
            var selected = options.FirstOrDefault(o => o.Id == g.ShippingOptionId) ?? options[0];
            groups.Add(new CheckoutGroupDto(
                seller.ToSummary(),
                lines.Select(l => new CheckoutLineDto(
                    l.Product.Id, l.Variant?.Id, l.Product.Name, l.VariantLabel, l.Product.Thumbnail(),
                    l.Quantity, l.UnitPrice, l.LineTotal)).ToList(),
                subtotal, options, selected.Id, selected.Price));
        }

        var subtotalAll = Money.Sum(groups.Select(g => g.Subtotal));
        var shippingTotal = Money.Sum(groups.Select(g => g.Shipping));
        var discount = await CouponDiscountAsync(request.CouponCode, subtotalAll, now, ct);
        var taxable = subtotalAll.Add(shippingTotal).Subtract(discount);
        var tax = ImportTaxCalculator.Estimate(taxable, settings, usdRate);
        var total = taxable.Add(tax.Tax);

        var quote = new CheckoutQuoteDto(
            Guid.NewGuid(), groups, subtotalAll, shippingTotal, tax.Tax, tax.EffectiveBasisPoints, discount, total,
            rate.Convert(total), rate.ToDto(), now.AddMinutes(settings.QuoteLockMinutes));

        db.CheckoutQuotes.Add(new CheckoutQuote
        {
            Id = quote.QuoteId,
            UserId = currentUser.UserId,
            ExchangeRateId = rate.Id,
            PayloadJson = JsonSerializer.Serialize(quote, json),
            TotalAmount = total.Amount,
            CreatedAt = now,
            LockedUntil = quote.LockedUntil,
        });
        await db.SaveChangesAsync(ct);
        return quote;
    }

    private async Task<Money> CouponDiscountAsync(string? code, Money subtotal, DateTime now, CancellationToken ct)
    {
        var normalized = code?.Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(normalized)) return Money.ZeroBrl;
        var coupon = await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Code == normalized, ct);
        // Cupom inválido não bloqueia a cotação (o checkout recota a cada mudança); apenas não desconta.
        if (coupon is null || !coupon.IsUsable(now, subtotal.Amount)) return Money.ZeroBrl;
        return subtotal.MultiplyBasisPoints(coupon.DiscountBasisPoints);
    }

    public async Task<PlaceOrderResponseDto> PlaceOrderAsync(PlaceOrderRequest request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var key = request.IdempotencyKey?.Trim();
        if (string.IsNullOrEmpty(key) || key.Length > 128)
            throw AppException.Validation("idempotencyKey", "Chave de idempotência obrigatória.");

        var existing = await db.Purchases.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId && p.IdempotencyKey == key, ct);
        if (existing is not null) return await BuildResponseAsync(existing.Id, ct);

        var now = Now;
        var quoteRow = await db.CheckoutQuotes.FirstOrDefaultAsync(q => q.Id == request.QuoteId, ct);
        if (quoteRow is null || !quoteRow.IsUsable(now) || (quoteRow.UserId is { } qu && qu != userId))
            throw AppException.Validation("quoteId", "Cotação expirada. Atualize o resumo do pedido.");
        if (quoteRow.ExchangeRateId != request.ExchangeRateId)
            throw AppException.Validation("exchangeRateId", "A cotação de câmbio mudou. Atualize o resumo do pedido.");
        var quote = JsonSerializer.Deserialize<CheckoutQuoteDto>(quoteRow.PayloadJson, json)
                    ?? throw AppException.Validation("quoteId", "Cotação inválida.");

        var address = await db.Addresses.AsNoTracking()
                          .FirstOrDefaultAsync(a => a.Id == request.AddressId && a.UserId == userId && a.DeletedAt == null, ct)
                      ?? throw AppException.NotFound("Endereço");

        var payment = request.Payment ?? throw AppException.Validation("payment", "Informe a forma de pagamento.");
        var payerDocument = Documents.OnlyDigits(payment.PayerDocument);
        var errors = new ValidationErrors()
            .AddIf(!Documents.IsValidCpf(payerDocument), "payerDocument", "CPF inválido.");
        if (payment.Method == PaymentMethod.Cartao)
        {
            errors.AddIf(payment.Card is null || string.IsNullOrWhiteSpace(payment.Card.Token), "card", "Dados do cartão obrigatórios.");
            errors.AddIf(payment.Card is { Installments: < 1 or > 12 }, "card", "Parcelamento inválido (1 a 12).");
        }
        errors.ThrowIfAny();

        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        AuthService.EnsureNotBlocked(user);
        var settings = await settingsProvider.GetAsync(ct);
        var rate = await db.ExchangeRates.AsNoTracking().FirstAsync(r => r.Id == quoteRow.ExchangeRateId, ct);

        // 1) Persistência (transação): compra, pedidos, itens, timeline, pagamento pendente e reserva de estoque.
        var purchaseId = Guid.NewGuid();
        var paymentId = Guid.NewGuid();
        var expiresAt = payment.Method switch
        {
            PaymentMethod.Pix => now.AddMinutes(settings.PixExpirationMinutes),
            PaymentMethod.Boleto => now.AddDays(settings.BoletoDueDays).Date.AddDays(1),
            _ => now.AddMinutes(settings.PixExpirationMinutes),
        };

        var paymentEntity = new Payment
        {
            Id = paymentId,
            PurchaseId = purchaseId,
            UserId = userId,
            Method = payment.Method,
            Status = PaymentStatus.Pendente,
            Amount = quote.Total.Amount,
            Currency = CurrencyCode.BRL,
            CreatedAt = now,
            UpdatedAt = now,
            ExpiresAt = expiresAt,
            Gateway = gateway.Name,
            PayerDocument = payerDocument,
            CardBrand = payment.Card?.Brand,
            CardLast4 = payment.Card?.Last4,
            Installments = payment.Method == PaymentMethod.Cartao ? payment.Card!.Installments : null,
            InstallmentAmount = payment.Method == PaymentMethod.Cartao
                ? quote.Total.InstallmentAmount(payment.Card!.Installments).Amount
                : null,
        };

        var purchase = new Purchase
        {
            Id = purchaseId,
            UserId = userId,
            PaymentId = paymentId,
            ExchangeRateId = rate.Id,
            QuoteId = quoteRow.Id,
            IdempotencyKey = key,
            TotalAmount = quote.Total.Amount,
            CreatedAt = now,
        };

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        db.Payments.Add(paymentEntity);
        db.Purchases.Add(purchase);

        var discountLeft = quote.Discount.Amount;
        var taxLeft = quote.EstimatedImportTax.Amount;
        for (var gi = 0; gi < quote.Groups.Count; gi++)
        {
            var group = quote.Groups[gi];
            var isLast = gi == quote.Groups.Count - 1;
            var input = request.Groups?.FirstOrDefault(g => g.SellerId == group.Seller.Id);
            // Impostos e total foram calculados com a opção selecionada na cotação; mudar o frete exige recotar.
            if (input?.ShippingOptionId is { } chosen && chosen != group.SelectedShippingOptionId)
                throw AppException.Validation("quoteId", "A opção de frete mudou. Atualize o resumo do pedido.");
            var option = group.ShippingOptions.FirstOrDefault(o => o.Id == group.SelectedShippingOptionId)
                         ?? group.ShippingOptions[0];

            var discountShare = isLast
                ? discountLeft
                : quote.Subtotal.Amount == 0 ? 0 : Money.RoundDiv(quote.Discount.Amount * group.Subtotal.Amount, quote.Subtotal.Amount);
            discountLeft -= discountShare;
            var taxable = group.Subtotal.Amount + option.Price.Amount - discountShare;
            var taxShare = isLast ? taxLeft : Money.RoundDiv(taxable * quote.ImportTaxRateBasisPoints, 10_000);
            taxLeft -= taxShare;
            var total = taxable + taxShare;

            var handlingDays = 0;
            var items = new List<OrderItem>();
            foreach (var line in group.Lines)
            {
                var product = await db.Products.Include(p => p.Variants).FirstAsync(p => p.Id == line.ProductId, ct);
                var variant = line.VariantId is { } vid ? product.Variants.First(v => v.Id == vid) : null;
                var available = variant?.Stock ?? product.Stock;
                if (available < line.Quantity)
                    throw AppException.Validation("items", $"Estoque insuficiente para \"{product.Name}\".");
                if (variant is not null)
                {
                    variant.Stock -= line.Quantity;
                    product.Stock = product.Variants.Sum(v => v.Stock);
                }
                else product.Stock -= line.Quantity;
                handlingDays = Math.Max(handlingDays, product.HandlingDaysMax);
                items.Add(new OrderItem
                {
                    Id = Guid.NewGuid(),
                    ProductId = product.Id,
                    ProductSlug = product.Slug,
                    VariantId = variant?.Id,
                    Name = product.Name,
                    VariantLabel = variant?.Label,
                    ThumbnailUrl = line.ThumbnailUrl,
                    Quantity = line.Quantity,
                    UnitPriceAmount = line.UnitPrice.Amount,
                    LineTotalAmount = line.LineTotal.Amount,
                });
            }

            var order = new Order
            {
                Id = Guid.NewGuid(),
                Number = await orders.NextNumberAsync(now, ct),
                PurchaseId = purchaseId,
                UserId = userId,
                SellerId = group.Seller.Id,
                PaymentId = paymentId,
                ExchangeRateId = rate.Id,
                Status = OrderStatus.AguardandoPagamento,
                CreatedAt = now,
                UpdatedAt = now,
                ShippingAddress = address.ToSnapshot(),
                ShippingOption = option.ToSnapshot(),
                EstimatedDeliveryMin = BusinessDays.Add(now, handlingDays + option.EstimatedDays.Min),
                EstimatedDeliveryMax = BusinessDays.Add(now, handlingDays + option.EstimatedDays.Max),
                SubtotalAmount = group.Subtotal.Amount,
                ShippingAmount = option.Price.Amount,
                ImportTaxAmount = taxShare,
                DiscountAmount = discountShare,
                TotalAmount = total,
                TotalReferenceAmount = rate.Convert(Money.Brl(total)).Amount,
                Items = items,
                Events = [new OrderEvent { Status = OrderStatus.AguardandoPagamento, OccurredAt = now, Actor = "system" }],
            };
            db.Orders.Add(order);
        }

        quoteRow.ConsumedAt = now;
        if (quote.Discount.Amount > 0 && !string.IsNullOrWhiteSpace(purchase.CouponCode))
        {
            var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Code == purchase.CouponCode, ct);
            if (coupon is not null) coupon.UsedCount++;
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        // 2) Gateway (fora da transação): cria a cobrança e aplica o resultado.
        try
        {
            var result = await gateway.CreatePaymentAsync(new CreatePaymentRequest(
                paymentId, purchaseId, payment.Method, quote.Total, payerDocument, user.FullName, user.Email,
                $"Marketplace PY — compra {purchaseId.ToString()[..8]}", expiresAt,
                payment.Card is null ? null : new CardTokenInput(payment.Card.Token!, payment.Card.HolderName ?? user.FullName,
                    payment.Card.Brand ?? "Cartão", payment.Card.Last4 ?? "0000", payment.Card.Installments),
                quote.Subtotal.MultiplyBasisPoints(settings.PlatformFeeBasisPoints)), ct);
            await payments.ApplyGatewayResultAsync(paymentId, result, ct);
        }
        catch (Exception ex) when (ex is not AppException)
        {
            logger.LogError(ex, "Falha no gateway {Gateway} ao criar pagamento {PaymentId}", gateway.Name, paymentId);
            await payments.MarkFailedAsync(paymentId, "Falha de comunicação com o gateway de pagamento.", ct);
        }

        return await BuildResponseAsync(purchaseId, ct);
    }

    private async Task<PlaceOrderResponseDto> BuildResponseAsync(Guid purchaseId, CancellationToken ct)
    {
        var purchase = await db.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchaseId, ct);
        var list = await orders.ByPurchaseInternalAsync(purchaseId, ct);
        var payment = await db.Payments.AsNoTracking().FirstAsync(p => p.Id == purchase.PaymentId, ct);
        return new PlaceOrderResponseDto(purchase.Id, list, payment.ToDto());
    }
}
