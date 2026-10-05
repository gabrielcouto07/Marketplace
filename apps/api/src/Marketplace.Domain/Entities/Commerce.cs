using Marketplace.Domain.Common;

namespace Marketplace.Domain.Entities;

public class ExchangeRate
{
    public Guid Id { get; set; }
    public CurrencyCode From { get; set; }
    public CurrencyCode To { get; set; }
    public long Numerator { get; set; }
    public long Denominator { get; set; }
    public required string DisplayRate { get; set; }
    public DateTime QuotedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public string Source { get; set; } = "manual";

    public Money Convert(Money amount) => amount.Convert(From, To, Numerator, Denominator);
}

/// <summary>Faixa de destino por primeiro dígito do CEP (zoneamento Correios) para tabela de frete.</summary>
public class ShippingZone
{
    public int Id { get; set; }
    /// <summary>Primeiro dígito do CEP ("0"–"9").</summary>
    public required string Prefix { get; set; }
    public required string State { get; set; }
    public required string City { get; set; }
    /// <summary>Acréscimo (pode ser negativo) em centavos sobre a base.</summary>
    public long SurchargeAmount { get; set; }
    public int ExtraDays { get; set; }
}

/// <summary>Cotação de checkout emitida (câmbio travado). O payload é o DTO devolvido ao cliente.</summary>
public class CheckoutQuote
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public Guid ExchangeRateId { get; set; }
    public required string PayloadJson { get; set; }
    public long TotalAmount { get; set; }
    /// <summary>CEP cotado (somente dígitos): o pedido só pode usar um endereço com este CEP.</summary>
    public string? PostalCode { get; set; }
    /// <summary>Cupom aplicado (normalizado) quando houve desconto.</summary>
    public string? CouponCode { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime LockedUntil { get; set; }
    public DateTime? ConsumedAt { get; set; }

    public bool IsUsable(DateTime now) => ConsumedAt is null && LockedUntil > now;
}

/// <summary>Uma compra = N pedidos (um por vendedor) = 1 pagamento.</summary>
public class Purchase
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid PaymentId { get; set; }
    public Guid ExchangeRateId { get; set; }
    public Guid? QuoteId { get; set; }
    public required string IdempotencyKey { get; set; }
    public long TotalAmount { get; set; }
    public string? CouponCode { get; set; }
    public DateTime CreatedAt { get; set; }

    public List<Order> Orders { get; set; } = [];
    public Payment Payment { get; set; } = null!;
}

public class Order
{
    public Guid Id { get; set; }
    /// <summary>Número legível, ex.: PY-2026-000123.</summary>
    public required string Number { get; set; }
    public Guid PurchaseId { get; set; }
    public Purchase Purchase { get; set; } = null!;
    public Guid UserId { get; set; }
    public Guid SellerId { get; set; }
    public Seller Seller { get; set; } = null!;
    public Guid PaymentId { get; set; }
    public Payment Payment { get; set; } = null!;
    public Guid ExchangeRateId { get; set; }
    public ExchangeRate ExchangeRate { get; set; } = null!;
    public OrderStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    /// <summary>Snapshot do endereço (imutável mesmo que o usuário edite depois).</summary>
    public required AddressSnapshot ShippingAddress { get; set; }
    public required ShippingOptionSnapshot ShippingOption { get; set; }
    public string? TrackingCode { get; set; }
    public string? Carrier { get; set; }
    public DateTime EstimatedDeliveryMin { get; set; }
    public DateTime EstimatedDeliveryMax { get; set; }

    /// <summary>CPF do destinatário no momento da compra (somente dígitos; cifrado em repouso) — vai para a DIR.</summary>
    public string? RecipientDocument { get; set; }

    public long SubtotalAmount { get; set; }
    public long ShippingAmount { get; set; }
    /// <summary>Total de tributos (II + ICMS + IBS + CBS) cobrado nesta remessa.</summary>
    public long ImportTaxAmount { get; set; }
    /// <summary>Tributos discriminados e câmbio usados na compra (nulo em pedidos anteriores à discriminação).</summary>
    public ImportTaxBreakdown? TaxBreakdown { get; set; }
    public long DiscountAmount { get; set; }
    public long TotalAmount { get; set; }
    /// <summary>Total convertido para PYG com a taxa travada.</summary>
    public long TotalReferenceAmount { get; set; }

    public List<OrderItem> Items { get; set; } = [];
    public List<OrderEvent> Events { get; set; } = [];
    public List<TrackingEvent> TrackingEvents { get; set; } = [];
    /// <summary>Remessa no operador logístico (declaração + etiqueta), criada pelo vendedor ao preparar o envio.</summary>
    public Shipment? Shipment { get; set; }

    public bool CanBeCancelled => OrderStateMachine.CanCancel(Status);
    public bool CanOpenDispute => OrderStateMachine.CanDispute(Status);
}

public record AddressSnapshot(
    Guid Id,
    string Label,
    string RecipientName,
    string PostalCode,
    string Street,
    string Number,
    string? Complement,
    string Neighborhood,
    string City,
    string State,
    string Country,
    string? Phone,
    bool IsDefault);

public record ShippingOptionSnapshot(
    Guid Id,
    string Carrier,
    string Service,
    long PriceAmount,
    int EstimatedDaysMin,
    int EstimatedDaysMax,
    string? Description,
    string? Provider = null,
    string? ServiceCode = null);

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ProductId { get; set; }
    public required string ProductSlug { get; set; }
    public Guid? VariantId { get; set; }
    public required string Name { get; set; }
    public string? VariantLabel { get; set; }
    public required string ThumbnailUrl { get; set; }
    public int Quantity { get; set; }
    public long UnitPriceAmount { get; set; }
    public long LineTotalAmount { get; set; }
}

/// <summary>Linha do tempo do pedido (uma por transição de status).</summary>
public class OrderEvent
{
    public long Id { get; set; }
    public Guid OrderId { get; set; }
    public OrderStatus Status { get; set; }
    public DateTime OccurredAt { get; set; }
    /// <summary>Texto adicional (ex.: motivo). Quando nulo, a descrição vem da tradução do status.</summary>
    public string? Note { get; set; }
    public string? Location { get; set; }
    public string? Actor { get; set; }
}

/// <summary>Evento bruto da transportadora, normalizado (POSTED, EXPORT, ARRIVED_BR, CUSTOMS…).</summary>
public class TrackingEvent
{
    public long Id { get; set; }
    public Guid OrderId { get; set; }
    public required string Code { get; set; }
    public required string Description { get; set; }
    public string Location { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; }
    /// <summary>Identificador do evento na transportadora (deduplicação).</summary>
    public string? ExternalId { get; set; }
}

public class Payment
{
    public Guid Id { get; set; }
    public Guid PurchaseId { get; set; }
    public Guid UserId { get; set; }
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; }
    public long Amount { get; set; }
    public CurrencyCode Currency { get; set; } = CurrencyCode.BRL;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public required string Gateway { get; set; }
    public string? GatewayPaymentId { get; set; }
    /// <summary>CPF do pagador (somente dígitos; cifrado em repouso).</summary>
    public string? PayerDocument { get; set; }
    public string? FailureReason { get; set; }
    /// <summary>Total já estornado (pode ser parcial: um pedido da compra por vez).</summary>
    public long RefundedAmount { get; set; }
    public string? LastRefundId { get; set; }
    public DateTime? RefundedAt { get; set; }

    public string? PixPayload { get; set; }
    public string? PixQrCodeImageUrl { get; set; }
    public DateTime? PixExpiresAt { get; set; }

    public string? BoletoBarcode { get; set; }
    public string? BoletoDigitableLine { get; set; }
    public string? BoletoPdfUrl { get; set; }
    public DateTime? BoletoDueDate { get; set; }

    public string? CardBrand { get; set; }
    public string? CardLast4 { get; set; }
    public int? Installments { get; set; }
    public long? InstallmentAmount { get; set; }

    public Money Money => new(Amount, Currency);
    public bool IsFinal => Status is PaymentStatus.Aprovado or PaymentStatus.Recusado or PaymentStatus.Expirado or PaymentStatus.Estornado;
}

/// <summary>Repasse ao vendedor por pedido (ledger). Pago pela plataforma após o prazo de retenção.</summary>
public class Payout
{
    public Guid Id { get; set; }
    public Guid SellerId { get; set; }
    public Guid OrderId { get; set; }
    public DateTime PeriodStart { get; set; }
    public DateTime PeriodEnd { get; set; }
    public long GrossAmount { get; set; }
    public long PlatformFeeAmount { get; set; }
    public long PaymentFeeAmount { get; set; }
    public long NetAmount { get; set; }
    public PayoutStatus Status { get; set; } = PayoutStatus.Agendado;
    public DateTime ScheduledFor { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? FailureReason { get; set; }
}

/// <summary>Webhooks recebidos (idempotência por provider + id externo).</summary>
public class WebhookEvent
{
    public long Id { get; set; }
    public required string Provider { get; set; }
    public required string ExternalId { get; set; }
    public required string Type { get; set; }
    public required string PayloadJson { get; set; }
    public DateTime ReceivedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public string? Error { get; set; }
    /// <summary>Tentativas de processamento (o provedor reenvia enquanto não recebe 2xx).</summary>
    public int Attempts { get; set; }
}

/// <summary>Parâmetros da plataforma (linha única). Editáveis pelo admin.</summary>
public class PlatformSettings
{
    public const string DefaultProtectedBrands =
        "Apple, iPhone, AirPods, Samsung, Xiaomi, Sony, PlayStation, Xbox, Nintendo, JBL, Bose, GoPro, Nike, Adidas, " +
        "Puma, Lacoste, Ray-Ban, Oakley, Rolex, Casio, Michael Kors, Louis Vuitton, Gucci, Prada, Chanel, Dior, " +
        "Carolina Herrera, Paco Rabanne, Calvin Klein, Hugo Boss, Johnnie Walker, Chivas, Absolut";

    public int Id { get; set; } = 1;
    public ImportTaxMode ImportTaxMode { get; set; } = ImportTaxMode.RemessaConforme;
    /// <summary>Alíquota estimada de importação no modo Flat (6000 = 60%).</summary>
    public int ImportTaxBasisPoints { get; set; } = 6000;
    /// <summary>ICMS padrão no modo RemessaConforme (1700 = 17%).</summary>
    public int IcmsBasisPoints { get; set; } = 1700;
    /// <summary>Exceções de ICMS por UF em pontos-base, ex.: "SP=2000; RJ=2000". Vazio = ICMS padrão em todas.</summary>
    public string IcmsStateOverrides { get; set; } = string.Empty;
    /// <summary>IBS estadual e municipal e CBS (LC 214/2025), sobre valor aduaneiro + II. Padrão 0 até a consultoria confirmar.</summary>
    public int IbsStateBasisPoints { get; set; }
    public int IbsMunicipalBasisPoints { get; set; }
    public int CbsBasisPoints { get; set; }
    /// <summary>Seguro da remessa sobre o valor dos produtos (0 = sem seguro; a linha aparece zerada).</summary>
    public int InsuranceBasisPoints { get; set; }
    /// <summary>Outras despesas fixas por remessa, em centavos (entram no valor aduaneiro).</summary>
    public long OtherExpensesAmount { get; set; }
    /// <summary>Ocorrências confirmadas na janela que descredenciam a loja automaticamente.</summary>
    public int SellerStrikeLimit { get; set; } = 3;
    public int StrikeWindowDays { get; set; } = 365;
    /// <summary>Produto com preço abaixo deste % da mediana do mesmo NCM vai para análise (risco de subvaloração).</summary>
    public int PriceFloorPercent { get; set; } = 40;
    /// <summary>Marcas que exigem análise antes de ir à vitrine (risco de contrafação), separadas por vírgula.</summary>
    public string ProtectedBrands { get; set; } = DefaultProtectedBrands;
    /// <summary>Envio só com etiqueta emitida pela plataforma (critério iii). Desligar só em testes.</summary>
    public bool RequirePlatformLabel { get; set; } = true;
    /// <summary>Comissão da plataforma sobre o subtotal do vendedor.</summary>
    public int PlatformFeeBasisPoints { get; set; } = 1200;
    /// <summary>Custo do meio de pagamento repassado no ledger.</summary>
    public int PaymentFeeBasisPoints { get; set; } = 349;
    public long FreeShippingThresholdAmount { get; set; } = 30000;
    public int QuoteLockMinutes { get; set; } = 15;
    public int PixExpirationMinutes { get; set; } = 30;
    public int BoletoDueDays { get; set; } = 3;
    /// <summary>Dias após a entrega para liberar o repasse.</summary>
    public int PayoutHoldDays { get; set; } = 14;
    /// <summary>Dias após a entrega para concluir o pedido automaticamente.</summary>
    public int AutoCompleteDays { get; set; } = 7;
    public string TermsVersion { get; set; } = "2026-09-01";
    public string PrivacyPolicyVersion { get; set; } = "2026-09-01";
    public DateTime UpdatedAt { get; set; }

    /// <summary>ICMS da UF de destino: exceção configurada ou o padrão.</summary>
    public int IcmsBasisPointsFor(string? state)
    {
        if (string.IsNullOrWhiteSpace(state)) return IcmsBasisPoints;
        return ParseIcmsOverrides(IcmsStateOverrides).TryGetValue(state.Trim().ToUpperInvariant(), out var bp) ? bp : IcmsBasisPoints;
    }

    /// <summary>"SP=2000; RJ=2000" → {SP: 2000, RJ: 2000}. Entradas inválidas são ignoradas (o admin valida ao salvar).</summary>
    public static Dictionary<string, int> ParseIcmsOverrides(string? raw)
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(raw)) return result;
        foreach (var part in raw.Split([';', ',', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var kv = part.Split('=', 2, StringSplitOptions.TrimEntries);
            if (kv.Length == 2 && kv[0].Length == 2 && int.TryParse(kv[1], out var bp) && bp is >= 0 and <= 5000)
                result[kv[0].ToUpperInvariant()] = bp;
        }
        return result;
    }

    public IReadOnlyList<string> ProtectedBrandList() =>
        (ProtectedBrands ?? string.Empty).Split([',', ';', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(b => b.Length >= 2).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
}

/// <summary>
/// Remessa de um pedido na transportadora/operador logístico: declaração antecipada (dados da DIR) e etiqueta com
/// marca, nome comercial e CNPJ/TIN da plataforma (Portaria Coana 130/2023, art. 8º, I e III).
/// </summary>
public class Shipment
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public Guid SellerId { get; set; }
    /// <summary>Provedor que emitiu (sandbox, http…).</summary>
    public required string Provider { get; set; }
    public ShipmentStatus Status { get; set; } = ShipmentStatus.Pendente;
    public string? ProviderReference { get; set; }
    /// <summary>Número da declaração/registro devolvido pelo operador (a DIR de 12 dígitos chega depois, pelo Siscomex).</summary>
    public string? DeclarationNumber { get; set; }
    /// <summary>Número da remessa (S10) — o mesmo do rastreio e do campo numeroRemessa da DIR.</summary>
    public string? TrackingCode { get; set; }
    public string? Carrier { get; set; }
    /// <summary>PDF guardado em <see cref="ShipmentLabel"/> (fora daqui para as listagens não carregarem o arquivo).</summary>
    public bool HasLabelFile { get; set; }
    public string? LabelUrl { get; set; }
    /// <summary>Dados enviados ao operador, com documentos mascarados (auditoria).</summary>
    public string RequestJson { get; set; } = "{}";
    public string? LastError { get; set; }
    public int Attempts { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? LabelIssuedAt { get; set; }
    public DateTime? PostedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    /// <summary>Quando o operador confirmou o cancelamento (o job tenta até conseguir).</summary>
    public DateTime? CancelConfirmedAt { get; set; }

    // ----- Situação aduaneira (consulta de remessas da ECE no Portal Único) -----
    public string? DirNumber { get; set; }
    public int? CustomsStatusCode { get; set; }
    public string? CustomsStatus { get; set; }
    public DateTime? CustomsCheckedAt { get; set; }
}

/// <summary>Etiqueta em PDF devolvida pelo operador (ou gerada no sandbox).</summary>
public class ShipmentLabel
{
    public Guid ShipmentId { get; set; }
    public required byte[] Pdf { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Repasse dos tributos de uma remessa ao operador (que recolhe à Receita e aos estados).</summary>
public class TaxRemittance
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid ShipmentId { get; set; }
    public required string Provider { get; set; }
    public TaxRemittanceStatus Status { get; set; } = TaxRemittanceStatus.Pendente;
    public long ImportDutyAmount { get; set; }
    public long IcmsAmount { get; set; }
    public long IbsStateAmount { get; set; }
    public long IbsMunicipalAmount { get; set; }
    public long CbsAmount { get; set; }
    public long TotalAmount { get; set; }
    public string? Reference { get; set; }
    public string? LastError { get; set; }
    public int Attempts { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
}

/// <summary>
/// Ocorrência que derruba um dos três indicadores da Portaria Coana 193/2026 (contrafação, subvaloração, qualidade da
/// declaração). Vem do despacho (rastreio), da consulta ao Siscomex, da ouvidoria, de denúncia procedente ou da equipe.
/// </summary>
public class ComplianceOccurrence
{
    public Guid Id { get; set; }
    public ComplianceIndicator Indicator { get; set; }
    public OccurrenceSource Source { get; set; }
    public OccurrenceStatus Status { get; set; } = OccurrenceStatus.Confirmada;
    /// <summary>Subtipo, ex.: CPF_DESTINATARIO, DADOS_REMETENTE, DESCRICAO, REGIME, CONTEUDO, VALOR_MAJORADO, FALSIFICADO.</summary>
    public required string Code { get; set; }
    public string Description { get; set; } = string.Empty;
    public Guid? SellerId { get; set; }
    public Guid? ProductId { get; set; }
    public Guid? OrderId { get; set; }
    public Guid? ShipmentId { get; set; }
    /// <summary>Identificador na origem (ex.: idOcorrencia do Siscomex) — evita duplicar na sincronização.</summary>
    public string? ExternalId { get; set; }
    /// <summary>Data do fato (despacho); define o mês da apuração.</summary>
    public DateTime OccurredAt { get; set; }
    public DateTime RegisteredAt { get; set; }
    public Guid? RegisteredByUserId { get; set; }
    public string? StatusReason { get; set; }
    public DateTime? StatusChangedAt { get; set; }
}

/// <summary>Denúncia de produto feita por um usuário (falsificação, preço suspeito, descrição errada…).</summary>
public class ProductReport
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Guid SellerId { get; set; }
    public Guid? ReporterUserId { get; set; }
    public ProductReportReason Reason { get; set; }
    public string Details { get; set; } = string.Empty;
    public ProductReportStatus Status { get; set; } = ProductReportStatus.Aberta;
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public Guid? ResolvedByUserId { get; set; }
    public string? ResolutionNote { get; set; }
    public Guid? OccurrenceId { get; set; }
}
