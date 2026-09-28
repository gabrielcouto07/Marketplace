using Marketplace.Application.Contracts;
using Marketplace.Application.Services;

namespace Marketplace.Api.Endpoints;

public static class CatalogEndpoints
{
    public static RouteGroupBuilder MapCatalog(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("").WithTags("Catálogo");

        g.MapGet("/home", (CatalogService svc, CancellationToken ct) => svc.HomeAsync(ct))
            .CacheOutput("catalog");

        g.MapGet("/categories", (CatalogService svc, CancellationToken ct) => svc.CategoriesAsync(ct))
            .CacheOutput("catalog");

        g.MapGet("/categories/{slug}", (string slug, CatalogService svc, CancellationToken ct) => svc.CategoryAsync(slug, ct))
            .CacheOutput("catalog");

        g.MapGet("/products", (
                string? q, string? categorySlug, string? sellerSlug, long? minPrice, long? maxPrice, bool? freeShipping,
                double? minRating, bool? onlyOffers, string? sort, int? page, int? pageSize,
                CatalogService svc, CancellationToken ct) =>
            svc.SearchAsync(new ProductSearchQuery(q, categorySlug, sellerSlug, minPrice, maxPrice, freeShipping, minRating, onlyOffers,
                Enum.TryParse<ProductSort>(sort, true, out var s) ? s : ProductSort.relevance, page, pageSize), ct))
            .CacheOutput("catalog");

        g.MapGet("/products/suggestions", (string? q, CatalogService svc, CancellationToken ct) => svc.SuggestionsAsync(q, ct))
            .CacheOutput("catalog");

        g.MapGet("/products/{slug}", (string slug, CatalogService svc, CancellationToken ct) => svc.ProductAsync(slug, ct))
            .CacheOutput("catalog");

        g.MapGet("/products/{id:guid}/reviews", (Guid id, int? page, int? pageSize, CatalogService svc, CancellationToken ct) =>
            svc.ReviewsAsync(id, page, pageSize, ct));

        g.MapGet("/products/{id:guid}/reviews/summary", (Guid id, CatalogService svc, CancellationToken ct) => svc.ReviewSummaryAsync(id, ct));

        g.MapPost("/products/{id:guid}/reviews", async (Guid id, CreateReviewRequest body, CatalogService svc, CancellationToken ct) =>
                Results.Created($"/api/products/{id}/reviews", await svc.CreateReviewAsync(id, body, ct)))
            .RequireAuthorization();

        g.MapGet("/products/{id:guid}/questions", (Guid id, int? page, int? pageSize, CatalogService svc, CancellationToken ct) =>
            svc.QuestionsAsync(id, page, pageSize, ct));

        g.MapPost("/products/{id:guid}/questions", async (Guid id, AskQuestionRequest body, CatalogService svc, CancellationToken ct) =>
                Results.Created($"/api/products/{id}/questions", await svc.AskQuestionAsync(id, body, ct)))
            .RequireAuthorization();

        return api;
    }

    public static RouteGroupBuilder MapSellers(this RouteGroupBuilder api)
    {
        var g = api.MapGroup("/sellers").WithTags("Lojas");
        g.MapGet("", (SellerService svc, CancellationToken ct) => svc.ListAsync(ct)).CacheOutput("catalog");
        g.MapGet("/{slug}", (string slug, SellerService svc, CancellationToken ct) => svc.DetailAsync(slug, ct)).CacheOutput("catalog");
        g.MapGet("/{slug}/reviews", (string slug, int? page, int? pageSize, SellerService svc, CancellationToken ct) =>
            svc.ReviewsAsync(slug, page, pageSize, ct));
        return api;
    }
}
