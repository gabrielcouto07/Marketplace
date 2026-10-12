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
    /// <summary>Desativada some da vitrine (ex.: a antiga categoria de bebidas, vedada pelo Anexo I, f).</summary>
    public bool IsActive { get; set; } = true;

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

    // ----- Admissão (Política de Vendedores 3.1 e 3.2) — o vendedor é pessoa jurídica estabelecida no Paraguai -----
    /// <summary>Denominação social (razão social). <see cref="Name"/> é o nome da loja na vitrine.</summary>
    public string? LegalName { get; set; }
    /// <summary>Endereço eletrônico de contato da empresa (comunicações formais da Política).</summary>
    public string? Email { get; set; }
    /// <summary>Endereço completo de origem (rua, número, bairro): remetente da declaração e da etiqueta.</summary>
    public string? LegalAddress { get; set; }
    /// <summary>Representante legal que responde pela loja e aceita a Política.</summary>
    public string? ResponsibleName { get; set; }
    public SellerDocumentType? ResponsibleDocumentType { get; set; }
    /// <summary>Documento do representante legal (cifrado em repouso).</summary>
    public string? ResponsibleDocument { get; set; }
    /// <summary>Conta bancária, carteira digital ou outro meio de pagamento associado (3.1 e).</summary>
    public SellerPayoutMethod? PayoutMethod { get; set; }
    /// <summary>Banco, carteira ou instituição.</summary>
    public string? PayoutInstitution { get; set; }
    /// <summary>Número da conta ou identificador da carteira (cifrado em repouso).</summary>
    public string? PayoutAccount { get; set; }
    public string? PayoutHolder { get; set; }
    /// <summary>Documento oficial com foto do representante legal (3.2 c).</summary>
    public string? IdentityDocumentUrl { get; set; }
    /// <summary>Constancia de RUC (3.2 b).</summary>
    public string? RucCertificateUrl { get; set; }
    /// <summary>Certificado de Cumplimiento Tributario (3.2 b).</summary>
    public string? TaxComplianceCertificateUrl { get; set; }
    /// <summary>Atos constitutivos e registro comercial (3.2 a).</summary>
    public string? ArticlesOfIncorporationUrl { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public Guid? VerifiedByUserId { get; set; }
    /// <summary>Itens conferidos pela equipe na última verificação (3.3).</summary>
    public List<string> VerificationChecklist { get; set; } = [];
    public string? SuspensionReason { get; set; }
    public DateTime? SuspendedAt { get; set; }
    /// <summary>Fim da suspensão temporária; nulo = até a revisão da equipe.</summary>
    public DateTime? SuspendedUntil { get; set; }
    /// <summary>Exclusão (suspensão permanente, 8.1 c).</summary>
    public DateTime? ExcludedAt { get; set; }

    // ----- Monitoramento (Política 4.3, 8.4 e 10.3) -----
    /// <summary>Última confirmação dos dados cadastrais pelo vendedor (a cada 12 meses).</summary>
    public DateTime? DataConfirmedAt { get; set; }
    /// <summary>Versão da Política aceita por último (aceite completo em <see cref="SellerPolicyAcceptance"/>).</summary>
    public string? PolicyVersionAccepted { get; set; }
    public DateTime? PolicyAcceptedAt { get; set; }

    /// <summary>Documento do representante e constância do RUC: o mínimo que vem do cadastro antigo.</summary>
    public bool HasVerificationDocuments =>
        !string.IsNullOrWhiteSpace(ResponsibleName) && ResponsibleDocumentType is not null &&
        !string.IsNullOrWhiteSpace(ResponsibleDocument) && !string.IsNullOrWhiteSpace(IdentityDocumentUrl) &&
        !string.IsNullOrWhiteSpace(RucCertificateUrl) && !string.IsNullOrWhiteSpace(LegalAddress);

    /// <summary>Todos os dados e documentos dos itens 3.1 e 3.2 da Política.</summary>
    public bool HasAdmissionData =>
        HasVerificationDocuments && !string.IsNullOrWhiteSpace(LegalName) && !string.IsNullOrWhiteSpace(Email) &&
        !string.IsNullOrWhiteSpace(Phone) && PayoutMethod is not null && !string.IsNullOrWhiteSpace(PayoutAccount) &&
        !string.IsNullOrWhiteSpace(PayoutHolder) && !string.IsNullOrWhiteSpace(TaxComplianceCertificateUrl) &&
        !string.IsNullOrWhiteSpace(ArticlesOfIncorporationUrl);

    /// <summary>Remetente da declaração: a denominação social; lojas antigas sem ela usam o nome da loja.</summary>
    public string SenderName => string.IsNullOrWhiteSpace(LegalName) ? Name : LegalName;

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
    /// <summary>Código NCM (8 dígitos) para a declaração aduaneira. Obrigatório para o produto ir à vitrine.</summary>
    public string? HsCode { get; set; }

    // ----- Descrição da declaração (Programa 7.4 e 7.6) -----
    /// <summary>Natureza do produto, sem expressões genéricas (ex.: "Fone de ouvido Bluetooth").</summary>
    public string? Nature { get; set; }
    public string? Brand { get; set; }
    /// <summary>O produto não tem marca: a declaração diz "sem marca" (a marca só é dispensada quando não houver).</summary>
    public bool Unbranded { get; set; }
    public string? Model { get; set; }
    public string? Material { get; set; }
    /// <summary>Unidades em cada item vendido (ex.: kit com 2 películas = 2).</summary>
    public int PackageQuantity { get; set; } = 1;
    /// <summary>País de origem (fabricação), ISO 3166-1 alfa-2.</summary>
    public string? OriginCountry { get; set; }
    /// <summary>Última verificação automática do anúncio publicado (Política 5.2).</summary>
    public DateTime? ScreenedAt { get; set; }

    public ProductStatus Status { get; set; } = ProductStatus.Ativo;
    /// <summary>Por que está em análise ou bloqueado (MARCA_PROTEGIDA, PRECO_ABAIXO_REFERENCIA, CONTRAFACAO…).</summary>
    public string? ModerationReason { get; set; }
    public string? ModerationNote { get; set; }
    public DateTime? ModeratedAt { get; set; }
    /// <summary>Nome e preço que o admin liberou: mudar qualquer um dos dois volta o produto para análise.</summary>
    public string? ApprovedName { get; set; }
    public long? ApprovedPriceAmount { get; set; }
    /// <summary>Impressão do texto e do NCM liberados pelo admin: termos de oferta vedada já conferidos não voltam à análise.</summary>
    public string? ApprovedFingerprint { get; set; }
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

    /// <summary>Tem o que a declaração pede: NCM, natureza, marca (ou "sem marca"), material, quantidade e origem.</summary>
    public bool HasDeclarationData =>
        !string.IsNullOrWhiteSpace(HsCode) && !string.IsNullOrWhiteSpace(Nature) && (Unbranded || !string.IsNullOrWhiteSpace(Brand)) &&
        !string.IsNullOrWhiteSpace(Material) && PackageQuantity >= 1 && Compliance.Countries.IsValid(OriginCountry);

    /// <summary>Descrição da mercadoria na declaração (Programa 7.4); null sem os dados.</summary>
    public string? DeclarationDescription(string? variantLabel = null) =>
        HasDeclarationData
            ? Compliance.DeclarationText.Build(Nature!, Unbranded ? null : Brand, Model, Material!, PackageQuantity, variantLabel)
            : null;

    /// <summary>Impressão do que a moderação confere (texto e NCM): muda quando o vendedor edita qualquer um deles.</summary>
    public string ListingFingerprint()
    {
        var text = Compliance.TextFold.Fold(string.Join('|', Name, Nature, Brand, Model, Material, Description, HsCode));
        return Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(text)))[..32];
    }
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
