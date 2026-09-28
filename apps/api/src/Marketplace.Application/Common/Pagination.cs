using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Common;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

public static class Pagination
{
    public const int MaxPageSize = 60;

    public static (int Page, int PageSize) Normalize(int? page, int? pageSize, int defaultSize = 20)
    {
        var p = Math.Max(1, page ?? 1);
        var s = Math.Clamp(pageSize ?? defaultSize, 1, MaxPageSize);
        return (p, s);
    }

    public static async Task<PagedResult<T>> ToPagedAsync<T>(
        this IQueryable<T> query, int? page, int? pageSize, int defaultSize, CancellationToken ct)
    {
        var (p, s) = Normalize(page, pageSize, defaultSize);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((p - 1) * s).Take(s).ToListAsync(ct);
        return new PagedResult<T>(items, p, s, total);
    }

    public static PagedResult<TOut> Map<TIn, TOut>(this PagedResult<TIn> source, Func<TIn, TOut> map) =>
        new(source.Items.Select(map).ToList(), source.Page, source.PageSize, source.TotalCount);

    public static PagedResult<T> FromList<T>(IReadOnlyList<T> all, int? page, int? pageSize, int defaultSize = 20)
    {
        var (p, s) = Normalize(page, pageSize, defaultSize);
        return new PagedResult<T>(all.Skip((p - 1) * s).Take(s).ToList(), p, s, all.Count);
    }
}
