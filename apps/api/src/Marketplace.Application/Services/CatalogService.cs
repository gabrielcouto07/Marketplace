using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

public sealed class CatalogService(IAppDbContext db, ExchangeRateService rates, ICurrentUser currentUser, TimeProvider clock)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    private IQueryable<Product> ActiveProducts() =>
        db.Products.AsNoTracking()
            .Include(p => p.Seller)
            .Include(p => p.Images)
            .Where(p => p.Status == ProductStatus.Ativo && p.Seller.Status == SellerStatus.Aprovado);

    public async Task<HomeDto> HomeAsync(CancellationToken ct)
    {
        var rate = await rates.GetCurrentAsync(CurrencyCode.BRL, CurrencyCode.PYG, ct);
        var now = Now;
        var banners = await db.Banners.AsNoTracking().Where(b => b.Active).OrderBy(b => b.SortOrder).ToListAsync(ct);
        var categories = await CategoriesAsync(ct);

        var offers = await ActiveProducts()
            .Where(p => p.CompareAtAmount != null && p.CompareAtAmount > p.PriceAmount)
            .OrderByDescending(p => p.SoldCount)
            .Take(40)
            .ToListAsync(ct);
        var newArrivals = await ActiveProducts().OrderByDescending(p => p.CreatedAt).Take(12).ToListAsync(ct);
        var bestSellers = await ActiveProducts().OrderByDescending(p => p.SoldCount).Take(12).ToListAsync(ct);
        var featured = await db.Sellers.AsNoTracking()
            .Where(s => s.Status == SellerStatus.Aprovado && s.ReputationLevel >= 4)
            .OrderByDescending(s => s.SalesCount)
            .ToListAsync(ct);

        return new HomeDto(
            banners.Select(b => b.ToDto()).ToList(),
            categories,
            offers.Where(p => p.IsOffer).Take(12).Select(p => p.ToSummary(rate, now)).ToList(),
            newArrivals.Select(p => p.ToSummary(rate, now)).ToList(),
            bestSellers.Select(p => p.ToSummary(rate, now)).ToList(),
            featured.Select(s => s.ToSummary()).ToList());
    }

    public async Task<IReadOnlyList<CategoryDto>> CategoriesAsync(CancellationToken ct)
    {
        var counts = await ActiveProducts()
            .GroupBy(p => p.CategoryId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);
        var categories = await db.Categories.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);
        return categories.Select(c => c.ToDto(counts.GetValueOrDefault(c.Id))).ToList();
    }

    public async Task<CategoryDto> CategoryAsync(string slug, CancellationToken ct)
    {
        var category = await db.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.Slug == slug, ct)
                       ?? throw AppException.NotFound("Categoria");
        var count = await ActiveProducts().CountAsync(p => p.CategoryId == category.Id, ct);
        return category.ToDto(count);
    }

    public async Task<ProductSearchResultDto> SearchAsync(ProductSearchQuery query, CancellationToken ct)
    {
        var rate = await rates.GetCurrentAsync(CurrencyCode.BRL, CurrencyCode.PYG, ct);
        var now = Now;
        var items = ActiveProducts();

        Category? category = null;
        if (!string.IsNullOrWhiteSpace(query.CategorySlug))
        {
            category = await db.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.Slug == query.CategorySlug, ct)
                       ?? throw AppException.NotFound("Categoria");
            items = items.Where(p => p.CategoryId == category.Id);
        }

        Seller? seller = null;
        if (!string.IsNullOrWhiteSpace(query.SellerSlug))
        {
            seller = await db.Sellers.AsNoTracking().FirstOrDefaultAsync(s => s.Slug == query.SellerSlug, ct)
                     ?? throw AppException.NotFound("Loja");
            items = items.Where(p => p.SellerId == seller.Id);
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var terms = Slug.Normalize(query.Q.Trim()).Split(' ', StringSplitOptions.RemoveEmptyEntries);
            foreach (var term in terms)
            {
                var t = term;
                items = items.Where(p => p.SearchText.Contains(t));
            }
        }

        // Facetas calculadas antes dos filtros numéricos (o usuário vê o universo da busca).
        var facetSource = items;
        var categoryFacets = await facetSource
            .GroupBy(p => new { p.CategoryId, p.Category.Slug, p.Category.Name })
            .Select(g => new FacetCountDto(g.Key.Slug, g.Key.Name, g.Count()))
            .ToListAsync(ct);
        var sellerFacets = await facetSource
            .GroupBy(p => new { p.SellerId, p.Seller.Slug, p.Seller.Name })
            .Select(g => new FacetCountDto(g.Key.Slug, g.Key.Name, g.Count()))
            .ToListAsync(ct);
        var minPrice = await facetSource.Select(p => (long?)p.PriceAmount).MinAsync(ct) ?? 0;
        var maxPrice = await facetSource.Select(p => (long?)p.PriceAmount).MaxAsync(ct) ?? 0;
        var facets = new ProductSearchFacetsDto(
            categoryFacets.OrderBy(f => f.Name).ToList(),
            sellerFacets.OrderBy(f => f.Name).ToList(),
            new PriceRangeDto(Money.Brl(minPrice), Money.Brl(maxPrice)));

        if (query.MinPrice is { } min) items = items.Where(p => p.PriceAmount >= min);
        if (query.MaxPrice is { } max) items = items.Where(p => p.PriceAmount <= max);
        if (query.FreeShipping == true) items = items.Where(p => p.FreeShipping);
        if (query.OnlyOffers == true)
            items = items.Where(p => p.CompareAtAmount != null && (p.CompareAtAmount - p.PriceAmount) * 100 >= p.CompareAtAmount * 15);
        if (query.MinRating is { } rating) items = items.Where(p => p.Rating >= rating);

        items = query.Sort switch
        {
            ProductSort.priceAsc => items.OrderBy(p => p.PriceAmount).ThenBy(p => p.Id),
            ProductSort.priceDesc => items.OrderByDescending(p => p.PriceAmount).ThenBy(p => p.Id),
            ProductSort.newest => items.OrderByDescending(p => p.CreatedAt).ThenBy(p => p.Id),
            ProductSort.bestSelling => items.OrderByDescending(p => p.SoldCount).ThenBy(p => p.Id),
            ProductSort.rating => items.OrderByDescending(p => p.Rating).ThenByDescending(p => p.ReviewCount).ThenBy(p => p.Id),
            _ => items.OrderByDescending(p => p.SoldCount * p.Rating).ThenBy(p => p.Id),
        };

        var paged = await items.ToPagedAsync(query.Page, query.PageSize, 20, ct);
        return new ProductSearchResultDto(
            paged.Items.Select(p => p.ToSummary(rate, now)).ToList(),
            paged.Page, paged.PageSize, paged.TotalCount, facets);
    }

    public async Task<IReadOnlyList<SearchSuggestionDto>> SuggestionsAsync(string? q, CancellationToken ct)
    {
        var term = Slug.Normalize((q ?? string.Empty).Trim());
        if (term.Length < 2) return [];
        var products = await ActiveProducts()
            .Where(p => p.SearchText.Contains(term))
            .OrderByDescending(p => p.SoldCount)
            .Take(6)
            .ToListAsync(ct);
        return products.Select(p => new SearchSuggestionDto(p.Slug, p.Name, p.Thumbnail())).ToList();
    }

    public async Task<ProductDetailDto> ProductAsync(string slug, CancellationToken ct)
    {
        var product = await ActiveProducts()
                          .Include(p => p.Category)
                          .Include(p => p.Variants)
                          .FirstOrDefaultAsync(p => p.Slug == slug, ct)
                      ?? throw AppException.NotFound("Produto");
        var rate = await rates.GetCurrentAsync(CurrencyCode.BRL, CurrencyCode.PYG, ct);
        var questionCount = await db.Questions.CountAsync(q => q.ProductId == product.Id, ct);
        return product.ToDetail(rate, Now, questionCount);
    }

    private async Task<Guid> RequireProductIdAsync(Guid id, CancellationToken ct)
    {
        var exists = await db.Products.AnyAsync(p => p.Id == id, ct);
        return exists ? id : throw AppException.NotFound("Produto");
    }

    public async Task<PagedResult<ReviewDto>> ReviewsAsync(Guid productId, int? page, int? pageSize, CancellationToken ct)
    {
        await RequireProductIdAsync(productId, ct);
        var paged = await db.Reviews.AsNoTracking()
            .Where(r => r.ProductId == productId)
            .OrderByDescending(r => r.CreatedAt)
            .ToPagedAsync(page, pageSize, 5, ct);
        return paged.Map(r => r.ToDto());
    }

    public async Task<ReviewSummaryDto> ReviewSummaryAsync(Guid productId, CancellationToken ct)
    {
        await RequireProductIdAsync(productId, ct);
        var ratings = await db.Reviews.AsNoTracking().Where(r => r.ProductId == productId).Select(r => r.Rating).ToListAsync(ct);
        var distribution = new int[5];
        foreach (var r in ratings) if (r is >= 1 and <= 5) distribution[r - 1]++;
        var average = ratings.Count == 0 ? 0 : Math.Round(ratings.Average(), 1);
        return new ReviewSummaryDto(average, ratings.Count, distribution);
    }

    public async Task<PagedResult<QuestionDto>> QuestionsAsync(Guid productId, int? page, int? pageSize, CancellationToken ct)
    {
        await RequireProductIdAsync(productId, ct);
        var paged = await db.Questions.AsNoTracking()
            .Where(q => q.ProductId == productId)
            .OrderByDescending(q => q.AskedAt)
            .ToPagedAsync(page, pageSize, 10, ct);
        return paged.Map(q => q.ToDto());
    }

    public async Task<QuestionDto> AskQuestionAsync(Guid productId, AskQuestionRequest request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        await RequireProductIdAsync(productId, ct);
        var text = request.Question?.Trim() ?? string.Empty;
        new ValidationErrors()
            .AddIf(text.Length < 10, "question", "A pergunta deve ter pelo menos 10 caracteres.")
            .AddIf(text.Length > 500, "question", "A pergunta deve ter no máximo 500 caracteres.")
            .ThrowIfAny();
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        var question = new Question
        {
            Id = Guid.NewGuid(),
            ProductId = productId,
            UserId = userId,
            AskedByName = PublicName(user.FullName),
            Text = text,
            AskedAt = Now,
        };
        db.Questions.Add(question);
        await db.SaveChangesAsync(ct);
        return question.ToDto();
    }

    /// <summary>Avaliação só para quem recebeu o produto (pedido Entregue/Concluido).</summary>
    public async Task<ReviewDto> CreateReviewAsync(Guid productId, CreateReviewRequest request, CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == productId, ct) ?? throw AppException.NotFound("Produto");
        var comment = request.Comment?.Trim() ?? string.Empty;
        new ValidationErrors()
            .AddIf(request.Rating is < 1 or > 5, "rating", "A nota deve ser de 1 a 5.")
            .AddIf(comment.Length < 5, "comment", "Conte um pouco mais sobre o produto (mínimo 5 caracteres).")
            .ThrowIfAny();

        var deliveredOrder = await db.Orders.AsNoTracking()
            .Where(o => o.UserId == userId && (o.Status == OrderStatus.Entregue || o.Status == OrderStatus.Concluido))
            .Where(o => o.Items.Any(i => i.ProductId == productId))
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct);
        if (deliveredOrder is null)
            throw AppException.Conflict("REVIEW_NOT_ALLOWED", "Você só pode avaliar produtos que já recebeu.");
        if (await db.Reviews.AnyAsync(r => r.ProductId == productId && r.UserId == userId, ct))
            throw AppException.Conflict("REVIEW_ALREADY_EXISTS", "Você já avaliou este produto.");

        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        var review = new Review
        {
            Id = Guid.NewGuid(),
            ProductId = productId,
            SellerId = product.SellerId,
            UserId = userId,
            OrderId = deliveredOrder.Id,
            AuthorName = PublicName(user.FullName),
            Rating = request.Rating,
            Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim(),
            Comment = comment,
            CreatedAt = Now,
            VerifiedPurchase = true,
        };
        db.Reviews.Add(review);

        var ratings = await db.Reviews.Where(r => r.ProductId == productId).Select(r => r.Rating).ToListAsync(ct);
        ratings.Add(request.Rating);
        product.Rating = Math.Round(ratings.Average(), 1);
        product.ReviewCount = ratings.Count;
        product.UpdatedAt = Now;
        await db.SaveChangesAsync(ct);
        return review.ToDto();
    }

    /// <summary>"Gabriel Demo" → "Gabriel D." (minimização de dados em conteúdo público).</summary>
    public static string PublicName(string fullName)
    {
        var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "Cliente";
        return parts.Length == 1 ? parts[0] : $"{parts[0]} {parts[1][0]}.";
    }
}
