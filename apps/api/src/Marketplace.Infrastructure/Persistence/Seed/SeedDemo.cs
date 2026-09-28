using Marketplace.Application.Abstractions;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Marketplace.Infrastructure.Payments;
using static Marketplace.Domain.Common.DeterministicId;
using static Marketplace.Infrastructure.Persistence.Seed.SeedCatalog;

namespace Marketplace.Infrastructure.Persistence.Seed;

/// <summary>Usuário demo (demo@mktpy.com / 123456), 2 endereços e 11 pedidos — um em cada status.</summary>
public static class SeedDemo
{
    public const string DemoEmail = "demo@mktpy.com";
    public const string DemoPassword = "123456";
    public static readonly Guid DemoUserId = Guid("user:demo");

    public static User User(IPasswordService passwords) => new()
    {
        Id = DemoUserId,
        FullName = "Gabriel Demo",
        Email = DemoEmail,
        PasswordHash = passwords.Hash(DemoPassword),
        Phone = "11987654321",
        Cpf = "52998224725",
        Roles = [UserRole.Comprador],
        EmailVerified = true,
        CreatedAt = DaysAgo(320),
        UpdatedAt = DaysAgo(320),
    };

    public static List<Address> Addresses() =>
    [
        new()
        {
            Id = Guid("address:demo:1"), UserId = DemoUserId, Label = "Casa", RecipientName = "Gabriel Demo", PostalCode = "01310100",
            Street = "Avenida Paulista", Number = "1578", Complement = "Apto 42", Neighborhood = "Bela Vista", City = "São Paulo",
            State = "SP", Phone = "11987654321", IsDefault = true, CreatedAt = DaysAgo(300),
        },
        new()
        {
            Id = Guid("address:demo:2"), UserId = DemoUserId, Label = "Trabalho", RecipientName = "Gabriel Demo", PostalCode = "80010010",
            Street = "Rua XV de Novembro", Number = "120", Complement = null, Neighborhood = "Centro", City = "Curitiba",
            State = "PR", Phone = null, IsDefault = false, CreatedAt = DaysAgo(200),
        },
    ];

    private sealed record SeedOrder(OrderStatus Status, int DaysAgo, int[] ProductIdx, PaymentMethod Method);

    private static readonly SeedOrder[] Orders =
    [
        new(OrderStatus.AguardandoPagamento, 0, [24, 27], PaymentMethod.Pix),
        new(OrderStatus.Pago, 1, [8], PaymentMethod.Cartao),
        new(OrderStatus.EmPreparacao, 3, [16, 19], PaymentMethod.Pix),
        new(OrderStatus.Enviado, 6, [40], PaymentMethod.Boleto),
        new(OrderStatus.EmTransitoInternacional, 12, [1, 7], PaymentMethod.Cartao),
        new(OrderStatus.Entregue, 20, [33], PaymentMethod.Pix),
        new(OrderStatus.Concluido, 45, [56, 58], PaymentMethod.Cartao),
        new(OrderStatus.Cancelado, 15, [12], PaymentMethod.Boleto),
        new(OrderStatus.EmDisputa, 28, [48], PaymentMethod.Pix),
        new(OrderStatus.Devolvido, 60, [3], PaymentMethod.Cartao),
        new(OrderStatus.Reembolsado, 90, [9], PaymentMethod.Pix),
    ];

    private static PaymentStatus PaymentStatusFor(OrderStatus status) => status switch
    {
        OrderStatus.AguardandoPagamento => PaymentStatus.Pendente,
        OrderStatus.Cancelado => PaymentStatus.Expirado,
        OrderStatus.Reembolsado => PaymentStatus.Estornado,
        _ => PaymentStatus.Aprovado,
    };

    private static List<OrderStatus> TimelinePath(OrderStatus status)
    {
        var happy = OrderStateMachine.HappyPath;
        return status switch
        {
            OrderStatus.Cancelado => [OrderStatus.AguardandoPagamento, OrderStatus.Cancelado],
            OrderStatus.EmDisputa => [.. happy.Take(6), OrderStatus.EmDisputa],
            OrderStatus.Devolvido => [.. happy.Take(6), OrderStatus.EmDisputa, OrderStatus.Devolvido],
            OrderStatus.Reembolsado => [.. happy.Take(6), OrderStatus.EmDisputa, OrderStatus.Devolvido, OrderStatus.Reembolsado],
            _ => [.. happy.Take(happy.ToList().IndexOf(status) + 1)],
        };
    }

    private static List<OrderEvent> BuildTimeline(Guid orderId, OrderStatus status, int createdDaysAgo)
    {
        var path = TimelinePath(status);
        var step = Math.Max(1, createdDaysAgo / Math.Max(1, path.Count));
        return path.Select((s, i) => new OrderEvent
        {
            OrderId = orderId,
            Status = s,
            OccurredAt = DaysAgo(createdDaysAgo - i * step, 9 + i),
            Location = s switch
            {
                OrderStatus.Enviado => "Ciudad del Este, PY",
                OrderStatus.EmTransitoInternacional => "Curitiba, PR",
                _ => null,
            },
            Actor = "seed",
        }).ToList();
    }

    private static readonly OrderStatus[] ShippedStatuses =
    [
        OrderStatus.Enviado, OrderStatus.EmTransitoInternacional, OrderStatus.Entregue, OrderStatus.Concluido,
        OrderStatus.EmDisputa, OrderStatus.Devolvido, OrderStatus.Reembolsado,
    ];

    private static List<TrackingEvent> BuildTracking(Guid orderId, OrderStatus status, int createdDaysAgo, string city)
    {
        bool Reached(OrderStatus s) => Array.IndexOf(ShippedStatuses, status) >= Array.IndexOf(ShippedStatuses, s);
        var events = new List<TrackingEvent>();
        if (!Reached(OrderStatus.Enviado)) return events;
        events.Add(new TrackingEvent { OrderId = orderId, Code = "POSTED", Description = "Objeto postado", Location = $"{city}, PY", OccurredAt = DaysAgo(createdDaysAgo - 3, 15), ExternalId = "seed:1" });
        events.Add(new TrackingEvent { OrderId = orderId, Code = "EXPORT", Description = "Objeto encaminhado para exportação", Location = "Asunción, PY", OccurredAt = DaysAgo(createdDaysAgo - 4, 9), ExternalId = "seed:2" });
        if (Reached(OrderStatus.EmTransitoInternacional))
        {
            events.Add(new TrackingEvent { OrderId = orderId, Code = "ARRIVED_BR", Description = "Objeto recebido no Brasil", Location = "Curitiba, PR", OccurredAt = DaysAgo(createdDaysAgo - 7, 11), ExternalId = "seed:3" });
            events.Add(new TrackingEvent { OrderId = orderId, Code = "CUSTOMS", Description = "Em fiscalização aduaneira", Location = "Curitiba, PR", OccurredAt = DaysAgo(createdDaysAgo - 8, 14), ExternalId = "seed:4" });
            events.Add(new TrackingEvent { OrderId = orderId, Code = "CUSTOMS_RELEASED", Description = "Liberado pela fiscalização", Location = "Curitiba, PR", OccurredAt = DaysAgo(createdDaysAgo - 10, 10), ExternalId = "seed:5" });
        }
        if (Reached(OrderStatus.Entregue))
        {
            events.Add(new TrackingEvent { OrderId = orderId, Code = "OUT_FOR_DELIVERY", Description = "Saiu para entrega", Location = "São Paulo, SP", OccurredAt = DaysAgo(createdDaysAgo - 13, 8), ExternalId = "seed:6" });
            events.Add(new TrackingEvent { OrderId = orderId, Code = "DELIVERED", Description = "Objeto entregue ao destinatário", Location = "São Paulo, SP", OccurredAt = DaysAgo(createdDaysAgo - 13, 14), ExternalId = "seed:7" });
        }
        return events;
    }

    public sealed record DemoOrders(List<Purchase> Purchases, List<Order> Orders, List<Payment> Payments);

    public static DemoOrders BuildOrders(
        List<Product> products, List<Seller> sellers, ExchangeRate brlToPyg, Address address,
        Func<Seller, string, int, bool, IReadOnlyList<ShippingOptionSnapshot>> quoteShipping, int importTaxBasisPoints, DateTime now)
    {
        var purchases = new List<Purchase>();
        var orders = new List<Order>();
        var payments = new List<Payment>();
        var sellerById = sellers.ToDictionary(s => s.Id);

        for (var idx = 0; idx < Orders.Length; idx++)
        {
            var seed = Orders[idx];
            var seedProducts = seed.ProductIdx.Select(i => products[i % products.Count]).ToList();
            var seller = sellerById[seedProducts[0].SellerId];
            var orderId = Guid($"order:seed:{idx}");
            var purchaseId = Guid($"purchase:seed:{idx}");
            var paymentId = Guid($"payment:seed:{idx}");

            var items = seedProducts.Select((p, i) => new OrderItem
            {
                Id = Guid($"orderitem:{p.Id}:{i}"),
                OrderId = orderId,
                ProductId = p.Id,
                ProductSlug = p.Slug,
                Name = p.Name,
                ThumbnailUrl = p.Images.OrderBy(im => im.SortOrder).First().Url,
                Quantity = 1,
                UnitPriceAmount = p.PriceAmount,
                LineTotalAmount = p.PriceAmount,
            }).ToList();

            var options = quoteShipping(seller, address.PostalCode, items.Count, seedProducts.All(p => p.FreeShipping));
            var option = options[idx % 2];
            var subtotal = items.Sum(i => i.LineTotalAmount);
            var importTax = Money.Brl(subtotal + option.PriceAmount).MultiplyBasisPoints(importTaxBasisPoints).Amount;
            var total = subtotal + option.PriceAmount + importTax;
            // O pedido "aguardando pagamento" precisa de datas reais para não ser expirado pelo job de pagamentos.
            var createdAt = seed.Status == OrderStatus.AguardandoPagamento ? now : DaysAgo(seed.DaysAgo, 10);
            var timeline = BuildTimeline(orderId, seed.Status, seed.DaysAgo);
            if (seed.Status == OrderStatus.AguardandoPagamento) foreach (var e in timeline) e.OccurredAt = now;
            var paymentStatus = PaymentStatusFor(seed.Status);

            orders.Add(new Order
            {
                Id = orderId,
                Number = $"PY-2026-{100100 + idx:000000}",
                PurchaseId = purchaseId,
                UserId = address.UserId,
                SellerId = seller.Id,
                PaymentId = paymentId,
                ExchangeRateId = brlToPyg.Id,
                Status = seed.Status,
                CreatedAt = createdAt,
                UpdatedAt = timeline.Count > 0 ? timeline[^1].OccurredAt : createdAt,
                ShippingAddress = new AddressSnapshot(address.Id, address.Label, address.RecipientName, address.PostalCode, address.Street, address.Number, address.Complement, address.Neighborhood, address.City, address.State, address.Country, address.Phone, address.IsDefault),
                ShippingOption = option,
                TrackingCode = ShippedStatuses.Contains(seed.Status) ? $"PY{700000 + idx * 137:000000000}BR" : null,
                Carrier = ShippedStatuses.Contains(seed.Status) ? option.Carrier : null,
                EstimatedDeliveryMin = createdAt.AddDays(option.EstimatedDaysMin + 2),
                EstimatedDeliveryMax = createdAt.AddDays(option.EstimatedDaysMax + 4),
                SubtotalAmount = subtotal,
                ShippingAmount = option.PriceAmount,
                ImportTaxAmount = importTax,
                DiscountAmount = 0,
                TotalAmount = total,
                TotalReferenceAmount = brlToPyg.Convert(Money.Brl(total)).Amount,
                Items = items,
                Events = timeline,
                TrackingEvents = BuildTracking(orderId, seed.Status, seed.DaysAgo, seller.City),
            });

            var amount = Money.Brl(total);
            var (barcode, line) = FakePaymentFormats.Boleto(amount);
            payments.Add(new Payment
            {
                Id = paymentId,
                PurchaseId = purchaseId,
                UserId = address.UserId,
                Method = seed.Method,
                Status = paymentStatus,
                Amount = total,
                Currency = CurrencyCode.BRL,
                CreatedAt = createdAt,
                UpdatedAt = createdAt,
                PaidAt = paymentStatus == PaymentStatus.Aprovado ? createdAt : null,
                ExpiresAt = seed.Method == PaymentMethod.Pix ? createdAt.AddMinutes(30) : seed.Method == PaymentMethod.Boleto ? createdAt.AddDays(4) : null,
                Gateway = "fake",
                GatewayPaymentId = $"fake_{paymentId:N}",
                PayerDocument = "52998224725",
                PixPayload = seed.Method == PaymentMethod.Pix ? FakePaymentFormats.PixPayload(purchaseId, amount) : null,
                PixExpiresAt = seed.Method == PaymentMethod.Pix ? createdAt.AddMinutes(30) : null,
                BoletoBarcode = seed.Method == PaymentMethod.Boleto ? barcode : null,
                BoletoDigitableLine = seed.Method == PaymentMethod.Boleto ? line : null,
                BoletoPdfUrl = seed.Method == PaymentMethod.Boleto ? $"/api/payments/{paymentId}/boleto.pdf" : null,
                BoletoDueDate = seed.Method == PaymentMethod.Boleto ? createdAt.AddDays(3) : null,
                CardBrand = seed.Method == PaymentMethod.Cartao ? "Visa" : null,
                CardLast4 = seed.Method == PaymentMethod.Cartao ? "4242" : null,
                Installments = seed.Method == PaymentMethod.Cartao ? 6 : null,
                InstallmentAmount = seed.Method == PaymentMethod.Cartao ? amount.InstallmentAmount(6).Amount : null,
            });

            purchases.Add(new Purchase
            {
                Id = purchaseId,
                UserId = address.UserId,
                PaymentId = paymentId,
                ExchangeRateId = brlToPyg.Id,
                IdempotencyKey = $"seed:{idx}",
                TotalAmount = total,
                CreatedAt = createdAt,
            });
        }

        return new DemoOrders(purchases, orders, payments);
    }
}
