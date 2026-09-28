using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

public sealed class ShippingService(
    IAppDbContext db,
    IPostalCodeLookup postalCodes,
    IShippingRateProvider rateProvider,
    PlatformSettingsProvider settingsProvider)
{
    public async Task<PostalCodeLookupDto> LookupAsync(string cep, CancellationToken ct)
    {
        var digits = Documents.OnlyDigits(cep);
        if (digits.Length != 8) throw AppException.Validation("postalCode", "CEP deve ter 8 dígitos.");
        var info = await postalCodes.LookupAsync(digits, ct) ?? throw AppException.NotFound("CEP");
        return new PostalCodeLookupDto(info.PostalCode, info.Street, info.Neighborhood, info.City, info.State);
    }

    public async Task<ShippingQuoteDto> QuoteAsync(ShippingQuoteRequest request, CancellationToken ct)
    {
        var cep = Documents.OnlyDigits(request.PostalCode);
        if (cep.Length != 8) throw AppException.Validation("postalCode", "CEP inválido.");
        if (request.Items is null || request.Items.Count == 0) throw AppException.Validation("items", "Informe ao menos um item.");

        var seller = await db.Sellers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == request.SellerId, ct)
                     ?? throw AppException.NotFound("Loja");
        var destination = await postalCodes.LookupAsync(cep, ct) ?? throw AppException.NotFound("CEP");

        var lines = await ResolveLinesAsync(request.Items, seller.Id, ct);
        var settings = await settingsProvider.GetAsync(ct);
        var options = await QuoteForSellerAsync(seller, cep, lines, settings, ct);

        return new ShippingQuoteDto(cep, new ShippingDestinationDto(destination.City, destination.State), seller.Id, options);
    }

    public sealed record ResolvedLine(Product Product, ProductVariant? Variant, int Quantity)
    {
        public Money UnitPrice => Variant?.Price ?? Product.Price;
        public Money LineTotal => UnitPrice.Multiply(Quantity);
        public string? VariantLabel => Variant?.Label;
        public int AvailableStock => Variant?.Stock ?? Product.Stock;
    }

    /// <summary>Carrega produtos/variantes dos itens e valida pertencimento à loja e quantidades.</summary>
    public async Task<List<ResolvedLine>> ResolveLinesAsync(IReadOnlyList<ShippingQuoteItem> items, Guid sellerId, CancellationToken ct)
    {
        var ids = items.Select(i => i.ProductId).Distinct().ToList();
        var products = await db.Products.AsNoTracking()
            .Include(p => p.Seller)
            .Include(p => p.Images)
            .Include(p => p.Variants)
            .Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        var errors = new ValidationErrors();
        var lines = new List<ResolvedLine>();
        foreach (var item in items)
        {
            if (!products.TryGetValue(item.ProductId, out var product) || product.Status != ProductStatus.Ativo)
            {
                errors.Add("items", $"Produto {item.ProductId} não encontrado.");
                continue;
            }
            if (product.SellerId != sellerId)
            {
                errors.Add("items", $"O produto \"{product.Name}\" não pertence a esta loja.");
                continue;
            }
            ProductVariant? variant = null;
            if (item.VariantId is { } vid)
            {
                variant = product.Variants.FirstOrDefault(v => v.Id == vid);
                if (variant is null)
                {
                    errors.Add("items", $"Variação inválida para \"{product.Name}\".");
                    continue;
                }
            }
            else if (product.Variants.Count > 0)
            {
                errors.Add("items", $"Escolha uma variação de \"{product.Name}\".");
                continue;
            }
            if (item.Quantity <= 0) errors.Add("items", $"Quantidade inválida para \"{product.Name}\".");
            lines.Add(new ResolvedLine(product, variant, item.Quantity));
        }
        errors.ThrowIfAny();
        return lines;
    }

    public async Task<IReadOnlyList<ShippingOptionDto>> QuoteForSellerAsync(
        Seller seller, string cep, IReadOnlyList<ResolvedLine> lines, PlatformSettings settings, CancellationToken ct)
    {
        var subtotal = Money.Sum(lines.Select(l => l.LineTotal));
        var freeShipping = lines.Count > 0
                           && lines.All(l => l.Product.FreeShipping)
                           && subtotal.Amount >= settings.FreeShippingThresholdAmount;
        var units = Math.Max(1, lines.Sum(l => l.Quantity));
        var options = await rateProvider.QuoteAsync(seller.Id, seller.City, cep, new ShippingParcel(units, subtotal.Amount), freeShipping, ct);
        return options.Select(o => new ShippingOptionDto(o.Id, o.Carrier, o.Service, o.Price, o.EstimatedDays, o.Description)).ToList();
    }
}
