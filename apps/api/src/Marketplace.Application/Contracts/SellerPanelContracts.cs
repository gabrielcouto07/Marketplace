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
    string? Phone,
    SellerVerificationDto? Verification = null,
    /// <summary>Denominação social (pessoa jurídica paraguaia).</summary>
    string? LegalName = null,
    string? Email = null);

/// <summary>
/// Dados de admissão do vendedor (Política de Vendedores 3.1 e 3.2). Documento e conta voltam mascarados; os arquivos
/// voltam como links temporários (armazenamento privado).
/// </summary>
public sealed record SellerVerificationDto(
    string? LegalAddress,
    string? ResponsibleName,
    SellerDocumentType? ResponsibleDocumentType,
    string? ResponsibleDocumentMasked,
    string? IdentityDocumentUrl,
    string? RucCertificateUrl,
    bool Complete,
    DateTime? VerifiedAt,
    string? SuspensionReason,
    string? TaxComplianceCertificateUrl = null,
    string? ArticlesOfIncorporationUrl = null,
    SellerPayoutMethod? PayoutMethod = null,
    string? PayoutInstitution = null,
    string? PayoutAccountMasked = null,
    string? PayoutHolder = null,
    /// <summary>Tudo o que os itens 3.1 e 3.2 pedem está preenchido.</summary>
    bool AdmissionComplete = false,
    IReadOnlyList<string>? MissingAdmissionData = null,
    IReadOnlyList<string>? Checklist = null,
    string? PolicyVersionAccepted = null,
    DateTime? PolicyAcceptedAt = null,
    DateTime? DataConfirmedAt = null,
    DateTime? SuspendedUntil = null,
    /// <summary>Chaves dos documentos (para reenviar o formulário sem trocar o arquivo).</summary>
    IReadOnlyDictionary<string, string>? DocumentKeys = null);

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
    string? Phone = null,
    string? LegalAddress = null,
    string? ResponsibleName = null,
    SellerDocumentType? ResponsibleDocumentType = null,
    string? ResponsibleDocument = null,
    string? IdentityDocumentUrl = null,
    string? RucCertificateUrl = null,
    string? LegalName = null,
    string? Email = null,
    SellerPayoutMethod? PayoutMethod = null,
    string? PayoutInstitution = null,
    string? PayoutAccount = null,
    string? PayoutHolder = null,
    string? TaxComplianceCertificateUrl = null,
    string? ArticlesOfIncorporationUrl = null,
    /// <summary>Aceite eletrônico da Política de Vendedores (Política 2.2).</summary>
    bool? AcceptSellerPolicy = null,
    /// <summary>Quem aceita declara ser o representante legal da empresa.</summary>
    bool? RepresentativeDeclaration = null);

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
    string? Phone = null,
    string? LegalAddress = null,
    string? ResponsibleName = null,
    SellerDocumentType? ResponsibleDocumentType = null,
    /// <summary>Nulo mantém o documento atual (o perfil só devolve a versão mascarada).</summary>
    string? ResponsibleDocument = null,
    string? IdentityDocumentUrl = null,
    string? RucCertificateUrl = null,
    string? LegalName = null,
    string? Email = null,
    SellerPayoutMethod? PayoutMethod = null,
    string? PayoutInstitution = null,
    /// <summary>Nulo mantém a conta atual (o perfil só devolve a versão mascarada).</summary>
    string? PayoutAccount = null,
    string? PayoutHolder = null,
    string? TaxComplianceCertificateUrl = null,
    string? ArticlesOfIncorporationUrl = null);

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
    DateTime UpdatedAt,
    string? ModerationReason = null,
    string? HsCode = null);

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
    string? HsCode,
    string? ModerationReason = null,
    string? ModerationNote = null,
    string? HsCodeDescription = null,
    // Descrição da declaração (Programa 7.4 e 7.6)
    string? Nature = null,
    string? Brand = null,
    bool Unbranded = false,
    string? Model = null,
    string? Material = null,
    int PackageQuantity = 1,
    string? OriginCountry = null,
    /// <summary>Como a mercadoria sai na declaração (null enquanto faltar dado).</summary>
    string? DeclarationPreview = null);

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
    string? HsCode = null,
    string? Nature = null,
    string? Brand = null,
    bool Unbranded = false,
    string? Model = null,
    string? Material = null,
    int? PackageQuantity = null,
    string? OriginCountry = null);

/// <summary>Dimensões da embalagem em centímetros (cotação com transportadoras).</summary>
public sealed record ParcelDimensionsDto(int LengthCm, int WidthCm, int HeightCm);

public sealed record ShipOrderRequest(string? Carrier, string? TrackingCode);

/// <summary>
/// Como o vendedor despacha: com a etiqueta da plataforma (operador configurado) e/ou informando o rastreio, quando a
/// plataforma não exige a etiqueta (ex.: antes de contratar o operador).
/// </summary>
public sealed record SellerShippingPolicyDto(bool RequirePlatformLabel, bool CarrierConfigured, bool Sandbox, string Carrier);
