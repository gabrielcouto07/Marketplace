using System.Globalization;
using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

/// <summary>
/// CEP e cotação de frete. Conversa com as transportadoras só pela porta <see cref="IShippingRateProvider"/>;
/// as regras da plataforma (frete grátis, validação de itens) ficam aqui, não no provedor.
/// </summary>
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
        var destination = await ResolveDestinationAsync(cep, ct);
        var lines = await ResolveLinesAsync(request.Items, seller.Id, ct);
        var settings = await settingsProvider.GetAsync(ct);
        var options = await QuoteForSellerAsync(seller, destination, lines, settings, ct);

        return new ShippingQuoteDto(cep, new ShippingDestinationDto(destination.City ?? string.Empty, destination.State ?? string.Empty), seller.Id, options);
    }

    /// <summary>CEP (8 dígitos) → destino com cidade/UF. CEP inexistente = 404.</summary>
    public async Task<ShippingDestination> ResolveDestinationAsync(string cep, CancellationToken ct)
    {
        var info = await postalCodes.LookupAsync(cep, ct) ?? throw AppException.NotFound("CEP");
        return new ShippingDestination(cep, info.City, info.State);
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

    /// <summary>Cota com o provedor configurado e aplica o frete grátis da plataforma. Sem opções = 422 SHIPPING_UNAVAILABLE.</summary>
    public async Task<IReadOnlyList<ShippingOptionDto>> QuoteForSellerAsync(
        Seller seller, ShippingDestination destination, IReadOnlyList<ResolvedLine> lines, PlatformSettings settings, CancellationToken ct)
    {
        var context = BuildContext(seller, destination, lines);
        var options = await rateProvider.QuoteAsync(context, ct);
        if (options.Count == 0)
            throw new AppException(422, "SHIPPING_UNAVAILABLE", "Nenhuma opção de frete disponível para este CEP.",
                new Dictionary<string, string[]> { ["postalCode"] = ["Ainda não entregamos neste CEP."] });
        return ApplyFreeShipping(options, IsFreeShippingEligible(lines, settings), settings.FreeShippingThresholdAmount);
    }

    public static ShippingQuoteContext BuildContext(Seller seller, ShippingDestination destination, IReadOnlyList<ResolvedLine> lines)
    {
        var items = lines.Select(l => new ShippingItem(
            l.Product.Id,
            l.Variant?.Id,
            l.Product.Name,
            l.Quantity,
            l.UnitPrice,
            l.Product.WeightGrams,
            l.Product is { LengthCm: { } len, WidthCm: { } wid, HeightCm: { } hei } ? new ParcelDimensions(len, wid, hei) : null,
            l.Product.HsCode)).ToList();
        return new ShippingQuoteContext(
            new ShippingOrigin(seller.Id, seller.City, seller.Country, seller.OriginPostalCode),
            destination,
            items,
            Money.Sum(lines.Select(l => l.LineTotal)));
    }

    /// <summary>Frete grátis: todos os itens da loja elegíveis e subtotal ≥ limite da plataforma.</summary>
    public static bool IsFreeShippingEligible(IReadOnlyList<ResolvedLine> lines, PlatformSettings settings)
    {
        if (lines.Count == 0 || !lines.All(l => l.Product.FreeShipping)) return false;
        return Money.Sum(lines.Select(l => l.LineTotal)).Amount >= settings.FreeShippingThresholdAmount;
    }

    /// <summary>Zera a opção mais barata (as demais continuam pagas), mantendo o id para o checkout reencontrá-la.</summary>
    public static IReadOnlyList<ShippingOptionDto> ApplyFreeShipping(IReadOnlyList<ShippingRateOption> options, bool eligible, long thresholdAmount)
    {
        var dtos = options.Select(o => o.ToDto()).ToList();
        if (!eligible || dtos.Count == 0) return dtos;
        var cheapest = 0;
        for (var i = 1; i < dtos.Count; i++)
            if (dtos[i].Price.Amount < dtos[cheapest].Price.Amount) cheapest = i;
        dtos[cheapest] = dtos[cheapest] with { Price = Money.ZeroBrl, Description = FreeShippingDescription(thresholdAmount) };
        return dtos;
    }

    public static string FreeShippingDescription(long thresholdAmount) =>
        $"Frete grátis acima de R$ {(thresholdAmount / 100m).ToString("#,##0.##", CultureInfo.GetCultureInfo("pt-BR"))} nesta loja";
}
