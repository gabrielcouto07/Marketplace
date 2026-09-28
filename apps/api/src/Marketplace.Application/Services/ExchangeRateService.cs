using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

public sealed class ExchangeRateService(IAppDbContext db, TimeProvider clock)
{
    private readonly Dictionary<(CurrencyCode, CurrencyCode), ExchangeRate?> _cache = [];

    /// <summary>Taxa vigente (mais recente e não expirada); cai para a mais recente quando todas expiraram.</summary>
    public async Task<ExchangeRate> GetCurrentAsync(CurrencyCode from, CurrencyCode to, CancellationToken ct) =>
        await TryGetCurrentAsync(from, to, ct)
        ?? throw new AppException(503, "EXCHANGE_RATE_UNAVAILABLE", $"Sem cotação {from}→{to} disponível.");

    public async Task<ExchangeRate?> TryGetCurrentAsync(CurrencyCode from, CurrencyCode to, CancellationToken ct)
    {
        if (_cache.TryGetValue((from, to), out var cached)) return cached;
        var now = clock.GetUtcNow().UtcDateTime;
        var rate = await db.ExchangeRates.AsNoTracking()
                       .Where(r => r.From == from && r.To == to && r.ExpiresAt > now)
                       .OrderByDescending(r => r.QuotedAt)
                       .FirstOrDefaultAsync(ct)
                   ?? await db.ExchangeRates.AsNoTracking()
                       .Where(r => r.From == from && r.To == to)
                       .OrderByDescending(r => r.QuotedAt)
                       .FirstOrDefaultAsync(ct);
        _cache[(from, to)] = rate;
        return rate;
    }

    public async Task<IReadOnlyList<ExchangeRateDto>> ListAsync(CurrencyCode? from, CurrencyCode? to, CancellationToken ct)
    {
        var pairs = await db.ExchangeRates.AsNoTracking()
            .Where(r => (from == null || r.From == from) && (to == null || r.To == to))
            .Select(r => new { r.From, r.To })
            .Distinct()
            .ToListAsync(ct);
        var result = new List<ExchangeRateDto>();
        foreach (var pair in pairs)
        {
            var rate = await TryGetCurrentAsync(pair.From, pair.To, ct);
            if (rate is not null) result.Add(rate.ToDto());
        }
        return result;
    }
}
