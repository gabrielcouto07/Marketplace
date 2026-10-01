using Marketplace.Domain.Common;

namespace Marketplace.Domain.Entities;

public class Category
{
    public Guid Id { get; set; }
    public required string Slug { get; set; }
    public required string Name { get; set; }
    public required string IconKey { get; set; }
    public string? ImageUrl { get; set; }
    public Guid? ParentId { get; set; }
    public int SortOrder { get; set; }

    public List<Product> Products { get; set; } = [];
}

public class Seller
{
    public Guid Id { get; set; }
    public required string Slug { get; set; }
    public required string Name { get; set; }
    public string? LogoUrl { get; set; }
    public string? BannerUrl { get; set; }
    /// <summary>1 (vermelho) a 5 (verde escuro).</summary>
    public int ReputationLevel { get; set; } = 3;
    public bool IsOfficialStore { get; set; }
    public required string City { get; set; }
    public string Country { get; set; } = "PY";
    public string Description { get; set; } = string.Empty;
    public required string Ruc { get; set; }
    /// <summary>Código postal e telefone de origem: exigidos por transportadoras para cotação e etiqueta.</summary>
    public string? OriginPostalCode { get; set; }
    public string? Phone { get; set; }
    public DateTime MemberSince { get; set; }
    public string ExchangePolicy { get; set; } = string.Empty;
    public SellerStatus Status { get; set; } = SellerStatus.Aprovado;
    public Guid? OwnerUserId { get; set; }

    public int SalesCount { get; set; }
    public int PositiveRatingPercent { get; set; }
    public int OnTimeShippingPercent { get; set; }
    public int AvgResponseTimeHours { get; set; }
    public double Rating { get; set; }
    public int ReviewCount { get; set; }

    public List<SellerCategory> Categories { get; set; } = [];
    public List<Product> Products { get; set; } = [];
}

public class SellerCategory
{
    public Guid SellerId { get; set; }
    public Seller Seller { get; set; } = null!;
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = null!;
}

public class Product
{
    public Guid Id { get; set; }
    public Guid SellerId { get; set; }
    public Seller Seller { get; set; } = null!;
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    public required string Slug { get; set; }
    public required string Name { get; set; }
    /// <summary>Nome + loja normalizados (minúsculo, sem acento) para busca portável entre providers.</summary>
    public string SearchText { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public long PriceAmount { get; set; }
    public long? CompareAtAmount { get; set; }
    public int Stock { get; set; }
    public bool FreeShipping { get; set; }
    public int SoldCount { get; set; }
    public double Rating { get; set; }
    public int ReviewCount { get; set; }
    public required string OriginCity { get; set; }
    public int HandlingDaysMin { get; set; } = 1;
    public int HandlingDaysMax { get; set; } = 3;
    public int? WarrantyMonths { get; set; }
    /// <summary>Peso (g) e dimensões (cm) para cotação com transportadoras; nulos usam os defaults do provedor.</summary>
    public int? WeightGrams { get; set; }
    public int? LengthCm { get; set; }
    public int? WidthCm { get; set; }
    public int? HeightCm { get; set; }
    /// <summary>Código NCM/HS para a declaração aduaneira.</summary>
    public string? HsCode { get; set; }
    public ProductStatus Status { get; set; } = ProductStatus.Ativo;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    /// <summary>Opções de variação (ex.: Cor → [Preto, Azul]).</summary>
    public List<VariantOption> VariantOptions { get; set; } = [];
    /// <summary>Características exibidas na ficha técnica.</summary>
    public List<ProductAttribute> Attributes { get; set; } = [];

    public List<ProductImage> Images { get; set; } = [];
    public List<ProductVariant> Variants { get; set; } = [];
    public List<Review> Reviews { get; set; } = [];
    public List<Question> Questions { get; set; } = [];

    public Money Price => Money.Brl(PriceAmount);
    public Money? CompareAtPrice => CompareAtAmount is { } c ? Money.Brl(c) : null;

    public int DiscountPercent =>
        CompareAtAmount is { } c && c > PriceAmount && c > 0
            ? (int)Math.Round((c - PriceAmount) * 100.0 / c, MidpointRounding.AwayFromZero)
            : 0;

    public bool IsOffer => DiscountPercent >= 15;
    public bool IsNew(DateTime now) => (now - CreatedAt).TotalDays < 30;
}

public record VariantOption(string Name, List<string> Values);

public record ProductAttribute(string Name, string Value);

public class ProductImage
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public required string Url { get; set; }
    public string Alt { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    /// <summary>Chave no storage (R2/local) quando a imagem foi enviada pelo vendedor.</summary>
    public string? StorageKey { get; set; }
}

public class ProductVariant
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public required string Sku { get; set; }
    /// <summary>Ex.: { "Cor": "Preto", "Armazenamento": "256 GB" }.</summary>
    public Dictionary<string, string> Attributes { get; set; } = [];
    public long PriceAmount { get; set; }
    public long? CompareAtAmount { get; set; }
    public int Stock { get; set; }
    public Guid? ImageId { get; set; }

    public Money Price => Money.Brl(PriceAmount);
    public Money? CompareAtPrice => CompareAtAmount is { } c ? Money.Brl(c) : null;
    public string Label => string.Join(" / ", Attributes.Values);
}

public class Review
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Guid SellerId { get; set; }
    public Guid? UserId { get; set; }
    public Guid? OrderId { get; set; }
    public required string AuthorName { get; set; }
    public int Rating { get; set; }
    public string? Title { get; set; }
    public string Comment { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int HelpfulCount { get; set; }
    public bool VerifiedPurchase { get; set; }
}

public class Question
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Guid? UserId { get; set; }
    public required string AskedByName { get; set; }
    public required string Text { get; set; }
    public DateTime AskedAt { get; set; }
    public string? AnswerText { get; set; }
    public DateTime? AnsweredAt { get; set; }
}

public class Banner
{
    public Guid Id { get; set; }
    public required string Title { get; set; }
    public string Subtitle { get; set; } = string.Empty;
    public required string ImageUrl { get; set; }
    public required string Href { get; set; }
    public BannerTone Tone { get; set; } = BannerTone.neutral;
    public int SortOrder { get; set; }
    public bool Active { get; set; } = true;
}

public class Coupon
{
    public Guid Id { get; set; }
    public required string Code { get; set; }
    /// <summary>Desconto sobre o subtotal em basis points (1000 = 10%).</summary>
    public int DiscountBasisPoints { get; set; }
    public long? MinSubtotalAmount { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int? MaxUses { get; set; }
    public int UsedCount { get; set; }
    public bool Active { get; set; } = true;

    public bool IsUsable(DateTime now, long subtotalAmount) =>
        Active
        && (ExpiresAt is null || ExpiresAt > now)
        && (MaxUses is null || UsedCount < MaxUses)
        && (MinSubtotalAmount is null || subtotalAmount >= MinSubtotalAmount);
}
