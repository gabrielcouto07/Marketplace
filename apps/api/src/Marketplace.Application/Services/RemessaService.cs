using System.Text.Json;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Compliance;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Marketplace.Application.Services;

/// <summary>
/// Remessas no operador logístico (Portaria Coana 130/2023, art. 8º, I e III): monta os dados da declaração antecipada
/// no layout da DIR, pede a etiqueta com a identidade da plataforma, registra a postagem e repassa os tributos cobrados.
/// </summary>
public sealed class RemessaService(
    IAppDbContext db,
    IRemessaCarrierGateway carrier,
    IPlatformIdentityProvider platform,
    ExchangeRateService rates,
    PlatformSettingsProvider settingsProvider,
    OrderService orders,
    ICurrentUser currentUser,
    JsonSerializerOptions json,
    TimeProvider clock,
    ILogger<RemessaService> logger)
{
    private const int MaxRemittanceAttempts = 8;

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public bool CarrierIsSandbox => carrier.IsSandbox;

    public static string SellerLabelUrl(Guid orderId) => $"/api/seller/orders/{orderId}/shipment/label";

    public static string AdminLabelUrl(Guid shipmentId) => $"/api/admin/shipments/{shipmentId}/label";

    public async Task<ShipmentDto?> GetForOrderAsync(Guid orderId, string? labelUrl, CancellationToken ct)
    {
        var shipment = await db.Shipments.AsNoTracking().FirstOrDefaultAsync(s => s.OrderId == orderId, ct);
        if (shipment is null) return null;
        var remittance = await db.TaxRemittances.AsNoTracking().FirstOrDefaultAsync(r => r.OrderId == orderId, ct);
        return shipment.ToDto(remittance, IsSandbox(shipment), labelUrl);
    }

    private bool IsSandbox(Shipment s) => s.Provider.Equals("sandbox", StringComparison.OrdinalIgnoreCase);

    // ----- Emissão (vendedor) -----

    /// <summary>
    /// Registra a remessa no operador: valida os dados da declaração (NCM de todos os itens, CPF do destinatário,
    /// remetente com endereço), envia, guarda a etiqueta e passa o pedido para Em preparação. Requer o pedido rastreado.
    /// </summary>
    public async Task<ShipmentDto> CreateAsync(Order order, CancellationToken ct)
    {
        if (order.Status is not (OrderStatus.Pago or OrderStatus.EmPreparacao))
            throw AppException.Conflict("ORDER_INVALID_TRANSITION", "Só pedidos pagos ou em preparação recebem etiqueta.");
        var shipment = await db.Shipments.FirstOrDefaultAsync(s => s.OrderId == order.Id, ct);
        if (shipment is { Status: ShipmentStatus.EtiquetaEmitida or ShipmentStatus.Postada })
            throw AppException.Conflict("SHIPMENT_EXISTS", "Este pedido já tem etiqueta. Baixe a etiqueta emitida.");
        if (!carrier.IsConfigured)
            throw new AppException(503, "CARRIER_NOT_CONFIGURED",
                "A integração com o operador logístico não está configurada. Avise o suporte da plataforma.");

        var request = await BuildRequestAsync(order, shipment?.Id ?? Guid.NewGuid(), ct);
        var now = Now;
        if (shipment is null)
        {
            shipment = new Shipment { Id = request.ShipmentId, OrderId = order.Id, SellerId = order.SellerId, Provider = carrier.Name, CreatedAt = now };
            db.Shipments.Add(shipment);
        }
        shipment.Provider = carrier.Name;
        shipment.Attempts++;
        shipment.UpdatedAt = now;
        shipment.RequestJson = JsonSerializer.Serialize(Masked(request), json);

        RemessaShipmentResult result;
        try
        {
            result = await carrier.CreateShipmentAsync(request, ct);
        }
        catch (RemessaRejectedException ex)
        {
            await FailAsync(shipment, ex.Message, ct);
            throw new AppException(422, "SHIPMENT_REJECTED", $"O operador recusou a remessa: {ex.Message}");
        }
        catch (Exception ex) when (ex is not AppException && ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Falha ao registrar a remessa do pedido {Order} no operador {Carrier}", order.Number, carrier.Name);
            await FailAsync(shipment, "Operador indisponível. Tente de novo em alguns minutos.", ct);
            throw AppException.BadGateway("CARRIER_UNAVAILABLE", "O operador logístico não respondeu. Tente de novo em alguns minutos.");
        }

        shipment.Status = ShipmentStatus.EtiquetaEmitida;
        shipment.ProviderReference = result.ProviderReference;
        shipment.TrackingCode = result.TrackingCode.Trim().ToUpperInvariant();
        shipment.Carrier = result.Carrier;
        shipment.DeclarationNumber = result.DeclarationNumber;
        shipment.LabelUrl = result.LabelUrl;
        shipment.LastError = null;
        shipment.LabelIssuedAt = now;
        if (result.LabelPdf is { Length: > 0 } pdf)
        {
            var label = await db.ShipmentLabels.FirstOrDefaultAsync(l => l.ShipmentId == shipment.Id, ct);
            if (label is null) db.ShipmentLabels.Add(new ShipmentLabel { ShipmentId = shipment.Id, Pdf = pdf, CreatedAt = now });
            else { label.Pdf = pdf; label.CreatedAt = now; }
            shipment.HasLabelFile = true;
        }

        order.TrackingCode = shipment.TrackingCode;
        order.Carrier = shipment.Carrier;
        if (order.Status == OrderStatus.Pago) orders.Transition(order, OrderStatus.EmPreparacao, "Etiqueta emitida pela plataforma.", null, "seller");

        var taxes = request.Taxes;
        if (!await db.TaxRemittances.AnyAsync(r => r.OrderId == order.Id, ct))
            db.TaxRemittances.Add(new TaxRemittance
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                ShipmentId = shipment.Id,
                Provider = carrier.Name,
                ImportDutyAmount = taxes.ImportDuty.Amount,
                IcmsAmount = taxes.Icms.Amount,
                IbsStateAmount = taxes.IbsState.Amount,
                IbsMunicipalAmount = taxes.IbsMunicipal.Amount,
                CbsAmount = taxes.Cbs.Amount,
                TotalAmount = taxes.Total.Amount,
                CreatedAt = now,
            });
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = "shipment.create", Target = order.Number, OccurredAt = now, Details = $"{carrier.Name}:{shipment.TrackingCode}" });
        await db.SaveChangesAsync(ct);
        return (await GetForOrderAsync(order.Id, SellerLabelUrl(order.Id), ct))!;
    }

    private async Task FailAsync(Shipment shipment, string message, CancellationToken ct)
    {
        shipment.Status = ShipmentStatus.Falhou;
        shipment.LastError = message.Length > 1000 ? message[..1000] : message;
        shipment.UpdatedAt = Now;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Dados da declaração no layout da DIR. Erros de cadastro viram 422 com a lista do que falta.</summary>
    public async Task<RemessaShipmentRequest> BuildRequestAsync(Order order, Guid shipmentId, CancellationToken ct)
    {
        var seller = await db.Sellers.AsNoTracking().FirstAsync(s => s.Id == order.SellerId, ct);
        var buyer = await db.Users.AsNoTracking().FirstAsync(u => u.Id == order.UserId, ct);
        var productIds = order.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await db.Products.AsNoTracking().Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        var identity = platform.Current;

        var errors = new ValidationErrors();
        foreach (var item in order.Items)
        {
            var hs = products.GetValueOrDefault(item.ProductId)?.HsCode;
            errors.AddIf(!Ncm.IsWellFormed(hs), "items", $"\"{item.Name}\" está sem NCM válido. Complete o cadastro do produto.");
        }
        var recipientCpf = Documents.OnlyDigits(order.RecipientDocument);
        errors.AddIf(!Documents.IsValidCpf(recipientCpf), "recipient", "O pedido está sem CPF do destinatário. Fale com o suporte para corrigir antes de enviar.");
        errors.AddIf(string.IsNullOrWhiteSpace(seller.LegalAddress), "sender", "Complete o endereço de origem da loja em Configurações (vai na declaração e na etiqueta).");
        errors.AddIf(!carrier.IsSandbox && !identity.IsComplete, "platform", "Os dados da empresa (razão social e CNPJ/TIN) não estão configurados na plataforma.");
        errors.ThrowIfAny();

        var settings = await settingsProvider.GetAsync(ct);
        var taxes = order.TaxBreakdown;
        if (taxes is null)
        {
            var usd = await rates.TryGetCurrentAsync(CurrencyCode.USD, CurrencyCode.BRL, ct);
            taxes = ImportTaxCalculator.Calculate(new ImportTaxInput(Money.Brl(order.SubtotalAmount), Money.Brl(order.ShippingAmount),
                Money.Brl(order.DiscountAmount), order.ShippingAddress.State), settings, usd);
        }

        var items = order.Items.Select((item, i) =>
        {
            var product = products[item.ProductId];
            var description = item.VariantLabel is null ? item.Name : $"{item.Name} ({item.VariantLabel})";
            return new RemessaItem(i + 1, description, product.HsCode!, item.Quantity, Money.Brl(item.UnitPriceAmount),
                Money.Brl(item.LineTotalAmount), product.WeightGrams is { } w ? w * item.Quantity : null, seller.Country);
        }).ToList();
        var weight = order.Items.Sum(i => (products[i.ProductId].WeightGrams ?? ShippingQuoteContext.DefaultItemWeightGrams) * i.Quantity);
        var biggest = order.Items.Select(i => products[i.ProductId])
            .Where(p => p is { LengthCm: not null, WidthCm: not null, HeightCm: not null })
            .Select(p => new ParcelDimensions(p.LengthCm!.Value, p.WidthCm!.Value, p.HeightCm!.Value))
            .OrderByDescending(d => d.LengthCm * d.WidthCm * d.HeightCm).FirstOrDefault();

        var address = order.ShippingAddress;
        var recipient = new RemessaParty(address.RecipientName, "CPF", recipientCpf,
            $"{address.Street}, {address.Number}{(address.Complement is null ? "" : " – " + address.Complement)} – {address.Neighborhood}",
            address.City, address.State, address.PostalCode, address.Country, address.Phone ?? buyer.Phone, buyer.Email);
        var sender = new RemessaParty(seller.Name, "RUC", seller.Ruc, seller.LegalAddress!, seller.City, null, seller.OriginPostalCode,
            seller.Country, seller.Phone, null);

        var description = items.Count == 1 ? items[0].Description : $"{items.Count} itens: {string.Join("; ", items.Select(i => i.Description))}";
        return new RemessaShipmentRequest(
            shipmentId, order.Number, order.CreatedAt, identity, sender, recipient, items,
            description.Length > 4000 ? description[..4000] : description,
            taxes.Products, taxes.Freight, taxes.Insurance, taxes.Discount, taxes.CustomsValue, taxes.CustomsValueUsdCents,
            new RemessaTaxes(taxes.ImportDuty, taxes.Icms, taxes.IbsState, taxes.IbsMunicipal, taxes.Cbs, taxes.TotalTaxes),
            taxes.Regime.ToString(), taxes.UsdRate?.Display,
            weight, biggest, order.ShippingOption.ServiceCode, order.ShippingOption.Carrier);
    }

    /// <summary>Cópia para auditoria com CPF e documentos mascarados.</summary>
    private static RemessaShipmentRequest Masked(RemessaShipmentRequest r) =>
        r with
        {
            Recipient = r.Recipient with { Document = Mappers.MaskDocument(r.Recipient.Document) ?? "", Phone = null, Email = null },
        };

    public async Task<(byte[] Pdf, string FileName)> LabelAsync(Guid orderId, Guid? sellerId, CancellationToken ct)
    {
        var shipment = await db.Shipments.AsNoTracking().Include(s => s.Order)
                           .FirstOrDefaultAsync(s => s.OrderId == orderId && (sellerId == null || s.SellerId == sellerId), ct)
                       ?? throw AppException.NotFound("Etiqueta");
        var label = await db.ShipmentLabels.AsNoTracking().FirstOrDefaultAsync(l => l.ShipmentId == shipment.Id, ct)
                    ?? throw AppException.NotFound("Etiqueta");
        return (label.Pdf, $"etiqueta-{shipment.Order.Number}.pdf");
    }

    /// <summary>Chamado ao confirmar a postagem (pedido → Enviado).</summary>
    public async Task MarkPostedAsync(Guid orderId, CancellationToken ct)
    {
        var shipment = await db.Shipments.FirstOrDefaultAsync(s => s.OrderId == orderId, ct);
        if (shipment is null || shipment.Status != ShipmentStatus.EtiquetaEmitida) return;
        shipment.Status = ShipmentStatus.Postada;
        shipment.PostedAt = Now;
        shipment.UpdatedAt = Now;
    }

    // ----- Rotinas (RemessaJob) -----

    /// <summary>Repassa ao operador os tributos das remessas postadas. Devolve quantos foram enviados.</summary>
    public async Task<int> RemitPendingTaxesAsync(int batch, CancellationToken ct)
    {
        if (!carrier.IsConfigured) return 0;
        var pending = await (from r in db.TaxRemittances
                             join s in db.Shipments on r.ShipmentId equals s.Id
                             join o in db.Orders on r.OrderId equals o.Id
                             where (r.Status == TaxRemittanceStatus.Pendente || r.Status == TaxRemittanceStatus.Enviado && r.ConfirmedAt == null && r.Attempts < MaxRemittanceAttempts)
                                   && s.Status == ShipmentStatus.Postada
                             orderby r.CreatedAt
                             select new { Remittance = r, Shipment = s, o.Number, o.Payment.PaidAt })
            .Take(batch).ToListAsync(ct);
        var sent = 0;
        foreach (var item in pending)
        {
            var r = item.Remittance;
            r.Attempts++;
            try
            {
                var result = await carrier.RemitTaxesAsync(new TaxRemittanceRequest(r.Id, item.Number, item.Shipment.TrackingCode ?? "",
                    item.Shipment.ProviderReference,
                    new RemessaTaxes(Money.Brl(r.ImportDutyAmount), Money.Brl(r.IcmsAmount), Money.Brl(r.IbsStateAmount),
                        Money.Brl(r.IbsMunicipalAmount), Money.Brl(r.CbsAmount), Money.Brl(r.TotalAmount)),
                    item.PaidAt ?? r.CreatedAt), ct);
                r.Reference = result.Reference;
                r.SentAt ??= Now;
                r.Status = result.Confirmed ? TaxRemittanceStatus.Confirmado : TaxRemittanceStatus.Enviado;
                if (result.Confirmed) r.ConfirmedAt = Now;
                r.LastError = null;
                sent++;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "Repasse de tributos do pedido {Order} falhou (tentativa {Attempt})", item.Number, r.Attempts);
                r.LastError = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
                if (r.Attempts >= MaxRemittanceAttempts) r.Status = TaxRemittanceStatus.Falhou;
            }
            await db.SaveChangesAsync(ct);
        }
        return sent;
    }

    /// <summary>Avisa o operador das remessas canceladas (a etiqueta deixa de valer).</summary>
    public async Task<int> NotifyCancellationsAsync(int batch, CancellationToken ct)
    {
        if (!carrier.IsConfigured) return 0;
        var list = await db.Shipments
            .Where(s => s.Status == ShipmentStatus.Cancelada && s.CancelConfirmedAt == null && s.ProviderReference != null && s.Attempts < 20)
            .OrderBy(s => s.CancelledAt).Take(batch).ToListAsync(ct);
        foreach (var s in list)
        {
            s.Attempts++;
            try
            {
                await carrier.CancelShipmentAsync(s.ProviderReference!, ct);
                s.CancelConfirmedAt = Now;
                s.LastError = null;
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                s.LastError = $"Cancelamento no operador falhou: {ex.Message}";
            }
            s.UpdatedAt = Now;
            await db.SaveChangesAsync(ct);
        }
        return list.Count;
    }

    // ----- Admin -----

    public async Task<PagedResult<AdminShipmentListItemDto>> ListAsync(ShipmentStatus? status, string? q, int? page, int? pageSize, CancellationToken ct)
    {
        var query = from s in db.Shipments.AsNoTracking()
                    join o in db.Orders on s.OrderId equals o.Id
                    join seller in db.Sellers on s.SellerId equals seller.Id
                    join r in db.TaxRemittances on s.OrderId equals r.OrderId into rs
                    from r in rs.DefaultIfEmpty()
                    select new { s, o.Number, SellerName = seller.Name, o.ImportTaxAmount, RemittanceStatus = r == null ? (TaxRemittanceStatus?)null : r.Status };
        if (status is { } st) query = query.Where(x => x.s.Status == st);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToUpperInvariant();
            query = query.Where(x => x.Number.Contains(term) || (x.s.TrackingCode != null && x.s.TrackingCode.Contains(term)));
        }
        var paged = await query.OrderByDescending(x => x.s.CreatedAt).ToPagedAsync(page, pageSize, 20, ct);
        return paged.Map(x => new AdminShipmentListItemDto(x.s.Id, x.s.OrderId, x.Number, x.SellerName, x.s.Status, x.s.Provider,
            IsSandbox(x.s), x.s.TrackingCode, x.s.DeclarationNumber, x.s.DirNumber, x.s.CustomsStatus, x.RemittanceStatus,
            Money.Brl(x.ImportTaxAmount), x.s.CreatedAt, x.s.LastError));
    }

    public async Task<(byte[] Pdf, string FileName)> AdminLabelAsync(Guid shipmentId, CancellationToken ct)
    {
        var orderId = await db.Shipments.AsNoTracking().Where(s => s.Id == shipmentId).Select(s => (Guid?)s.OrderId).FirstOrDefaultAsync(ct)
                      ?? throw AppException.NotFound("Remessa");
        return await LabelAsync(orderId, null, ct);
    }

    /// <summary>Nova tentativa de uma remessa que falhou (mesmo pedido, mesmos dados).</summary>
    public async Task<ShipmentDto> RetryAsync(Guid shipmentId, CancellationToken ct)
    {
        var shipment = await db.Shipments.AsNoTracking().FirstOrDefaultAsync(s => s.Id == shipmentId, ct) ?? throw AppException.NotFound("Remessa");
        if (shipment.Status != ShipmentStatus.Falhou) throw AppException.Conflict("SHIPMENT_NOT_FAILED", "Só remessas com falha podem ser reenviadas.");
        var order = await orders.FullOrders().FirstAsync(o => o.Id == shipment.OrderId, ct);
        await CreateAsync(order, ct);
        return (await GetForOrderAsync(order.Id, AdminLabelUrl(shipmentId), ct))!;
    }
}
