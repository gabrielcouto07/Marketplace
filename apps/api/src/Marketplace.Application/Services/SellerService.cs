using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

public sealed class SellerService(IAppDbContext db)
{
    public async Task<IReadOnlyList<SellerSummaryDto>> ListAsync(CancellationToken ct)
    {
        var sellers = await db.Sellers.AsNoTracking()
            .Where(s => s.Status == SellerStatus.Aprovado)
            .OrderByDescending(s => s.ReputationLevel).ThenByDescending(s => s.SalesCount)
            .ToListAsync(ct);
        return sellers.Select(s => s.ToSummary()).ToList();
    }

    public async Task<SellerDto> DetailAsync(string slug, CancellationToken ct)
    {
        var seller = await db.Sellers.AsNoTracking()
                         .Include(s => s.Categories).ThenInclude(sc => sc.Category)
                         .FirstOrDefaultAsync(s => s.Slug == slug && s.Status == SellerStatus.Aprovado, ct)
                     ?? throw AppException.NotFound("Loja");
        var count = await db.Products.CountAsync(p => p.SellerId == seller.Id && p.Status == ProductStatus.Ativo, ct);
        return seller.ToDto(count);
    }

    public async Task<PagedResult<ReviewDto>> ReviewsAsync(string slug, int? page, int? pageSize, CancellationToken ct)
    {
        var sellerId = await db.Sellers.AsNoTracking().Where(s => s.Slug == slug).Select(s => (Guid?)s.Id).FirstOrDefaultAsync(ct)
                       ?? throw AppException.NotFound("Loja");
        var paged = await db.Reviews.AsNoTracking()
            .Where(r => r.SellerId == sellerId)
            .OrderByDescending(r => r.CreatedAt)
            .ToPagedAsync(page, pageSize, 5, ct);
        return paged.Map(r => r.ToDto());
    }
}
