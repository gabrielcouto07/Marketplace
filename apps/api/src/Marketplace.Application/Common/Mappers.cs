using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;

namespace Marketplace.Application.Common;

public static class Mappers
{
    public static ExchangeRateDto ToDto(this ExchangeRate r) =>
        new(r.Id, r.From, r.To, r.Numerator, r.Denominator, r.DisplayRate, r.QuotedAt, r.ExpiresAt);

    public static CategoryDto ToDto(this Category c, int productCount) =>
        new(c.Id, c.Slug, c.Name, c.IconKey, c.ImageUrl, c.ParentId, productCount);

    public static CategoryRefDto ToRef(this Category c) => new(c.Id, c.Slug, c.Name);

    public static SellerSummaryDto ToSummary(this Seller s) =>
        new(s.Id, s.Slug, s.Name, s.LogoUrl, s.ReputationLevel, s.IsOfficialStore, s.City);

    public static SellerDto ToDto(this Seller s, int productCount) =>
        new(
            s.Id, s.Slug, s.Name, s.LogoUrl, s.ReputationLevel, s.IsOfficialStore, s.City,
            s.Description, s.Ruc, s.Country, s.MemberSince, s.Rating, s.ReviewCount, productCount,
            new SellerMetricsDto(s.SalesCount, s.PositiveRatingPercent, s.OnTimeShippingPercent, s.AvgResponseTimeHours),
            s.ExchangePolicy, s.BannerUrl,
            s.Categories.Select(sc => sc.Category.ToRef()).ToList());

    public static string Thumbnail(this Product p) =>
        p.Images.OrderBy(i => i.SortOrder).FirstOrDefault()?.Url ?? "/images/products/placeholder.svg";

    /// <summary>Requer Seller e Images carregados.</summary>
    public static ProductSummaryDto ToSummary(this Product p, ExchangeRate brlToPyg, DateTime now) =>
        new(
            p.Id, p.Slug, p.Name, p.Thumbnail(), p.Price, p.CompareAtPrice, brlToPyg.Convert(p.Price),
            p.DiscountPercent, p.Rating, p.ReviewCount, p.SoldCount, p.Stock, p.FreeShipping, p.IsNew(now), p.IsOffer,
            p.CategoryId, p.Seller.ToSummary(), p.CreatedAt);

    /// <summary>Requer Seller, Category, Images e Variants carregados.</summary>
    public static ProductDetailDto ToDetail(this Product p, ExchangeRate brlToPyg, DateTime now, int questionCount)
    {
        var s = p.ToSummary(brlToPyg, now);
        return new ProductDetailDto(
            s.Id, s.Slug, s.Name, s.ThumbnailUrl, s.Price, s.CompareAtPrice, s.ReferencePrice, s.DiscountPercent,
            s.Rating, s.ReviewCount, s.SoldCount, s.Stock, s.FreeShipping, s.IsNew, s.IsOffer, s.CategoryId, s.Seller,
            s.CreatedAt,
            p.Description,
            p.Images.OrderBy(i => i.SortOrder).Select(i => new ProductImageDto(i.Id, i.Url, i.Alt, i.SortOrder)).ToList(),
            p.VariantOptions.Select(o => new ProductVariantOptionDto(o.Name, o.Values)).ToList(),
            p.Variants.Select(v => new ProductVariantDto(v.Id, v.Sku, v.Attributes, v.Price, v.CompareAtPrice, v.Stock, v.ImageId)).ToList(),
            p.Attributes.Select(a => new ProductAttributeDto(a.Name, a.Value)).ToList(),
            [p.Category.ToRef()],
            p.OriginCity,
            new DayRange(p.HandlingDaysMin, p.HandlingDaysMax),
            p.WarrantyMonths,
            questionCount);
    }

    public static ReviewDto ToDto(this Review r) =>
        new(r.Id, r.ProductId, r.AuthorName, r.Rating, r.Title, r.Comment, r.CreatedAt, r.HelpfulCount, r.VerifiedPurchase);

    public static QuestionDto ToDto(this Question q) =>
        new(q.Id, q.ProductId, q.Text, q.AskedByName, q.AskedAt,
            q.AnswerText is not null && q.AnsweredAt is { } at ? new QuestionAnswerDto(q.AnswerText, at) : null);

    public static BannerDto ToDto(this Banner b) => new(b.Id, b.Title, b.Subtitle, b.ImageUrl, b.Href, b.Tone);

    public static AddressDto ToDto(this Address a) =>
        new(a.Id, a.Label, a.RecipientName, a.PostalCode, a.Street, a.Number, a.Complement, a.Neighborhood, a.City,
            a.State, a.Country, a.Phone, a.IsDefault, a.RecipientDocument);

    public static AddressSnapshot ToSnapshot(this Address a) =>
        new(a.Id, a.Label, a.RecipientName, a.PostalCode, a.Street, a.Number, a.Complement, a.Neighborhood, a.City,
            a.State, a.Country, a.Phone, a.IsDefault);

    public static AddressDto ToDto(this AddressSnapshot a) =>
        new(a.Id, a.Label, a.RecipientName, a.PostalCode, a.Street, a.Number, a.Complement, a.Neighborhood, a.City,
            a.State, a.Country, a.Phone, a.IsDefault);

    public static ShippingOptionDto ToDto(this ShippingOptionSnapshot o) =>
        new(o.Id, o.Provider ?? "table", o.ServiceCode ?? string.Empty, o.Carrier, o.Service, Money.Brl(o.PriceAmount), new DayRange(o.EstimatedDaysMin, o.EstimatedDaysMax), o.Description);

    public static ShippingOptionSnapshot ToSnapshot(this ShippingOptionDto o) =>
        new(o.Id, o.Carrier, o.Service, o.Price.Amount, o.EstimatedDays.Min, o.EstimatedDays.Max, o.Description, o.Provider, o.ServiceCode);

    public static ShippingOptionDto ToDto(this Abstractions.ShippingRateOption o) =>
        new(o.Id, o.Provider, o.ServiceCode, o.Carrier, o.Service, o.Price, o.EstimatedDays, o.Description);

    public static UserProfileDto ToDto(this User u) =>
        new(u.Id, u.FullName, u.Email, u.Phone, u.Cpf, u.AvatarUrl, u.Roles, u.CreatedAt);

    public static ConsentDto ToDto(this Consent c) => new(c.Type, c.Version, c.AcceptedAt, c.RevokedAt);

    public static PaymentDto ToDto(this Payment p) =>
        new(
            p.Id, p.PurchaseId, p.Method, p.Status, p.Money, p.CreatedAt, p.PaidAt,
            p.PixPayload is not null && p.PixExpiresAt is { } pixExp
                ? new PixPaymentDto(p.PixPayload, p.PixQrCodeImageUrl, pixExp)
                : null,
            p.BoletoDigitableLine is not null && p.BoletoDueDate is { } due
                ? new BoletoPaymentDto(p.BoletoBarcode ?? string.Empty, p.BoletoDigitableLine, p.BoletoPdfUrl ?? string.Empty, due)
                : null,
            p.CardLast4 is not null
                ? new CardPaymentDto(p.CardBrand ?? "Cartão", p.CardLast4, p.Installments ?? 1,
                    new Money(p.InstallmentAmount ?? p.Amount, p.Currency))
                : null,
            new Money(p.RefundedAmount, p.Currency));

    public static OrderItemDto ToDto(this OrderItem i) =>
        new(i.Id, i.ProductId, i.ProductSlug, i.VariantId, i.Name, i.VariantLabel, i.ThumbnailUrl, i.Quantity,
            Money.Brl(i.UnitPriceAmount), Money.Brl(i.LineTotalAmount));

    public static TrackingEventDto ToDto(this TrackingEvent e) => new(e.Code, e.Description, e.Location, e.OccurredAt);

    public static ImportTaxBreakdownDto ToDto(this ImportTaxBreakdown t) =>
        new(
            t.Regime, t.IsFinal, t.Products, t.Freight, t.Insurance, t.OtherExpenses, t.Discount, t.CustomsValue,
            t.CustomsValueUsdCents is { } usd ? new Money(usd, CurrencyCode.USD) : null,
            t.ImportDuty, t.ImportDutyBasisPoints, t.ImportDutyDeduction,
            t.Icms, t.IcmsBasisPoints, t.IcmsState,
            t.Ibs, t.IbsBasisPoints, t.IbsState, t.IbsStateBasisPoints, t.IbsMunicipal, t.IbsMunicipalBasisPoints,
            t.Cbs, t.CbsBasisPoints,
            t.TotalTaxes, t.Total, t.EffectiveBasisPoints,
            t.UsdRate is { } r ? new UsdRateDto(r.Numerator, r.Denominator, r.Display, r.QuotedAt, r.Source) : null,
            t.ExceedsSimplifiedLimit);

    public static TaxRemittanceDto ToDto(this TaxRemittance r) =>
        new(r.Status, Money.Brl(r.ImportDutyAmount), Money.Brl(r.IcmsAmount), Money.Brl(r.IbsStateAmount),
            Money.Brl(r.IbsMunicipalAmount), Money.Brl(r.CbsAmount), Money.Brl(r.TotalAmount), r.Reference, r.CreatedAt,
            r.SentAt, r.ConfirmedAt, r.LastError);

    /// <param name="labelUrl">Rota de download da etiqueta (só para vendedor/admin); nulo para o comprador.</param>
    public static ShipmentDto ToDto(this Shipment s, TaxRemittance? remittance, bool sandbox, string? labelUrl = null) =>
        new(s.Id, s.OrderId, s.Status, s.Provider, sandbox, s.Carrier, s.TrackingCode, s.DeclarationNumber,
            s.HasLabelFile || !string.IsNullOrEmpty(s.LabelUrl),
            s.HasLabelFile ? labelUrl : s.LabelUrl,
            s.CreatedAt, s.LabelIssuedAt, s.PostedAt, s.LastError, s.DirNumber, s.CustomsStatus, s.CustomsCheckedAt,
            remittance?.ToDto());

    /// <summary>"52998224725" → "***.982.247-**"; outros documentos mantêm os 3 últimos caracteres.</summary>
    public static string? MaskDocument(string? document)
    {
        if (string.IsNullOrWhiteSpace(document)) return null;
        var d = document.Trim();
        if (d.Length == 11 && d.All(char.IsAsciiDigit)) return $"***.{d[3..6]}.{d[6..9]}-**";
        return d.Length <= 3 ? new string('*', d.Length) : new string('*', d.Length - 3) + d[^3..];
    }

    /// <summary>Requer Seller, Items, Events, TrackingEvents, ExchangeRate e Payment carregados (Shipment opcional).</summary>
    public static OrderDto ToDto(this Order o, string locale, ShipmentDto? shipment = null) =>
        new(
            o.Id, o.Number, o.PurchaseId, o.Status, o.CreatedAt, o.UpdatedAt, o.Seller.ToSummary(),
            o.Items.Select(ToDto).ToList(),
            o.ShippingAddress.ToDto(),
            o.ShippingOption.ToDto(),
            o.TrackingCode,
            o.Carrier,
            o.TrackingEvents.OrderBy(e => e.OccurredAt).Select(ToDto).ToList(),
            new DateRange(o.EstimatedDeliveryMin, o.EstimatedDeliveryMax),
            new OrderTotalsDto(
                Money.Brl(o.SubtotalAmount), Money.Brl(o.ShippingAmount), Money.Brl(o.ImportTaxAmount),
                Money.Brl(o.DiscountAmount), Money.Brl(o.TotalAmount), Money.Pyg(o.TotalReferenceAmount),
                o.TaxBreakdown?.ToDto()),
            o.ExchangeRate.ToDto(),
            new OrderPaymentRefDto(o.PaymentId, o.Payment.Method, o.Payment.Status),
            o.Events.OrderBy(e => e.OccurredAt).ThenBy(e => e.Id)
                .Select(e => new OrderTimelineEventDto(e.Status, e.OccurredAt, e.Note ?? Messages.TimelineDescription(e.Status, locale), e.Location))
                .ToList(),
            shipment ?? (o.Shipment is { } sh ? sh.ToDto(null, sh.Provider.Equals("sandbox", StringComparison.OrdinalIgnoreCase)) : null));
}
