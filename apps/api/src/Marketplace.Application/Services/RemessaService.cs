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
    MonitoringService monitoring,
    ICurrentUser currentUser,
    JsonSerializerOptions json,
    TimeProvider clock,
    ILogger<RemessaService> logger)
{
    /// <summary>Uma conferência feita antes de enviar a declaração ao operador.</summary>
    public sealed record PreflightCheck(string Check, bool Ok, string Detail);

    private const int MaxRemittanceAttempts = 8;

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public bool CarrierIsSandbox => carrier.IsSandbox;

    public bool CarrierIsConfigured => carrier.IsConfigured;

    public string CarrierName => carrier.Name;

    public static string SellerLabelUrl(Guid orderId) => $"/api/seller/orders/{orderId}/shipment/label";

    public static string AdminLabelUrl(Guid shipmentId) => $"/api/admin/shipments/{shipmentId}/label";

    public async Task<ShipmentDto?> GetForOrderAsync(Guid orderId, string? labelUrl, CancellationToken ct)
    {
        var shipment = await db.Shipments.AsNoTracking().FirstOrDefaultAsync(s => s.OrderId == orderId, ct);
        if (shipment is null) return null;
        var remittance = await db.TaxRemittances.AsNoTracking().FirstOrDefaultAsync(r => r.OrderId == orderId, ct);
        return shipment.ToDto(remittance, IsSandbox(shipment), labelUrl);
    }

    private bool IsSandbox(Shipment s) => IsTestProvider(s.Provider);

    /// <summary>Remessa de teste: o sandbox local ou um operador em homologação (nome terminado em "-hom").</summary>
    public static bool IsTestProvider(string provider) =>
        provider.Equals("sandbox", StringComparison.OrdinalIgnoreCase) || provider.EndsWith("-hom", StringComparison.OrdinalIgnoreCase);

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

        // Indício de fracionamento da mesma loja em análise: a etiqueta espera o julgamento (Programa 6.4 e 6.5).
        if (await monitoring.HoldingAlertAsync(order.Id, ct) is { } hold)
            throw AppException.Conflict("MONITORING_HOLD",
                $"Este pedido está em análise de conformidade ({hold.Summary}). A etiqueta é liberada depois da análise da equipe.");

        var (request, checks) = await PrepareAsync(order, shipment?.Id ?? Guid.NewGuid(), strict: true, ct);
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
        shipment.ChecksJson = JsonSerializer.Serialize(checks, json);

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

    /// <summary>Dados da declaração no layout da DIR, sem as conferências (segunda via da etiqueta).</summary>
    public async Task<RemessaShipmentRequest> BuildRequestAsync(Order order, Guid shipmentId, CancellationToken ct) =>
        (await PrepareAsync(order, shipmentId, strict: false, ct)).Request;

    /// <summary>
    /// Monta a declaração no layout da DIR e, em modo estrito (emissão da etiqueta), confere antes de enviar ao operador:
    /// remetente completo e verificado (Programa 7.3), CPF do destinatário conferido na Receita (7.2), NCM, origem e
    /// descrição de cada mercadoria iguais ao vendido (7.4 a 7.6), regime de tributação (7.6) e valor declarado igual ao
    /// cobrado do comprador (6.3). Falhas viram 422 com a lista do que falta; valor divergente abre alerta e devolve 409.
    /// </summary>
    public async Task<(RemessaShipmentRequest Request, List<PreflightCheck> Checks)> PrepareAsync(Order order, Guid shipmentId, bool strict, CancellationToken ct)
    {
        var seller = await db.Sellers.AsNoTracking().FirstAsync(s => s.Id == order.SellerId, ct);
        var buyer = await db.Users.AsNoTracking().FirstAsync(u => u.Id == order.UserId, ct);
        var productIds = order.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await db.Products.AsNoTracking().Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
        var identity = platform.Current;
        var sandbox = carrier.IsSandbox;
        var checks = new List<PreflightCheck>();
        var errors = new ValidationErrors();

        // Remetente (7.1 e 7.3): a loja verificada, com denominação social, RUC válido e endereço de origem.
        var senderProblems = new List<string>();
        if (seller.Status == SellerStatus.Excluido) senderProblems.Add("loja excluída");
        if (seller.VerifiedAt is null) senderProblems.Add("cadastro ainda não verificado pela equipe");
        if (string.IsNullOrWhiteSpace(seller.LegalName)) senderProblems.Add("denominação social");
        if (!Documents.IsValidRuc(seller.Ruc)) senderProblems.Add("RUC válido");
        if (string.IsNullOrWhiteSpace(seller.LegalAddress)) senderProblems.Add("endereço de origem");
        if (string.IsNullOrWhiteSpace(seller.City) || seller.Country != "PY") senderProblems.Add("cidade e país de origem");
        checks.Add(new PreflightCheck("remetente", senderProblems.Count == 0,
            senderProblems.Count == 0 ? $"{seller.SenderName} · RUC {seller.Ruc} · {seller.City}, PY" : $"Falta: {string.Join(", ", senderProblems)}"));
        if (strict && senderProblems.Count > 0)
            errors.Add("sender", $"Dados do remetente incompletos ({string.Join(", ", senderProblems)}). Complete o cadastro da loja em Configurações.");

        // Destinatário (7.1 e 7.2): CPF válido e conferido na Receita antes de concluir a venda.
        var recipientCpf = Documents.OnlyDigits(order.RecipientDocument);
        // "sandbox" = só o dígito verificador (demonstração): com operador real a remessa exige a conferência na Receita.
        var registryChecked = order.RecipientVerifiedAt is not null && order.RecipientVerificationSource != "sandbox";
        var cpfOk = Documents.IsValidCpf(recipientCpf) && (registryChecked || sandbox);
        checks.Add(new PreflightCheck("destinatario", cpfOk, order.RecipientVerifiedAt is { } verified
            ? registryChecked
                ? $"CPF conferido em {verified:dd/MM/yyyy HH:mm} ({order.RecipientVerificationSource})"
                : $"Só o dígito verificador do CPF em {verified:dd/MM/yyyy HH:mm}, sem consulta à Receita (sandbox)"
            : sandbox ? "CPF com dígito válido (pedido anterior à conferência na Receita; sandbox)" : "CPF não conferido na Receita"));
        if (strict && !Documents.IsValidCpf(recipientCpf))
            errors.Add("recipient", "O pedido está sem CPF do destinatário. Fale com o suporte para corrigir antes de enviar.");
        else if (strict && !cpfOk)
            errors.Add("recipient", "O CPF do destinatário não foi conferido na base da Receita Federal. Fale com o suporte antes de enviar.");

        // Mercadorias (7.4 a 7.6): o que foi vendido, com NCM, origem e descrição completos.
        var items = new List<RemessaItem>();
        var sequence = 1;
        foreach (var item in order.Items)
        {
            var product = products.GetValueOrDefault(item.ProductId);
            var ncm = item.HsCode ?? product?.HsCode;
            var origin = Countries.Normalize(item.OriginCountry ?? product?.OriginCountry);
            var description = item.DeclarationDescription ?? product?.DeclarationDescription(item.VariantLabel);
            var problems = new List<string>();
            if (!Ncm.IsWellFormed(ncm)) problems.Add("NCM");
            else if (Ncm.ProhibitionReason(ncm!) is { } prohibited) problems.Add($"oferta vedada ({prohibited})");
            if (!Countries.IsValid(origin)) problems.Add("país de origem");
            if (description is null || DeclarationText.IsGeneric(description)) problems.Add("descrição da declaração (natureza, marca, material, quantidade)");
            checks.Add(new PreflightCheck($"mercadoria:{sequence}", problems.Count == 0,
                problems.Count == 0 ? $"NCM {Ncm.Format(ncm!)} · origem {origin} · {description}" : $"\"{item.Name}\": falta {string.Join(", ", problems)}"));
            if (problems.Count > 0 && (strict || !Ncm.IsWellFormed(ncm)))
                errors.Add("items", $"\"{item.Name}\": {string.Join(", ", problems)}. Complete o cadastro do produto.");
            items.Add(new RemessaItem(sequence++, description ?? (item.VariantLabel is null ? item.Name : $"{item.Name} ({item.VariantLabel})"),
                ncm ?? string.Empty, item.Quantity, Money.Brl(item.UnitPriceAmount), Money.Brl(item.LineTotalAmount),
                product?.WeightGrams is { } w ? w * item.Quantity : null, origin ?? seller.Country));
        }
        if (strict && !sandbox && !identity.IsComplete)
            errors.Add("platform", "Os dados da empresa (razão social e CNPJ/TIN) não estão configurados na plataforma.");

        var settings = await settingsProvider.GetAsync(ct);
        var taxes = order.TaxBreakdown;
        if (taxes is null)
        {
            var usd = await rates.TryGetCurrentAsync(CurrencyCode.USD, CurrencyCode.BRL, ct);
            taxes = ImportTaxCalculator.Calculate(new ImportTaxInput(Money.Brl(order.SubtotalAmount), Money.Brl(order.ShippingAmount),
                Money.Brl(order.DiscountAmount), order.ShippingAddress.State), settings, usd);
        }

        // Regime (7.6): Remessa Conforme e até US$ 3.000.
        var regimeOk = taxes.Regime == ImportTaxRegime.RemessaConforme && !taxes.ExceedsSimplifiedLimit;
        checks.Add(new PreflightCheck("regime", regimeOk, taxes.ExceedsSimplifiedLimit
            ? "Acima de US$ 3.000: fora do regime de tributação simplificada"
            : taxes.Regime == ImportTaxRegime.RemessaConforme ? "Remessa Conforme (tributos recolhidos na compra)" : "Tributos estimados (modo Flat)"));
        if (strict && taxes.ExceedsSimplifiedLimit)
            errors.Add("regime", "A remessa passa de US$ 3.000 e não cabe no regime de tributação simplificada.");
        else if (strict && !regimeOk && !sandbox)
            errors.Add("regime", "Os tributos deste pedido foram estimados fora do Remessa Conforme. Fale com o suporte.");

        // Valor (6.2 e 6.3): o valor declarado é o cobrado do comprador (produto + frete + seguro + despesas − desconto).
        var itemsTotal = order.Items.Sum(i => i.LineTotalAmount);
        var declared = taxes.CustomsValue.Amount;
        var charged = order.SubtotalAmount + order.ShippingAmount + taxes.Insurance.Amount + taxes.OtherExpenses.Amount - order.DiscountAmount;
        var valueOk = declared == charged && taxes.Products.Amount == order.SubtotalAmount && taxes.Freight.Amount == order.ShippingAmount
                      && taxes.Discount.Amount == order.DiscountAmount && taxes.Total.Amount == order.TotalAmount && itemsTotal == order.SubtotalAmount;
        if (valueOk && strict && order.Payment is { } payment)
        {
            var purchaseTotal = await db.Orders.Where(o => o.PurchaseId == order.PurchaseId).SumAsync(o => o.TotalAmount, ct);
            valueOk = payment.Status == PaymentStatus.Aprovado && payment.Amount == purchaseTotal;
        }
        checks.Add(new PreflightCheck("valor", valueOk, string.Create(System.Globalization.CultureInfo.GetCultureInfo("pt-BR"),
            $"Declarado R$ {declared / 100m:N2} · cobrado R$ {charged / 100m:N2} · total do pedido R$ {order.TotalAmount / 100m:N2}")));
        if (strict && !valueOk)
        {
            await monitoring.RaiseAsync(MonitoringAlertType.ValorDeclarado, $"valor:{order.Id:N}", order.SellerId, order.UserId,
                $"Pedido {order.Number}: valor da declaração diferente do cobrado do comprador (declarado {declared}, cobrado {charged}).",
                [order.Id], new { declared, charged, order.TotalAmount, itemsTotal }, holdsShipments: true, ct);
            await db.SaveChangesAsync(ct);
            throw AppException.Conflict("DECLARED_VALUE_MISMATCH",
                "O valor da declaração não confere com o valor cobrado do comprador. A remessa ficou retida para análise da equipe.");
        }
        errors.ThrowIfAny();

        var weight = order.Items.Sum(i => (products.GetValueOrDefault(i.ProductId)?.WeightGrams ?? ShippingQuoteContext.DefaultItemWeightGrams) * i.Quantity);
        var biggest = order.Items.Select(i => products.GetValueOrDefault(i.ProductId))
            .Where(p => p is { LengthCm: not null, WidthCm: not null, HeightCm: not null })
            .Select(p => new ParcelDimensions(p!.LengthCm!.Value, p.WidthCm!.Value, p.HeightCm!.Value))
            .OrderByDescending(d => d.LengthCm * d.WidthCm * d.HeightCm).FirstOrDefault();

        var address = order.ShippingAddress;
        var recipient = new RemessaParty(address.RecipientName, "CPF", recipientCpf,
            $"{address.Street}, {address.Number}{(address.Complement is null ? "" : " – " + address.Complement)} – {address.Neighborhood}",
            address.City, address.State, address.PostalCode, address.Country, address.Phone ?? buyer.Phone, buyer.Email,
            address.Street, address.Number, address.Complement, address.Neighborhood);
        var sender = new RemessaParty(seller.SenderName, "RUC", seller.Ruc, seller.LegalAddress ?? seller.City, seller.City, null, seller.OriginPostalCode,
            seller.Country, seller.Phone, seller.Email);

        var summary = items.Count == 1 ? items[0].Description : $"{items.Count} itens: {string.Join("; ", items.Select(i => i.Description))}";
        var request = new RemessaShipmentRequest(
            shipmentId, order.Number, order.CreatedAt, identity, sender, recipient, items,
            summary.Length > 4000 ? summary[..4000] : summary,
            taxes.Products, taxes.Freight, taxes.Insurance, taxes.Discount, taxes.CustomsValue, taxes.CustomsValueUsdCents,
            new RemessaTaxes(taxes.ImportDuty, taxes.Icms, taxes.IbsState, taxes.IbsMunicipal, taxes.Cbs, taxes.TotalTaxes),
            taxes.Regime.ToString(), taxes.UsdRate?.Display,
            weight, biggest, order.ShippingOption.ServiceCode, order.ShippingOption.Carrier);
        return (request, checks);
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
        var fileName = $"etiqueta-{shipment.Order.Number}.pdf";
        var label = await db.ShipmentLabels.AsNoTracking().FirstOrDefaultAsync(l => l.ShipmentId == shipment.Id, ct);
        if (label is not null) return (label.Pdf, fileName);

        // Segunda via: remessa do mesmo operador sem o arquivo guardado (ex.: dados de demonstração do sandbox).
        if (shipment.TrackingCode is { } tracking && shipment.Provider == carrier.Name)
        {
            var order = await db.Orders.AsNoTracking().Include(o => o.Items).FirstAsync(o => o.Id == shipment.OrderId, ct);
            var request = await BuildRequestAsync(order, shipment.Id, ct);
            var pdf = await carrier.ReprintLabelAsync(request, tracking, shipment.Carrier ?? order.ShippingOption.Carrier,
                shipment.DeclarationNumber, ct);
            if (pdf is { Length: > 0 }) return (pdf, fileName);
        }
        throw AppException.NotFound("Etiqueta");
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
            Money.Brl(x.ImportTaxAmount), x.s.CreatedAt, x.s.LastError, ReadChecks(x.s.ChecksJson)));
    }

    private IReadOnlyList<ShipmentCheckDto> ReadChecks(string? checksJson)
    {
        if (string.IsNullOrWhiteSpace(checksJson)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<ShipmentCheckDto>>(checksJson, json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
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
