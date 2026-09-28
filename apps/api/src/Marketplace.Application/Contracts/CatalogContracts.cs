using Marketplace.Domain;
using Marketplace.Domain.Common;

namespace Marketplace.Application.Contracts;

// Espelho de packages/contracts/src/index.ts. Propriedades em PascalCase → camelCase na serialização.

public sealed record ApiErrorDto(int Status, string Code, string Message, IReadOnlyDictionary<string, string[]>? Errors, string? TraceId);

public sealed record ExchangeRateDto(
    Guid Id,
    CurrencyCode From,
    CurrencyCode To,
    long Numerator,
    long Denominator,
    string DisplayRate,
    DateTime QuotedAt,
    DateTime ExpiresAt);

public sealed record CategoryDto(Guid Id, string Slug, string Name, string IconKey, string? ImageUrl, Guid? ParentId, int ProductCount);

public sealed record CategoryRefDto(Guid Id, string Slug, string Name);

public sealed record ProductImageDto(Guid Id, string Url, string Alt, int SortOrder);

public sealed record ProductVariantOptionDto(string Name, IReadOnlyList<string> Values);

public sealed record ProductVariantDto(Guid Id, string Sku, IReadOnlyDictionary<string, string> Attributes, Money Price, Money? CompareAtPrice, int Stock, Guid? ImageId);

public sealed record ProductAttributeDto(string Name, string Value);

public sealed record SellerSummaryDto(Guid Id, string Slug, string Name, string? LogoUrl, int ReputationLevel, bool IsOfficialStore, string City);

public sealed record ProductSummaryDto(
    Guid Id,
    string Slug,
    string Name,
    string ThumbnailUrl,
    Money Price,
    Money? CompareAtPrice,
    Money ReferencePrice,
    int DiscountPercent,
    double Rating,
    int ReviewCount,
    int SoldCount,
    int Stock,
    bool FreeShipping,
    bool IsNew,
    bool IsOffer,
    Guid CategoryId,
    SellerSummaryDto Seller,
    DateTime CreatedAt);

public sealed record ProductDetailDto(
    Guid Id,
    string Slug,
    string Name,
    string ThumbnailUrl,
    Money Price,
    Money? CompareAtPrice,
    Money ReferencePrice,
    int DiscountPercent,
    double Rating,
    int ReviewCount,
    int SoldCount,
    int Stock,
    bool FreeShipping,
    bool IsNew,
    bool IsOffer,
    Guid CategoryId,
    SellerSummaryDto Seller,
    DateTime CreatedAt,
    string Description,
    IReadOnlyList<ProductImageDto> Images,
    IReadOnlyList<ProductVariantOptionDto> VariantOptions,
    IReadOnlyList<ProductVariantDto> Variants,
    IReadOnlyList<ProductAttributeDto> Attributes,
    IReadOnlyList<CategoryRefDto> CategoryPath,
    string OriginCity,
    DayRange HandlingDays,
    int? WarrantyMonths,
    int QuestionCount);

public enum ProductSort
{
    relevance,
    priceAsc,
    priceDesc,
    newest,
    bestSelling,
    rating,
}

public sealed record ProductSearchQuery(
    string? Q,
    string? CategorySlug,
    string? SellerSlug,
    long? MinPrice,
    long? MaxPrice,
    bool? FreeShipping,
    double? MinRating,
    bool? OnlyOffers,
    ProductSort Sort,
    int? Page,
    int? PageSize);

public sealed record FacetCountDto(string Slug, string Name, int Count);

public sealed record PriceRangeDto(Money Min, Money Max);

public sealed record ProductSearchFacetsDto(IReadOnlyList<FacetCountDto> Categories, IReadOnlyList<FacetCountDto> Sellers, PriceRangeDto PriceRange);

public sealed record ProductSearchResultDto(IReadOnlyList<ProductSummaryDto> Items, int Page, int PageSize, int TotalCount, ProductSearchFacetsDto Facets);

public sealed record SearchSuggestionDto(string Slug, string Name, string ThumbnailUrl);

public sealed record ReviewDto(Guid Id, Guid ProductId, string AuthorName, int Rating, string? Title, string Comment, DateTime CreatedAt, int HelpfulCount, bool VerifiedPurchase);

public sealed record ReviewSummaryDto(double Average, int Total, int[] Distribution);

public sealed record QuestionAnswerDto(string Text, DateTime AnsweredAt);

public sealed record QuestionDto(Guid Id, Guid ProductId, string Question, string AskedBy, DateTime AskedAt, QuestionAnswerDto? Answer);

public sealed record AskQuestionRequest(string? Question);

public sealed record CreateReviewRequest(int Rating, string? Title, string? Comment);

public sealed record BannerDto(Guid Id, string Title, string Subtitle, string ImageUrl, string Href, BannerTone Tone);

public sealed record HomeDto(
    IReadOnlyList<BannerDto> Banners,
    IReadOnlyList<CategoryDto> Categories,
    IReadOnlyList<ProductSummaryDto> Offers,
    IReadOnlyList<ProductSummaryDto> NewArrivals,
    IReadOnlyList<ProductSummaryDto> BestSellers,
    IReadOnlyList<SellerSummaryDto> FeaturedSellers);

public sealed record SellerMetricsDto(int SalesCount, int PositiveRatingPercent, int OnTimeShippingPercent, int AvgResponseTimeHours);

public sealed record SellerDto(
    Guid Id,
    string Slug,
    string Name,
    string? LogoUrl,
    int ReputationLevel,
    bool IsOfficialStore,
    string City,
    string Description,
    string Ruc,
    string Country,
    DateTime MemberSince,
    double Rating,
    int ReviewCount,
    int ProductCount,
    SellerMetricsDto Metrics,
    string ExchangePolicy,
    string? BannerUrl,
    IReadOnlyList<CategoryRefDto> Categories);
