using Marketplace.Domain;
using Marketplace.Domain.Common;

namespace Marketplace.Application.Contracts;

// ----- Painel do vendedor (/seller/*) -----

public sealed record SellerProfileDto(
    Guid Id,
    string Slug,
    string Name,
    string? LogoUrl,
    string? BannerUrl,
    string City,
    string Description,
    string Ruc,
    string ExchangePolicy,
    SellerStatus Status,
    int ReputationLevel,
    bool IsOfficialStore,
    double Rating,
    int ReviewCount,
    int ProductCount,
    DateTime MemberSince,
    IReadOnlyList<CategoryRefDto> Categories,
    string? OriginPostalCode,
    string? Phone);

public sealed record SellerRegisterRequest(
    string? Name,
    string? Ruc,
    string? City,
    string? Description,
    string? LogoUrl,
    string? BannerUrl,
    string? ExchangePolicy,
    IReadOnlyList<Guid>? CategoryIds,
    bool? AcceptTerms,
    string? OriginPostalCode = null,
    string? Phone = null);

public sealed record SellerProfileInput(
    string? Name,
    string? Ruc,
    string? City,
    string? Description,
    string? LogoUrl,
    string? BannerUrl,
    string? ExchangePolicy,
    IReadOnlyList<Guid>? CategoryIds,
    string? OriginPostalCode = null,
    string? Phone = null);

/// <summary>Cadastro devolve a loja e uma nova sessão (o JWT passa a carregar o papel Vendedor).</summary>
public sealed record SellerRegisterResponseDto(SellerProfileDto Seller, AuthResponseDto Session);

public sealed record SellerDashboardDto(
    Guid SellerId,
    DateRange Period,
    Money GrossSales,
    int OrdersCount,
    int PendingShipments,
    int OpenQuestions,
    int ActiveProducts,
    int ReputationLevel);

public sealed record SellerProductImageDto(Guid Id, string Url, string Alt, int SortOrder, string? StorageKey);

public sealed record SellerProductImageInput(string? Url, string? Alt, string? StorageKey);

public sealed record SellerProductListItemDto(
    Guid Id,
    string Slug,
    string Name,
    string ThumbnailUrl,
    Money Price,
    Money? CompareAtPrice,
    int Stock,
    ProductStatus Status,
    int SoldCount,
    DateTime UpdatedAt);

public sealed record SellerProductDto(
    Guid Id,
    string Slug,
    string Name,
    string Description,
    Guid CategoryId,
    Money Price,
    Money? CompareAtPrice,
    int Stock,
    bool FreeShipping,
    int? WarrantyMonths,
    DayRange HandlingDays,
    IReadOnlyList<ProductAttributeDto> Attributes,
    IReadOnlyList<SellerProductImageDto> Images,
    ProductStatus Status,
    int SoldCount,
    double Rating,
    int ReviewCount,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int? WeightGrams,
    ParcelDimensionsDto? Dimensions,
    string? HsCode);

public sealed record SellerProductInput(
    string? Name,
    string? Description,
    Guid? CategoryId,
    long? PriceAmount,
    long? CompareAtAmount,
    int? Stock,
    bool FreeShipping,
    int? WarrantyMonths,
    int? HandlingDaysMin,
    int? HandlingDaysMax,
    IReadOnlyList<ProductAttributeDto>? Attributes,
    IReadOnlyList<SellerProductImageInput>? Images,
    ProductStatus? Status,
    int? WeightGrams = null,
    ParcelDimensionsDto? Dimensions = null,
    string? HsCode = null);

/// <summary>Dimensões da embalagem em centímetros (cotação com transportadoras).</summary>
public sealed record ParcelDimensionsDto(int LengthCm, int WidthCm, int HeightCm);

public sealed record ShipOrderRequest(string? Carrier, string? TrackingCode);
