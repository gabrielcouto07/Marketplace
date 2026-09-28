using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

/// <summary>Área do vendedor: cadastro da loja, perfil, produtos, pedidos e indicadores.</summary>
public sealed class SellerPanelService(
    IAppDbContext db,
    AuthService auth,
    OrderService orders,
    PlatformSettingsProvider settingsProvider,
    ICurrentUser currentUser,
    TimeProvider clock)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public static readonly string[] ParaguayCities =
    [
        "Ciudad del Este", "Asunción", "Salto del Guairá", "Pedro Juan Caballero", "Encarnación", "Luque",
        "San Lorenzo", "Fernando de la Mora", "Capiatá", "Lambaré", "Hernandarias", "Presidente Franco",
    ];

    // ----- Loja -----

    /// <summary>Loja do usuário atual; 403 SELLER_REQUIRED quando ainda não é vendedor (o front redireciona ao cadastro).</summary>
    public async Task<Seller> RequireSellerAsync(CancellationToken ct, bool track = false)
    {
        var userId = currentUser.RequireUserId();
        var query = track ? db.Sellers : db.Sellers.AsNoTracking();
        var seller = await query.Include(s => s.Categories).ThenInclude(c => c.Category)
                         .FirstOrDefaultAsync(s => s.OwnerUserId == userId, ct)
                     ?? throw new AppException(403, "SELLER_REQUIRED", "Cadastre sua loja para acessar o painel do vendedor.");
        if (seller.Status == SellerStatus.Suspenso)
            throw new AppException(403, "SELLER_SUSPENDED", "Sua loja está suspensa. Fale com o suporte.");
        return seller;
    }

    public async Task<SellerProfileDto> ProfileAsync(CancellationToken ct)
    {
        var seller = await RequireSellerAsync(ct);
        return await ToProfileAsync(seller, ct);
    }

    public async Task<SellerRegisterResponseDto> RegisterAsync(SellerRegisterRequest request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.AnonymizedAt == null, ct)
                   ?? throw AppException.Unauthorized();
        if (await db.Sellers.AnyAsync(s => s.OwnerUserId == userId, ct))
            throw AppException.Conflict("SELLER_ALREADY_EXISTS", "Você já tem uma loja cadastrada.");

        var input = new SellerProfileInput(request.Name, request.Ruc, request.City, request.Description, request.LogoUrl,
            request.BannerUrl, request.ExchangePolicy, request.CategoryIds);
        var validated = await ValidateProfileAsync(input, existingId: null, ct);
        if (request.AcceptTerms != true)
            throw AppException.Validation("acceptTerms", "É preciso aceitar os termos para vendedores.");

        var now = Now;
        var seller = new Seller
        {
            Id = Guid.NewGuid(),
            Slug = await UniqueSellerSlugAsync(validated.Name, ct),
            Name = validated.Name,
            Ruc = validated.Ruc,
            City = validated.City,
            Description = validated.Description,
            LogoUrl = validated.LogoUrl,
            BannerUrl = validated.BannerUrl,
            ExchangePolicy = validated.ExchangePolicy,
            Status = SellerStatus.Aprovado,
            OwnerUserId = userId,
            MemberSince = now,
            ReputationLevel = 3,
            Categories = validated.CategoryIds.Select(id => new SellerCategory { CategoryId = id }).ToList(),
        };
        db.Sellers.Add(seller);
        if (!user.Roles.Contains(UserRole.Vendedor)) user.Roles = [.. user.Roles, UserRole.Vendedor];
        user.UpdatedAt = now;
        var settings = await settingsProvider.GetAsync(ct);
        db.Consents.Add(new Consent { Id = Guid.NewGuid(), UserId = userId, Type = ConsentType.TermosDeUso, Version = $"vendedor-{settings.TermsVersion}", AcceptedAt = now, IpAddress = currentUser.IpAddress, UserAgent = currentUser.UserAgent });
        db.AuditLogs.Add(new AuditLog { UserId = userId, Action = "seller.register", Target = seller.Id.ToString(), OccurredAt = now, IpAddress = currentUser.IpAddress });
        await db.SaveChangesAsync(ct);

        var session = await auth.ReissueSessionAsync(user, ct);
        var profile = await ToProfileAsync(await db.Sellers.AsNoTracking().Include(s => s.Categories).ThenInclude(c => c.Category).FirstAsync(s => s.Id == seller.Id, ct), ct);
        return new SellerRegisterResponseDto(profile, session);
    }

    public async Task<SellerProfileDto> UpdateProfileAsync(SellerProfileInput input, CancellationToken ct)
    {
        var seller = await RequireSellerAsync(ct, track: true);
        var validated = await ValidateProfileAsync(input, seller.Id, ct);
        seller.Name = validated.Name;
        seller.Ruc = validated.Ruc;
        seller.City = validated.City;
        seller.Description = validated.Description;
        seller.LogoUrl = validated.LogoUrl;
        seller.BannerUrl = validated.BannerUrl;
        seller.ExchangePolicy = validated.ExchangePolicy;
        seller.Categories.RemoveAll(c => !validated.CategoryIds.Contains(c.CategoryId));
        foreach (var id in validated.CategoryIds.Where(id => seller.Categories.All(c => c.CategoryId != id)))
            seller.Categories.Add(new SellerCategory { SellerId = seller.Id, CategoryId = id });
        // Produtos ativos herdam a cidade de origem da loja.
        var products = await db.Products.Where(p => p.SellerId == seller.Id).ToListAsync(ct);
        foreach (var p in products)
        {
            p.OriginCity = validated.City;
            p.SearchText = Slug.Normalize($"{p.Name} {validated.Name}");
        }
        await db.SaveChangesAsync(ct);
        var fresh = await db.Sellers.AsNoTracking().Include(s => s.Categories).ThenInclude(c => c.Category).FirstAsync(s => s.Id == seller.Id, ct);
        return await ToProfileAsync(fresh, ct);
    }

    private sealed record ValidatedProfile(string Name, string Ruc, string City, string Description, string? LogoUrl, string? BannerUrl, string ExchangePolicy, List<Guid> CategoryIds);

    private async Task<ValidatedProfile> ValidateProfileAsync(SellerProfileInput input, Guid? existingId, CancellationToken ct)
    {
        var name = input.Name?.Trim() ?? string.Empty;
        var ruc = (input.Ruc ?? string.Empty).Trim().ToUpperInvariant();
        var city = input.City?.Trim() ?? string.Empty;
        var description = input.Description?.Trim() ?? string.Empty;
        var policy = string.IsNullOrWhiteSpace(input.ExchangePolicy)
            ? "Trocas e devoluções em até 30 dias após o recebimento para produtos lacrados ou com defeito de fabricação."
            : input.ExchangePolicy.Trim();
        var categoryIds = (input.CategoryIds ?? []).Distinct().ToList();

        var errors = new ValidationErrors()
            .AddIf(name.Length < 3, "name", "Informe o nome da loja (mínimo 3 caracteres).")
            .AddIf(name.Length > 80, "name", "Nome muito longo (máximo 80 caracteres).")
            .AddIf(!Documents.IsValidRuc(ruc), "ruc", "RUC inválido (ex.: 80012345-0).")
            .AddIf(city.Length < 2, "city", "Informe a cidade de origem dos envios.")
            .AddIf(description.Length < 20, "description", "Conte um pouco sobre a loja (mínimo 20 caracteres).")
            .AddIf(description.Length > 1000, "description", "Descrição muito longa (máximo 1000 caracteres).")
            .AddIf(categoryIds.Count == 0, "categoryIds", "Escolha pelo menos uma categoria.")
            .AddIf(input.LogoUrl is { Length: > 1024 } || input.BannerUrl is { Length: > 1024 }, "logoUrl", "URL da imagem inválida.");
        errors.ThrowIfAny();

        if (await db.Sellers.AnyAsync(s => s.Ruc == ruc && s.Id != existingId, ct))
            throw AppException.Validation("ruc", "Já existe uma loja cadastrada com este RUC.");
        var validCategories = await db.Categories.Where(c => categoryIds.Contains(c.Id)).Select(c => c.Id).ToListAsync(ct);
        if (validCategories.Count != categoryIds.Count)
            throw AppException.Validation("categoryIds", "Categoria inválida.");

        return new ValidatedProfile(name, ruc, city, description,
            string.IsNullOrWhiteSpace(input.LogoUrl) ? null : input.LogoUrl.Trim(),
            string.IsNullOrWhiteSpace(input.BannerUrl) ? null : input.BannerUrl.Trim(),
            policy, categoryIds);
    }

    private async Task<string> UniqueSellerSlugAsync(string name, CancellationToken ct)
    {
        var baseSlug = Slug.From(name);
        if (string.IsNullOrEmpty(baseSlug)) baseSlug = "loja";
        var slug = baseSlug;
        var i = 2;
        while (await db.Sellers.AnyAsync(s => s.Slug == slug, ct)) slug = $"{baseSlug}-{i++}";
        return slug;
    }

    private async Task<SellerProfileDto> ToProfileAsync(Seller s, CancellationToken ct)
    {
        var count = await db.Products.CountAsync(p => p.SellerId == s.Id && p.Status == ProductStatus.Ativo, ct);
        return new SellerProfileDto(s.Id, s.Slug, s.Name, s.LogoUrl, s.BannerUrl, s.City, s.Description, s.Ruc, s.ExchangePolicy,
            s.Status, s.ReputationLevel, s.IsOfficialStore, s.Rating, s.ReviewCount, count, s.MemberSince,
            s.Categories.Select(c => c.Category.ToRef()).ToList());
    }

    // ----- Dashboard -----

    public async Task<SellerDashboardDto> DashboardAsync(CancellationToken ct)
    {
        var seller = await RequireSellerAsync(ct);
        var now = Now;
        var from = now.AddDays(-30);
        var paidStatuses = new[] { OrderStatus.Pago, OrderStatus.EmPreparacao, OrderStatus.Enviado, OrderStatus.EmTransitoInternacional, OrderStatus.Entregue, OrderStatus.Concluido };
        var recent = db.Orders.AsNoTracking().Where(o => o.SellerId == seller.Id && o.CreatedAt >= from && paidStatuses.Contains(o.Status));
        var gross = await recent.SumAsync(o => o.SubtotalAmount + o.ShippingAmount - o.DiscountAmount, ct);
        var ordersCount = await recent.CountAsync(ct);
        var pending = await db.Orders.CountAsync(o => o.SellerId == seller.Id && (o.Status == OrderStatus.Pago || o.Status == OrderStatus.EmPreparacao), ct);
        var openQuestions = await db.Questions.CountAsync(q => q.AnswerText == null && db.Products.Any(p => p.Id == q.ProductId && p.SellerId == seller.Id), ct);
        var activeProducts = await db.Products.CountAsync(p => p.SellerId == seller.Id && p.Status == ProductStatus.Ativo, ct);
        return new SellerDashboardDto(seller.Id, new DateRange(from, now), Money.Brl(gross), ordersCount, pending, openQuestions, activeProducts, seller.ReputationLevel);
    }

    // ----- Produtos -----

    public async Task<PagedResult<SellerProductListItemDto>> ListProductsAsync(ProductStatus? status, string? q, int? page, int? pageSize, CancellationToken ct)
    {
        var seller = await RequireSellerAsync(ct);
        var query = db.Products.AsNoTracking().Include(p => p.Images).Where(p => p.SellerId == seller.Id);
        if (status is { } s) query = query.Where(p => p.Status == s);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = Slug.Normalize(q.Trim());
            query = query.Where(p => p.SearchText.Contains(term));
        }
        var paged = await query.OrderByDescending(p => p.UpdatedAt).ToPagedAsync(page, pageSize, 20, ct);
        return paged.Map(p => new SellerProductListItemDto(p.Id, p.Slug, p.Name, p.Thumbnail(), p.Price, p.CompareAtPrice, p.Stock, p.Status, p.SoldCount, p.UpdatedAt));
    }

    public async Task<SellerProductDto> GetProductAsync(Guid id, CancellationToken ct)
    {
        var seller = await RequireSellerAsync(ct);
        var product = await db.Products.AsNoTracking().Include(p => p.Images).FirstOrDefaultAsync(p => p.Id == id && p.SellerId == seller.Id, ct)
                      ?? throw AppException.NotFound("Produto");
        return ToDto(product);
    }

    public async Task<SellerProductDto> CreateProductAsync(SellerProductInput input, CancellationToken ct)
    {
        var seller = await RequireSellerAsync(ct);
        var v = await ValidateProductAsync(input, ct);
        var now = Now;
        var product = new Product
        {
            Id = Guid.NewGuid(),
            SellerId = seller.Id,
            CategoryId = v.CategoryId,
            Slug = await UniqueProductSlugAsync(v.Name, ct),
            Name = v.Name,
            SearchText = Slug.Normalize($"{v.Name} {seller.Name}"),
            Description = v.Description,
            PriceAmount = v.PriceAmount,
            CompareAtAmount = v.CompareAtAmount,
            Stock = v.Stock,
            FreeShipping = v.FreeShipping,
            WarrantyMonths = v.WarrantyMonths,
            HandlingDaysMin = v.HandlingDaysMin,
            HandlingDaysMax = v.HandlingDaysMax,
            OriginCity = seller.City,
            Status = v.Status,
            CreatedAt = now,
            UpdatedAt = now,
            Attributes = v.Attributes,
            Images = v.Images.Select((img, i) => new ProductImage { Id = Guid.NewGuid(), Url = img.Url!, Alt = img.Alt ?? v.Name, SortOrder = i + 1, StorageKey = img.StorageKey }).ToList(),
        };
        db.Products.Add(product);
        await db.SaveChangesAsync(ct);
        return ToDto(product);
    }

    public async Task<SellerProductDto> UpdateProductAsync(Guid id, SellerProductInput input, CancellationToken ct)
    {
        var seller = await RequireSellerAsync(ct);
        var product = await db.Products.Include(p => p.Images).FirstOrDefaultAsync(p => p.Id == id && p.SellerId == seller.Id, ct)
                      ?? throw AppException.NotFound("Produto");
        var v = await ValidateProductAsync(input, ct);
        product.CategoryId = v.CategoryId;
        product.Name = v.Name;
        product.SearchText = Slug.Normalize($"{v.Name} {seller.Name}");
        product.Description = v.Description;
        product.PriceAmount = v.PriceAmount;
        product.CompareAtAmount = v.CompareAtAmount;
        product.Stock = v.Stock;
        product.FreeShipping = v.FreeShipping;
        product.WarrantyMonths = v.WarrantyMonths;
        product.HandlingDaysMin = v.HandlingDaysMin;
        product.HandlingDaysMax = v.HandlingDaysMax;
        product.Status = v.Status;
        product.Attributes = v.Attributes;
        product.UpdatedAt = Now;

        var keep = v.Images.Select(i => i.Url).ToHashSet();
        product.Images.RemoveAll(i => !keep.Contains(i.Url));
        for (var i = 0; i < v.Images.Count; i++)
        {
            var img = v.Images[i];
            var existing = product.Images.FirstOrDefault(x => x.Url == img.Url);
            if (existing is null)
                product.Images.Add(new ProductImage { Id = Guid.NewGuid(), ProductId = product.Id, Url = img.Url!, Alt = img.Alt ?? v.Name, SortOrder = i + 1, StorageKey = img.StorageKey });
            else
            {
                existing.SortOrder = i + 1;
                existing.Alt = img.Alt ?? existing.Alt;
            }
        }
        await db.SaveChangesAsync(ct);
        return ToDto(product);
    }

    /// <summary>Arquiva (não apaga): pedidos antigos continuam referenciando o produto.</summary>
    public async Task ArchiveProductAsync(Guid id, CancellationToken ct)
    {
        var seller = await RequireSellerAsync(ct);
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id && p.SellerId == seller.Id, ct)
                      ?? throw AppException.NotFound("Produto");
        product.Status = ProductStatus.Arquivado;
        product.UpdatedAt = Now;
        await db.SaveChangesAsync(ct);
    }

    private sealed record ValidatedProduct(string Name, string Description, Guid CategoryId, long PriceAmount, long? CompareAtAmount, int Stock, bool FreeShipping, int? WarrantyMonths, int HandlingDaysMin, int HandlingDaysMax, List<ProductAttribute> Attributes, List<SellerProductImageInput> Images, ProductStatus Status);

    private async Task<ValidatedProduct> ValidateProductAsync(SellerProductInput input, CancellationToken ct)
    {
        var name = input.Name?.Trim() ?? string.Empty;
        var description = input.Description?.Trim() ?? string.Empty;
        var images = (input.Images ?? []).Where(i => !string.IsNullOrWhiteSpace(i.Url)).Select(i => i with { Url = i.Url!.Trim() }).ToList();
        var attributes = (input.Attributes ?? []).Where(a => !string.IsNullOrWhiteSpace(a.Name) && !string.IsNullOrWhiteSpace(a.Value))
            .Select(a => new ProductAttribute(a.Name.Trim(), a.Value.Trim())).ToList();
        var minDays = input.HandlingDaysMin ?? 1;
        var maxDays = input.HandlingDaysMax ?? Math.Max(minDays, 3);
        var status = input.Status ?? ProductStatus.Ativo;

        var errors = new ValidationErrors()
            .AddIf(name.Length < 5, "name", "Informe o nome do produto (mínimo 5 caracteres).")
            .AddIf(name.Length > 200, "name", "Nome muito longo (máximo 200 caracteres).")
            .AddIf(description.Length < 20, "description", "Descreva o produto (mínimo 20 caracteres).")
            .AddIf(input.CategoryId is null, "categoryId", "Escolha a categoria.")
            .AddIf(input.PriceAmount is null or < 100, "priceAmount", "Informe um preço válido (mínimo R$ 1,00).")
            .AddIf(input.PriceAmount > 100_000_000, "priceAmount", "Preço acima do limite permitido.")
            .AddIf(input.CompareAtAmount is { } c && c <= (input.PriceAmount ?? 0), "compareAtAmount", "O preço \"de\" deve ser maior que o preço atual.")
            .AddIf(input.Stock is null or < 0, "stock", "Informe o estoque disponível.")
            .AddIf(input.WarrantyMonths is < 0 or > 120, "warrantyMonths", "Garantia inválida.")
            .AddIf(minDays < 0 || maxDays < minDays || maxDays > 30, "handlingDaysMax", "Prazo de preparação inválido.")
            .AddIf(images.Count == 0, "images", "Adicione pelo menos uma foto do produto.")
            .AddIf(images.Count > 8, "images", "Máximo de 8 fotos.")
            .AddIf(images.Any(i => i.Url!.Length > 1024 || !(i.Url.StartsWith("/") || i.Url.StartsWith("http"))), "images", "URL de imagem inválida.")
            .AddIf(status == ProductStatus.Arquivado, "status", "Use a ação de arquivar para remover o produto.");
        errors.ThrowIfAny();

        if (!await db.Categories.AnyAsync(c => c.Id == input.CategoryId, ct))
            throw AppException.Validation("categoryId", "Categoria inválida.");

        return new ValidatedProduct(name, description, input.CategoryId!.Value, input.PriceAmount!.Value, input.CompareAtAmount, input.Stock!.Value,
            input.FreeShipping, input.WarrantyMonths, minDays, maxDays, attributes, images, status);
    }

    private async Task<string> UniqueProductSlugAsync(string name, CancellationToken ct)
    {
        var baseSlug = Slug.From(name);
        if (string.IsNullOrEmpty(baseSlug)) baseSlug = "produto";
        if (baseSlug.Length > 150) baseSlug = baseSlug[..150].TrimEnd('-');
        var slug = baseSlug;
        var i = 2;
        while (await db.Products.AnyAsync(p => p.Slug == slug, ct)) slug = $"{baseSlug}-{i++}";
        return slug;
    }

    private static SellerProductDto ToDto(Product p) =>
        new(p.Id, p.Slug, p.Name, p.Description, p.CategoryId, p.Price, p.CompareAtPrice, p.Stock, p.FreeShipping, p.WarrantyMonths,
            new DayRange(p.HandlingDaysMin, p.HandlingDaysMax),
            p.Attributes.Select(a => new ProductAttributeDto(a.Name, a.Value)).ToList(),
            p.Images.OrderBy(i => i.SortOrder).Select(i => new SellerProductImageDto(i.Id, i.Url, i.Alt, i.SortOrder, i.StorageKey)).ToList(),
            p.Status, p.SoldCount, p.Rating, p.ReviewCount, p.CreatedAt, p.UpdatedAt);

    // ----- Pedidos da loja -----

    public async Task<PagedResult<OrderDto>> ListOrdersAsync(OrderStatus? status, int? page, int? pageSize, CancellationToken ct)
    {
        var seller = await RequireSellerAsync(ct);
        var query = orders.FullOrders().AsNoTracking().Where(o => o.SellerId == seller.Id);
        if (status is { } s) query = query.Where(o => o.Status == s);
        var paged = await query.OrderByDescending(o => o.CreatedAt).ToPagedAsync(page, pageSize, 20, ct);
        return paged.Map(o => o.ToDto(currentUser.Locale));
    }

    private async Task<Order> RequireOrderAsync(Guid id, CancellationToken ct)
    {
        var seller = await RequireSellerAsync(ct);
        return await orders.FullOrders().FirstOrDefaultAsync(o => o.Id == id && o.SellerId == seller.Id, ct)
               ?? throw AppException.NotFound("Pedido");
    }

    /// <summary>Pago → EmPreparacao (vendedor começou a separar).</summary>
    public async Task<OrderDto> PrepareOrderAsync(Guid id, CancellationToken ct)
    {
        var order = await RequireOrderAsync(id, ct);
        if (order.Status != OrderStatus.Pago)
            throw AppException.Conflict("ORDER_INVALID_TRANSITION", "Só pedidos pagos podem entrar em preparação.");
        orders.Transition(order, OrderStatus.EmPreparacao, null, null, "seller");
        await db.SaveChangesAsync(ct);
        return order.ToDto(currentUser.Locale);
    }

    /// <summary>Pago/EmPreparacao → Enviado, com transportadora e código de rastreio.</summary>
    public async Task<OrderDto> ShipOrderAsync(Guid id, ShipOrderRequest request, CancellationToken ct)
    {
        var order = await RequireOrderAsync(id, ct);
        var tracking = request.TrackingCode?.Trim().ToUpperInvariant() ?? string.Empty;
        new ValidationErrors()
            .AddIf(tracking.Length < 8 || tracking.Length > 40, "trackingCode", "Informe o código de rastreio (8 a 40 caracteres).")
            .AddIf(string.IsNullOrWhiteSpace(request.Carrier), "carrier", "Informe a transportadora.")
            .ThrowIfAny();
        if (order.Status is not (OrderStatus.Pago or OrderStatus.EmPreparacao))
            throw AppException.Conflict("ORDER_INVALID_TRANSITION", "Só pedidos pagos ou em preparação podem ser enviados.");
        if (order.Status == OrderStatus.Pago) orders.Transition(order, OrderStatus.EmPreparacao, null, null, "seller");
        order.TrackingCode = tracking;
        order.Carrier = request.Carrier!.Trim();
        orders.Transition(order, OrderStatus.Enviado, null, $"{order.Seller.City}, PY", "seller");
        order.TrackingEvents.Add(new TrackingEvent
        {
            OrderId = order.Id, Code = "POSTED", Description = "Objeto postado", Location = $"{order.Seller.City}, PY",
            OccurredAt = Now, ExternalId = $"seller:{tracking}:posted",
        });
        await db.SaveChangesAsync(ct);
        return order.ToDto(currentUser.Locale);
    }
}
